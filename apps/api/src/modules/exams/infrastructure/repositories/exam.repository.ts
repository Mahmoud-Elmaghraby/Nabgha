import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { KyselyService } from '../../../../shared/infrastructure/database/kysely.service';
import {
  ExamQuestionEntity,
  ExamEntity,
  ExamItemEntity,
} from '../../domain/entities/exam.entity';
import type {
  IExamRepository,
  ListQuestionsParams,
  ListExamsParams,
  CreateQuestionData,
  CreateExamData,
  CreateExamItemData,
  BlueprintQueryParams,
  QuestionAvailability,
  SessionLinkInfo,
} from '../../domain/repositories/exam.repository.interface';

/**
 * أعمدة JSONB لازم تتبعت كنص JSON. الـ pg driver بيحوّل الـ JS array لـ Postgres array literal
 * ('{"أ","ب"}') وده JSON غير صالح — فإضافة أي سؤال اختياري كانت بتفشل بـ 22P02.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toJsonb(value: unknown): any {
  return value === null || value === undefined ? null : JSON.stringify(value);
}

@Injectable()
export class ExamRepository implements IExamRepository {
  constructor(private readonly kysely: KyselyService) {}

  // ═══════════════════════════════════════════════════════════
  // بنك الأسئلة
  // ═══════════════════════════════════════════════════════════

  async findQuestions(
    tenantId: string,
    params: ListQuestionsParams,
  ): Promise<{ data: ExamQuestionEntity[]; total: number }> {
    const db     = this.kysely.getTenantDb(tenantId);
    const page   = params.page  ?? 1;
    const limit  = params.limit ?? 20;
    const offset = (page - 1) * limit;

    let base = db
      .selectFrom('exam_questions')
      .where('deleted_at', 'is', null);

    if (params.search) {
      base = base.where('question_text', 'ilike', `%${params.search}%`);
    }
    if (params.subjectId) {
      base = base.where('subject_id', '=', sql<string>`${params.subjectId}::uuid`);
    }
    if (params.grade) {
      base = base.where('grade', '=', params.grade);
    }
    if (params.type) {
      base = base.where('type', '=', params.type as any);
    }
    if (params.difficulty) {
      base = base.where('difficulty', '=', params.difficulty as any);
    }
    if (params.tags && params.tags.length > 0) {
      // مصفوفة JS بتتبعت كـ text[] — JSON.stringify كان بيبعت '["x"]' وده مش array literal صالح
      base = base.where(sql<boolean>`tags && ${params.tags}::text[]`);
    }

    const countResult = await base
      .select(db.fn.countAll<number>().as('count'))
      .executeTakeFirst();
    const total = Number(countResult?.count ?? 0);

    const rows = await base
      .selectAll()
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .execute();

    return { data: rows.map((r: any) => this.toQuestion(r)), total };
  }

  async createQuestionsBulk(tenantId: string, data: CreateQuestionData[]): Promise<number> {
    if (data.length === 0) return 0;
    const db = this.kysely.getTenantDb(tenantId);
    let inserted = 0;
    // دفعات صغيرة عشان حد عدد الـ parameters في Postgres
    for (let i = 0; i < data.length; i += 200) {
      const chunk = data.slice(i, i + 200);
      await db
        .insertInto('exam_questions')
        .values(chunk.map((d) => ({
          teacher_id:     sql<string>`${d.teacherId}::uuid`,
          subject_id:     d.subjectId ? sql<string>`${d.subjectId}::uuid` : null,
          grade:          d.grade          ?? null,
          type:           d.type           as any,
          question_text:  d.questionText,
          image_url:      d.imageUrl       ?? null,
          options:        toJsonb(d.options),
          correct_answer: d.correctAnswer  ?? null,
          model_answer:   d.modelAnswer    ?? null,
          difficulty:     (d.difficulty    ?? 'medium') as any,
          tags:           d.tags           ?? [],
          default_degree: d.defaultDegree  ?? 1,
          created_by:     d.createdBy ? sql<string>`${d.createdBy}::uuid` : null,
        })) as any)
        .execute();
      inserted += chunk.length;
    }
    return inserted;
  }

  async findExistingQuestionTexts(tenantId: string, texts: string[]): Promise<Set<string>> {
    if (texts.length === 0) return new Set();
    const db   = this.kysely.getTenantDb(tenantId);
    const rows = await db
      .selectFrom('exam_questions')
      .select('question_text')
      .where('deleted_at', 'is', null)
      .where('question_text', 'in', texts)
      .execute();
    return new Set(rows.map((r: any) => r.question_text));
  }

  async findQuestionById(tenantId: string, id: string): Promise<ExamQuestionEntity | null> {
    const db  = this.kysely.getTenantDb(tenantId);
    const row = await db
      .selectFrom('exam_questions')
      .selectAll()
      .where('id', '=', sql<string>`${id}::uuid`)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    return row ? this.toQuestion(row) : null;
  }

  async createQuestion(tenantId: string, data: CreateQuestionData): Promise<ExamQuestionEntity> {
    const db  = this.kysely.getTenantDb(tenantId);
    const row = await db
      .insertInto('exam_questions')
      .values({
        teacher_id:     sql<string>`${data.teacherId}::uuid`,
        subject_id:     data.subjectId ? sql<string>`${data.subjectId}::uuid` : null,
        grade:          data.grade          ?? null,
        type:           data.type           as any,
        question_text:  data.questionText,
        image_url:      data.imageUrl       ?? null,
        options:        toJsonb(data.options),
        correct_answer: data.correctAnswer  ?? null,
        model_answer:   data.modelAnswer    ?? null,
        difficulty:     (data.difficulty    ?? 'medium') as any,
        tags:           data.tags           ?? [],
        default_degree: data.defaultDegree  ?? 1,
        created_by:     data.createdBy ? sql<string>`${data.createdBy}::uuid` : null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return this.toQuestion(row);
  }

  async saveQuestion(tenantId: string, question: ExamQuestionEntity): Promise<void> {
    const db = this.kysely.getTenantDb(tenantId);
    await db
      .updateTable('exam_questions')
      .set({
        subject_id:     question.subjectId ? sql<string>`${question.subjectId}::uuid` : null,
        grade:          question.grade          ?? null,
        type:           question.type           as any,
        question_text:  question.questionText,
        image_url:      question.imageUrl       ?? null,
        options:        toJsonb(question.options),
        correct_answer: question.correctAnswer  ?? null,
        model_answer:   question.modelAnswer    ?? null,
        difficulty:     question.difficulty     as any,
        tags:           question.tags           ?? [],
        default_degree: question.defaultDegree,
        updated_at:     new Date(),
        deleted_at:     question.deletedAt      ?? null,
      })
      .where('id', '=', sql<string>`${question.id}::uuid`)
      .execute();
  }

  // ═══════════════════════════════════════════════════════════
  // الامتحانات
  // ═══════════════════════════════════════════════════════════

  async findExams(
    tenantId: string,
    params: ListExamsParams,
  ): Promise<{ data: ExamEntity[]; total: number }> {
    const db     = this.kysely.getTenantDb(tenantId);
    const page   = params.page  ?? 1;
    const limit  = params.limit ?? 20;
    const offset = (page - 1) * limit;

    let base = db
      .selectFrom('exams')
      .where('deleted_at', 'is', null);

    if (params.search) {
      base = base.where('title', 'ilike', `%${params.search}%`);
    }
    if (params.subjectId) {
      base = base.where('subject_id', '=', sql<string>`${params.subjectId}::uuid`);
    }
    if (params.grade) {
      base = base.where('grade', '=', params.grade);
    }
    if (params.isTemplate !== undefined) {
      base = base.where('is_template', '=', params.isTemplate);
    }
    if (params.kind) {
      base = base.where('kind', '=', params.kind);
    }

    const countResult = await base
      .select(db.fn.countAll<number>().as('count'))
      .executeTakeFirst();
    const total = Number(countResult?.count ?? 0);

    const rows = await base
      .selectAll()
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .execute();

    return { data: rows.map((r: any) => this.toExam(r)), total };
  }

  async findExamById(tenantId: string, id: string): Promise<ExamEntity | null> {
    const db  = this.kysely.getTenantDb(tenantId);
    const row = await db
      .selectFrom('exams')
      .selectAll()
      .where('id', '=', sql<string>`${id}::uuid`)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    return row ? this.toExam(row) : null;
  }

  async createExam(tenantId: string, data: CreateExamData): Promise<ExamEntity> {
    const db  = this.kysely.getTenantDb(tenantId);
    const row = await db
      .insertInto('exams')
      .values({
        teacher_id:   sql<string>`${data.teacherId}::uuid`,
        subject_id:   data.subjectId ? sql<string>`${data.subjectId}::uuid` : null,
        grade:        data.grade        ?? null,
        title:        data.title,
        exam_date:    data.examDate     ?? null,
        duration_mins: data.durationMins ?? null,
        instructions: data.instructions ?? null,
        design_config: (data.designConfig ?? {}) as any,
        is_template:  data.isTemplate   ?? false,
        kind:         data.kind         ?? 'exam',
        created_by:   data.createdBy ? sql<string>`${data.createdBy}::uuid` : null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return this.toExam(row);
  }

  async saveExam(tenantId: string, exam: ExamEntity): Promise<void> {
    const db = this.kysely.getTenantDb(tenantId);
    await db
      .updateTable('exams')
      .set({
        subject_id:   exam.subjectId ? sql<string>`${exam.subjectId}::uuid` : null,
        grade:        exam.grade        ?? null,
        title:        exam.title,
        exam_date:    exam.examDate     ?? null,
        duration_mins: exam.durationMins ?? null,
        total_degree: exam.totalDegree,
        instructions: exam.instructions ?? null,
        design_config: (exam.designConfig ?? {}) as any,
        is_template:  exam.isTemplate,
        kind:         exam.kind ?? 'exam',
        updated_at:   new Date(),
        deleted_at:   exam.deletedAt    ?? null,
      })
      .where('id', '=', sql<string>`${exam.id}::uuid`)
      .execute();
  }

  // ═══════════════════════════════════════════════════════════
  // بنود الامتحان
  // ═══════════════════════════════════════════════════════════

  async findExamItems(tenantId: string, examId: string): Promise<ExamItemEntity[]> {
    const db = this.kysely.getTenantDb(tenantId);
    const rows = await db
      .selectFrom('exam_items')
      .selectAll()
      .where('exam_id', '=', sql<string>`${examId}::uuid`)
      .orderBy('sort_order', 'asc')
      .execute();
    return rows.map((r: any) => this.toItem(r));
  }

  async createExamItem(tenantId: string, data: CreateExamItemData): Promise<ExamItemEntity> {
    const db  = this.kysely.getTenantDb(tenantId);
    const row = await db
      .insertInto('exam_items')
      .values({
        exam_id:        sql<string>`${data.examId}::uuid`,
        question_id:    data.questionId ? sql<string>`${data.questionId}::uuid` : null,
        question_text:  data.questionText,
        type:           data.type           as any,
        options:        toJsonb(data.options),
        correct_answer: data.correctAnswer  ?? null,
        model_answer:   data.modelAnswer    ?? null,
        image_url:      data.imageUrl       ?? null,
        degree:         data.degree         ?? 1,
        sort_order:     data.sortOrder      ?? 0,
        section_title:  data.sectionTitle   ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return this.toItem(row);
  }

  async deleteExamItems(tenantId: string, examId: string): Promise<void> {
    const db = this.kysely.getTenantDb(tenantId);
    await db
      .deleteFrom('exam_items')
      .where('exam_id', '=', sql<string>`${examId}::uuid`)
      .execute();
  }

  async replaceExamItems(
    tenantId: string,
    examId: string,
    items: CreateExamItemData[],
  ): Promise<ExamItemEntity[]> {
    await this.deleteExamItems(tenantId, examId);
    if (items.length === 0) return [];

    const db   = this.kysely.getTenantDb(tenantId);
    const rows = await db
      .insertInto('exam_items')
      .values(items.map((item, idx) => ({
        exam_id:        sql<string>`${examId}::uuid`,
        question_id:    item.questionId ? sql<string>`${item.questionId}::uuid` : null,
        question_text:  item.questionText,
        type:           item.type           as any,
        options:        toJsonb(item.options),
        correct_answer: item.correctAnswer  ?? null,
        model_answer:   item.modelAnswer    ?? null,
        image_url:      item.imageUrl       ?? null,
        degree:         item.degree         ?? 1,
        sort_order:     item.sortOrder      ?? idx,
        section_title:  item.sectionTitle   ?? null,
      })))
      .returningAll()
      .execute();

    return rows.map((r: any) => this.toItem(r));
  }

  // ═══════════════════════════════════════════════════════════
  // توليد تلقائي — اختيار أسئلة عشوائية
  // ═══════════════════════════════════════════════════════════

  async findRandomQuestions(
    tenantId: string,
    params: { subjectId?: string; grade?: string; difficulty?: string; types?: string[]; count: number },
  ): Promise<ExamQuestionEntity[]> {
    const db = this.kysely.getTenantDb(tenantId);

    let base = db
      .selectFrom('exam_questions')
      .where('deleted_at', 'is', null);

    if (params.subjectId) {
      base = base.where('subject_id', '=', sql<string>`${params.subjectId}::uuid`);
    }
    if (params.grade) {
      base = base.where('grade', '=', params.grade);
    }
    if (params.difficulty) {
      base = base.where('difficulty', '=', params.difficulty as any);
    }
    if (params.types && params.types.length > 0) {
      base = base.where('type', 'in', params.types as any[]);
    }

    const rows = await base
      .selectAll()
      .orderBy(sql`RANDOM()`)
      .limit(params.count)
      .execute();

    return rows.map((r: any) => this.toQuestion(r));
  }

  /**
   * اختيار أسئلة لصف واحد من مواصفات التوليد.
   * الترتيب: الأسئلة اللي ماستخدمتش قريب الأول، وجوّه كل مجموعة عشوائي.
   * يعني لو البنك مش كفاية بنكمّل من المستخدم قريب بدل ما نرجع ناقص.
   */
  async findBlueprintQuestions(
    tenantId: string,
    params: BlueprintQueryParams,
  ): Promise<Array<ExamQuestionEntity & { recentlyUsed: boolean }>> {
    const db = this.kysely.getTenantDb(tenantId);

    let q = db
      .selectFrom('exam_questions as q')
      .selectAll('q')
      .where('q.deleted_at', 'is', null);

    if (params.subjectId)  q = q.where('q.subject_id', '=', sql<string>`${params.subjectId}::uuid`);
    if (params.grade)      q = q.where('q.grade', '=', params.grade);
    if (params.types && params.types.length > 0) q = q.where('q.type', 'in', params.types as any[]);
    if (params.difficulty) q = q.where('q.difficulty', '=', params.difficulty as any);
    if (params.tags && params.tags.length > 0) {
      q = q.where(sql<boolean>`q.tags && ${params.tags}::text[]`);
    }
    if (params.excludeIds.length > 0) {
      q = q.where('q.id', 'not in', params.excludeIds.map((id) => sql<string>`${id}::uuid`));
    }

    const since = params.avoidSince;
    const withRecent = since
      ? q.select((eb) => eb.exists(
          eb.selectFrom('exam_items as ei')
            .innerJoin('exams as e', 'e.id', 'ei.exam_id')
            .select(sql`1`.as('one'))
            .whereRef('ei.question_id', '=', 'q.id')
            .where('e.deleted_at', 'is', null)
            .where('e.created_at', '>=', since),
        ).as('recently_used'))
      : q.select(sql<boolean>`false`.as('recently_used'));

    const rows = await withRecent
      .orderBy('recently_used', 'asc')
      .orderBy(sql`RANDOM()`)
      .limit(params.count)
      .execute();

    return rows.map((r: any) => Object.assign(this.toQuestion(r), { recentlyUsed: Boolean(r.recently_used) }));
  }

  async getAvailability(
    tenantId: string,
    params: { subjectId?: string; grade?: string; tags?: string[] },
  ): Promise<QuestionAvailability> {
    const db = this.kysely.getTenantDb(tenantId);
    let base = db
      .selectFrom('exam_questions')
      .select(['type', 'difficulty', 'tags'])
      .where('deleted_at', 'is', null);
    if (params.subjectId) base = base.where('subject_id', '=', sql<string>`${params.subjectId}::uuid`);
    if (params.grade)     base = base.where('grade', '=', params.grade);

    const rows = await base.execute();
    const wanted = params.tags?.length ? new Set(params.tags) : null;

    const matrix = new Map<string, number>();
    const tagCounts = new Map<string, number>();
    let total = 0;
    for (const r of rows as any[]) {
      const tags: string[] = r.tags ?? [];
      // قائمة الوحدات/التاجات بتتحسب قبل فلتر التاج عشان المدرس يشوف كل الاختيارات
      for (const t of tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
      if (wanted && !tags.some((t) => wanted.has(t))) continue;
      total++;
      const key = `${r.type}|${r.difficulty}`;
      matrix.set(key, (matrix.get(key) ?? 0) + 1);
    }

    return {
      total,
      matrix: [...matrix.entries()].map(([k, count]) => {
        const [type, difficulty] = k.split('|');
        return { type, difficulty, count };
      }),
      tags: [...tagCounts.entries()]
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'ar')),
    };
  }

  // ═══════════════════════════════════════════════════════════
  // الربط بالحصص
  // ═══════════════════════════════════════════════════════════

  async findSessionForLink(tenantId: string, sessionId: string): Promise<SessionLinkInfo | null> {
    const db  = this.kysely.getTenantDb(tenantId);
    const row = await db
      .selectFrom('sessions')
      .select(['id', 'type', 'status', 'out_of', 'exam_id', 'title'])
      .where('id', '=', sql<string>`${sessionId}::uuid`)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    if (!row) return null;
    return {
      id:     row.id,
      type:   row.type as string,
      status: row.status as string,
      outOf:  row.out_of !== null && row.out_of !== undefined ? Number(row.out_of) : null,
      examId: (row as any).exam_id ?? null,
      title:  row.title,
    };
  }

  async maxDegreeInSession(tenantId: string, sessionId: string): Promise<number | null> {
    const db  = this.kysely.getTenantDb(tenantId);
    const row = await db
      .selectFrom('attendance')
      .select((eb) => eb.fn.max('degree').as('max'))
      .where('session_id', '=', sql<string>`${sessionId}::uuid`)
      .executeTakeFirst();
    const v = (row as any)?.max;
    return v === null || v === undefined ? null : Number(v);
  }

  async setSessionExam(tenantId: string, sessionId: string, examId: string | null, outOf: number | null): Promise<void> {
    const db = this.kysely.getTenantDb(tenantId);
    const set: Record<string, any> = {
      exam_id:    examId ? sql<string>`${examId}::uuid` : null,
      updated_at: new Date(),
    };
    if (outOf !== null) set.out_of = outOf;
    await db
      .updateTable('sessions')
      .set(set as any)
      .where('id', '=', sql<string>`${sessionId}::uuid`)
      .execute();
  }

  async syncLinkedSessionsOutOf(tenantId: string, examId: string, totalDegree: number): Promise<number> {
    if (!(totalDegree > 0)) return 0;
    const db  = this.kysely.getTenantDb(tenantId);
    const res = await db
      .updateTable('sessions as s')
      .set({ out_of: totalDegree, updated_at: new Date() } as any)
      .where('s.exam_id', '=', sql<string>`${examId}::uuid`)
      .where('s.deleted_at', 'is', null)
      .where('s.status', 'in', ['scheduled', 'ongoing'])
      .where((eb) => eb.not(eb.exists(
        eb.selectFrom('attendance as a')
          .select(sql`1`.as('one'))
          .whereRef('a.session_id', '=', 's.id')
          .where('a.degree', '>', totalDegree),
      )))
      .executeTakeFirst();
    return Number(res?.numUpdatedRows ?? 0);
  }

  async findLinkedSessions(tenantId: string, examId: string) {
    const db   = this.kysely.getTenantDb(tenantId);
    const rows = await db
      .selectFrom('sessions')
      .leftJoin('groups', 'groups.id', 'sessions.group_id')
      .select(['sessions.id', 'sessions.title', 'sessions.start_date', 'sessions.status', 'groups.name as group_name'])
      .where('sessions.exam_id', '=', sql<string>`${examId}::uuid`)
      .where('sessions.deleted_at', 'is', null)
      .orderBy('sessions.start_date', 'desc')
      .limit(50)
      .execute();
    return rows.map((r: any) => ({
      id: r.id, title: r.title, startDate: r.start_date, status: r.status, groupName: r.group_name ?? null,
    }));
  }

  // ═══════════════════════════════════════════════════════════
  // Mappers
  // ═══════════════════════════════════════════════════════════

  private toQuestion(row: any): ExamQuestionEntity {
    return new ExamQuestionEntity({
      id:            row.id,
      teacherId:     row.teacher_id,
      subjectId:     row.subject_id    ?? null,
      grade:         row.grade         ?? null,
      type:          row.type,
      questionText:  row.question_text,
      imageUrl:      row.image_url     ?? null,
      options:       row.options       ?? null,
      correctAnswer: row.correct_answer ?? null,
      modelAnswer:   row.model_answer  ?? null,
      difficulty:    row.difficulty,
      tags:          row.tags          ?? [],
      defaultDegree: Number(row.default_degree),
      timesUsed:     Number(row.times_used ?? 0),
      createdBy:     row.created_by    ?? null,
      createdAt:     row.created_at,
      updatedAt:     row.updated_at,
      deletedAt:     row.deleted_at    ?? null,
    });
  }

  private toExam(row: any): ExamEntity {
    return new ExamEntity({
      id:           row.id,
      teacherId:    row.teacher_id,
      subjectId:    row.subject_id    ?? null,
      grade:        row.grade         ?? null,
      title:        row.title,
      examDate:     row.exam_date     ?? null,
      durationMins: row.duration_mins ? Number(row.duration_mins) : null,
      totalDegree:  Number(row.total_degree ?? 0),
      instructions: row.instructions  ?? null,
      designConfig: row.design_config ?? {},
      isTemplate:   Boolean(row.is_template),
      kind:         row.kind === 'quiz' ? 'quiz' : 'exam',
      createdBy:    row.created_by    ?? null,
      createdAt:    row.created_at,
      updatedAt:    row.updated_at,
      deletedAt:    row.deleted_at    ?? null,
    });
  }

  private toItem(row: any): ExamItemEntity {
    return new ExamItemEntity({
      id:           row.id,
      examId:       row.exam_id,
      questionId:   row.question_id   ?? null,
      questionText: row.question_text,
      type:         row.type,
      options:      row.options       ?? null,
      correctAnswer: row.correct_answer ?? null,
      modelAnswer:  row.model_answer  ?? null,
      imageUrl:     row.image_url     ?? null,
      degree:       Number(row.degree ?? 1),
      sortOrder:    Number(row.sort_order ?? 0),
      sectionTitle: row.section_title ?? null,
      createdAt:    row.created_at,
    });
  }
}
