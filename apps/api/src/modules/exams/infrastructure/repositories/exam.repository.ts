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
} from '../../domain/repositories/exam.repository.interface';

@Injectable()
export class ExamRepository implements IExamRepository {
  constructor(private readonly kysely: KyselyService) {}

  // ═══════════════════════════════════════════════════════════
  // بنك الأسئلة
  // ═══════════════════════════════════════════════════════════

  async findQuestions(
    tenantId: string,
    teacherId: string,
    params: ListQuestionsParams,
  ): Promise<{ data: ExamQuestionEntity[]; total: number }> {
    const db     = this.kysely.getTenantDb(tenantId);
    const page   = params.page  ?? 1;
    const limit  = params.limit ?? 20;
    const offset = (page - 1) * limit;

    let base = db
      .selectFrom('exam_questions')
      .where('deleted_at', 'is', null)
      .where('teacher_id', '=', sql<string>`${teacherId}::uuid`);

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
      base = base.where(sql<boolean>`tags && ${JSON.stringify(params.tags)}::text[]`);
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
        options:        data.options        ?? null,
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
        options:        question.options        ?? null,
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
    teacherId: string,
    params: ListExamsParams,
  ): Promise<{ data: ExamEntity[]; total: number }> {
    const db     = this.kysely.getTenantDb(tenantId);
    const page   = params.page  ?? 1;
    const limit  = params.limit ?? 20;
    const offset = (page - 1) * limit;

    let base = db
      .selectFrom('exams')
      .where('deleted_at', 'is', null)
      .where('teacher_id', '=', sql<string>`${teacherId}::uuid`);

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
        options:        data.options        ?? null,
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
        options:        item.options        ?? null,
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
    teacherId: string,
    params: { subjectId?: string; grade?: string; difficulty?: string; types?: string[]; count: number },
  ): Promise<ExamQuestionEntity[]> {
    const db = this.kysely.getTenantDb(tenantId);

    let base = db
      .selectFrom('exam_questions')
      .where('deleted_at', 'is', null)
      .where('teacher_id', '=', sql<string>`${teacherId}::uuid`);

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
