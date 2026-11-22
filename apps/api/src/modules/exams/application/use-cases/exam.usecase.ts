import { Injectable, Logger, Inject } from '@nestjs/common';
import { Response } from 'express';
import { EXAM_REPOSITORY, IExamRepository, CreateExamItemData } from '../../domain/repositories/exam.repository.interface';
import { ExamQuestionEntity, ExamEntity, ExamItemEntity } from '../../domain/entities/exam.entity';
import { AppError } from '../../../../core/errors/app.error';
import { PdfExportService } from '../../../../shared/infrastructure/export/pdf-export.service';
import { EMBEDDED_CAIRO_CSS } from '../../../../shared/infrastructure/export/embedded-cairo.font';
import { StorageService } from '../../../../shared/infrastructure/storage/storage.service';
import type {
  ListQuestionsDto,
  CreateQuestionDto,
  UpdateQuestionDto,
  ListExamsDto,
  CreateExamDto,
  UpdateExamDto,
  SaveExamItemsDto,
  GenerateExamDto,
  ImportOptionsDto,
} from '../dtos/exam.dto';
import { CreateQuestionSchema } from '../dtos/exam.dto';
import * as ExcelJS from 'exceljs';
import {
  parseQuestionsText,
  parseQuestionsSheet,
  ParseResult,
  SHEET_HEADERS,
  TYPE_LABELS,
  DIFFICULTY_LABELS,
} from '../services/question-import.parser';

export interface ImportReport {
  dryRun:     boolean;
  /** كل اللي اتلقى في الملف/النص (صالح + فيه مشاكل) */
  found:      number;
  /** الصالح والجديد (هيتضاف / اتضاف) */
  valid:      number;
  duplicates: number;
  created:    number;
  errors:     Array<{ ref: number; message: string }>;
  preview:    Array<Record<string, unknown>>;
}

/** قيمة خلية Excel → نص (rich text / formula / hyperlink / أرقام) */
function cellText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const o = v as any;
  if (Array.isArray(o.richText)) return o.richText.map((t: any) => t.text ?? '').join('');
  if (o.text !== undefined) return String(o.text);
  if (o.result !== undefined) return cellText(o.result);
  return '';
}

export interface GenerateReport {
  requested:    number;
  picked:       number;
  /** كام سؤال اتاخد رغم إنه اتستخدم في امتحان قريب (لأن البنك مكانش فيه غيره) */
  recentlyUsed: number;
  shortfalls:   Array<{ row: number; requested: number; found: number }>;
}

@Injectable()
export class ExamUseCase {
  private readonly logger = new Logger(ExamUseCase.name);

  constructor(
    @Inject(EXAM_REPOSITORY)
    private readonly repo: IExamRepository,
    private readonly pdf: PdfExportService,
    private readonly storage: StorageService,
  ) {}

  // ═══════════════════════════════════════════════════════════
  // بنك الأسئلة
  // ═══════════════════════════════════════════════════════════

  async listQuestions(
    tenantId: string,
    teacherId: string,
    params: ListQuestionsDto,
  ): Promise<{ data: ExamQuestionEntity[]; total: number; page: number; limit: number }> {
    // البنك مشترك على مستوى الحساب كله (المدرس ومساعدينه) — teacherId بيتسجّل كمنشئ بس
    void teacherId;
    const result = await this.repo.findQuestions(tenantId, params);
    return { ...result, page: params.page ?? 1, limit: params.limit ?? 20 };
  }

  async getQuestion(tenantId: string, teacherId: string, id: string): Promise<ExamQuestionEntity> {
    const question = await this.repo.findQuestionById(tenantId, id);
    if (!question) throw new AppError('NOT_FOUND', 'السؤال غير موجود', 404);
    void teacherId;
    return question;
  }

  async createQuestion(
    tenantId: string,
    teacherId: string,
    data: CreateQuestionDto,
  ): Promise<ExamQuestionEntity> {
    return this.repo.createQuestion(tenantId, {
      ...data,
      teacherId,
      createdBy: teacherId,
    });
  }

  async updateQuestion(
    tenantId: string,
    teacherId: string,
    id: string,
    data: UpdateQuestionDto,
  ): Promise<ExamQuestionEntity> {
    const question = await this.getQuestion(tenantId, teacherId, id);
    question.update(data);
    await this.repo.saveQuestion(tenantId, question);
    return question;
  }

  async deleteQuestion(tenantId: string, teacherId: string, id: string): Promise<void> {
    const question = await this.getQuestion(tenantId, teacherId, id);
    question.softDelete();
    await this.repo.saveQuestion(tenantId, question);
  }

  // ═══════════════════════════════════════════════════════════
  // الامتحانات
  // ═══════════════════════════════════════════════════════════

  async listExams(
    tenantId: string,
    teacherId: string,
    params: ListExamsDto,
  ): Promise<{ data: ExamEntity[]; total: number; page: number; limit: number }> {
    void teacherId;
    const result = await this.repo.findExams(tenantId, params);
    return { ...result, page: params.page ?? 1, limit: params.limit ?? 20 };
  }

  async getExam(
    tenantId: string,
    teacherId: string,
    id: string,
  ): Promise<{ exam: ExamEntity; items: ExamItemEntity[] }> {
    const exam = await this.repo.findExamById(tenantId, id);
    if (!exam) throw new AppError('NOT_FOUND', 'الامتحان غير موجود', 404);
    void teacherId;
    const items = await this.repo.findExamItems(tenantId, id);
    return { exam, items };
  }

  async createExam(tenantId: string, teacherId: string, data: CreateExamDto): Promise<ExamEntity> {
    return this.repo.createExam(tenantId, {
      ...data,
      teacherId,
      createdBy: teacherId,
    });
  }

  async updateExam(
    tenantId: string,
    teacherId: string,
    id: string,
    data: UpdateExamDto,
  ): Promise<ExamEntity> {
    const exam = await this._getExamOwned(tenantId, teacherId, id);
    exam.update(data);
    await this.repo.saveExam(tenantId, exam);
    return exam;
  }

  async deleteExam(tenantId: string, teacherId: string, id: string): Promise<void> {
    const exam = await this._getExamOwned(tenantId, teacherId, id);
    exam.softDelete();
    await this.repo.saveExam(tenantId, exam);
  }

  // ═══════════════════════════════════════════════════════════
  // بنود الامتحان (الأسئلة داخل الامتحان)
  // ═══════════════════════════════════════════════════════════

  async saveExamItems(
    tenantId: string,
    teacherId: string,
    examId: string,
    dto: SaveExamItemsDto,
  ): Promise<{ exam: ExamEntity; items: ExamItemEntity[] }> {
    const exam = await this._getExamOwned(tenantId, teacherId, examId);

    const itemsData: CreateExamItemData[] = dto.items.map((item, idx) => ({
      examId,
      questionId:    item.questionId ?? null,
      questionText:  item.questionText,
      type:          item.type,
      options:       item.options ?? null,
      correctAnswer: item.correctAnswer ?? null,
      modelAnswer:   item.modelAnswer   ?? null,
      imageUrl:      item.imageUrl      ?? null,
      degree:        item.degree        ?? 1,
      sortOrder:     item.sortOrder     ?? idx,
      sectionTitle:  item.sectionTitle  ?? null,
    }));

    const items = await this.repo.replaceExamItems(tenantId, examId, itemsData);

    // إعادة حساب المجموع الكلي وحفظه
    exam.recalculateTotalDegree(items);
    await this.repo.saveExam(tenantId, exam);

    // الحصص المربوطة بالامتحان (لسه مفتوحة) تاخد المجموع الجديد كدرجة نهائية
    await this.repo.syncLinkedSessionsOutOf(tenantId, examId, exam.totalDegree);

    return { exam, items };
  }

  // ═══════════════════════════════════════════════════════════
  // توليد امتحان تلقائي من البنك
  // ═══════════════════════════════════════════════════════════

  async generateExamAuto(
    tenantId: string,
    teacherId: string,
    dto: GenerateExamDto,
  ): Promise<{ exam: ExamEntity; items: ExamItemEntity[]; report: GenerateReport }> {
    // لو مفيش مواصفات تفصيلية → صف واحد بالطريقة القديمة (عدد + مستوى + أنواع)
    const rows = dto.blueprint?.length
      ? dto.blueprint.map((r) => ({
          types:        r.type ? [r.type] : undefined,
          difficulty:   r.difficulty ?? undefined,
          count:        r.count,
          degree:       r.degree ?? undefined,
          tags:         r.tags?.length ? r.tags : undefined,
          sectionTitle: r.sectionTitle?.trim() || null,
        }))
      : [{
          types:        dto.questionTypes?.length ? dto.questionTypes : undefined,
          difficulty:   dto.difficulty ?? undefined,
          count:        dto.count,
          degree:       undefined,
          tags:         undefined,
          sectionTitle: null,
        }];

    const totalRequested = rows.reduce((s, r) => s + r.count, 0);
    if (totalRequested > 150) {
      throw new AppError('VALIDATION_ERROR', 'أقصى عدد أسئلة في الامتحان الواحد 150 سؤال', 400);
    }

    const avoidSince = dto.avoidRecentDays > 0
      ? new Date(Date.now() - dto.avoidRecentDays * 24 * 60 * 60 * 1000)
      : undefined;

    const pickedIds: string[] = [];
    const itemsData: CreateExamItemData[] = [];
    const shortfalls: GenerateReport['shortfalls'] = [];
    let recentlyUsed = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const questions = await this.repo.findBlueprintQuestions(tenantId, {
        subjectId:  dto.subjectId ?? undefined,
        grade:      dto.grade     ?? undefined,
        tags:       row.tags ?? (dto.tags?.length ? dto.tags : undefined),
        types:      row.types,
        difficulty: row.difficulty,
        count:      row.count,
        excludeIds: pickedIds,
        avoidSince,
      });

      if (questions.length < row.count) {
        shortfalls.push({ row: i + 1, requested: row.count, found: questions.length });
      }

      questions.forEach((q, idx) => {
        pickedIds.push(q.id);
        if (q.recentlyUsed) recentlyUsed++;
        itemsData.push({
          examId:        '',
          questionId:    q.id,
          questionText:  q.questionText,
          type:          q.type,
          options:       q.options       ?? null,
          correctAnswer: q.correctAnswer ?? null,
          modelAnswer:   q.modelAnswer   ?? null,
          imageUrl:      q.imageUrl      ?? null,
          // أولوية الدرجة: درجة الصف ← الدرجة الموحّدة ← درجة السؤال في البنك
          degree:        row.degree ?? dto.degreePerQuestion ?? q.defaultDegree,
          sortOrder:     itemsData.length,
          // عنوان القسم بيتحط على أول سؤال في الصف بس
          sectionTitle:  idx === 0 ? row.sectionTitle : null,
        });
      });
    }

    if (itemsData.length === 0) {
      throw new AppError('NOT_FOUND', 'لا توجد أسئلة تطابق المواصفات المحددة في بنك الأسئلة', 404);
    }

    const exam = await this.repo.createExam(tenantId, {
      teacherId,
      title:        dto.title,
      kind:         dto.kind,
      subjectId:    dto.subjectId    ?? null,
      grade:        dto.grade        ?? null,
      examDate:     dto.examDate     ?? null,
      durationMins: dto.durationMins ?? null,
      instructions: dto.instructions ?? null,
      createdBy:    teacherId,
    });

    const items = await this.repo.replaceExamItems(
      tenantId,
      exam.id,
      itemsData.map((it) => ({ ...it, examId: exam.id })),
    );

    exam.recalculateTotalDegree(items);
    await this.repo.saveExam(tenantId, exam);

    return {
      exam,
      items,
      report: { requested: totalRequested, picked: items.length, recentlyUsed, shortfalls },
    };
  }

  // ═══════════════════════════════════════════════════════════
  // ربط الامتحان بحصة — الدرجة النهائية للحصة = مجموع الامتحان
  // ═══════════════════════════════════════════════════════════

  async linkSession(tenantId: string, teacherId: string, examId: string, sessionId: string) {
    const exam    = await this._getExamOwned(tenantId, teacherId, examId);
    const session = await this.repo.findSessionForLink(tenantId, sessionId);
    if (!session) throw new AppError('NOT_FOUND', 'الحصة غير موجودة', 404);
    if (!GRADED_SESSION_TYPES.includes(session.type)) {
      throw new AppError('INVALID_SESSION_TYPE', 'اربط الامتحان بحصة فيها درجات (امتحان / مراجعة / حصة بامتحان)', 400);
    }
    if (session.status === 'cancelled') {
      throw new AppError('SESSION_CANCELLED', 'الحصة دي ملغية', 400);
    }
    if (!(exam.totalDegree > 0)) {
      throw new AppError('EXAM_EMPTY', 'الامتحان لسه مفيهوش أسئلة — ضيف أسئلة الأول', 400);
    }
    const maxDegree = await this.repo.maxDegreeInSession(tenantId, sessionId);
    if (maxDegree !== null && maxDegree > exam.totalDegree) {
      throw new AppError(
        'DEGREE_CONFLICT',
        `فيه درجات متسجلة في الحصة (${maxDegree}) أكبر من مجموع الامتحان (${exam.totalDegree}) — عدّلها الأول`,
        400,
      );
    }
    await this.repo.setSessionExam(tenantId, sessionId, exam.id, exam.totalDegree);
    return { sessionId, examId: exam.id, outOf: exam.totalDegree };
  }

  async unlinkSession(tenantId: string, sessionId: string): Promise<void> {
    const session = await this.repo.findSessionForLink(tenantId, sessionId);
    if (!session) throw new AppError('NOT_FOUND', 'الحصة غير موجودة', 404);
    // الدرجة النهائية بتفضل زي ما هي — بس الربط بيتشال
    await this.repo.setSessionExam(tenantId, sessionId, null, null);
  }

  /** الامتحان المربوط بحصة (أو null) */
  async getSessionExam(tenantId: string, sessionId: string) {
    const session = await this.repo.findSessionForLink(tenantId, sessionId);
    if (!session) throw new AppError('NOT_FOUND', 'الحصة غير موجودة', 404);
    if (!session.examId) return null;
    const exam = await this.repo.findExamById(tenantId, session.examId);
    if (!exam) return null;
    return { id: exam.id, title: exam.title, kind: exam.kind, totalDegree: exam.totalDegree };
  }

  async getLinkedSessions(tenantId: string, examId: string) {
    return this.repo.findLinkedSessions(tenantId, examId);
  }

  // ═══════════════════════════════════════════════════════════
  // استيراد أسئلة
  // ═══════════════════════════════════════════════════════════

  async importFromText(tenantId: string, teacherId: string, text: string, opts: ImportOptionsDto): Promise<ImportReport> {
    return this._import(tenantId, teacherId, parseQuestionsText(text), opts);
  }

  async importFromExcel(tenantId: string, teacherId: string, buffer: Buffer, opts: ImportOptionsDto): Promise<ImportReport> {
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(buffer as any);
    } catch {
      throw new AppError('INVALID_FILE', 'الملف مش Excel صالح (.xlsx) — نزّل القالب واملأه', 400);
    }
    const ws = wb.worksheets[0];
    if (!ws) throw new AppError('INVALID_FILE', 'الملف فاضي', 400);
    if (ws.rowCount > 1002) throw new AppError('TOO_MANY_ROWS', 'أقصى عدد 1000 سؤال في الملف الواحد', 400);

    const rows: string[][] = [];
    ws.eachRow({ includeEmpty: true }, (row) => {
      const vals: string[] = [];
      for (let c = 1; c <= Math.min(ws.columnCount, 20); c++) vals.push(cellText(row.getCell(c).value));
      rows.push(vals);
    });
    return this._import(tenantId, teacherId, parseQuestionsSheet(rows), opts);
  }

  /** قالب Excel جاهز بالأعمدة + أمثلة + قوائم منسدلة للنوع والمستوى */
  async buildImportTemplate(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Nabgha';
    const ws = wb.addWorksheet('الأسئلة', { views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }] });
    ws.columns = SHEET_HEADERS.map((h, i) => ({ header: h, width: [14, 50, 18, 18, 18, 18, 16, 34, 10, 8, 24][i] }));
    const head = ws.getRow(1);
    head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E3B2E' } };
    head.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    head.height = 28;

    const examples: string[][] = [
      ['اختياري', 'عاصمة جمهورية مصر العربية هي:', 'القاهرة', 'الإسكندرية', 'أسوان', 'الأقصر', 'أ', '', 'سهل', '1', 'الوحدة الأولى'],
      ['صح وخطأ', 'يغلي الماء عند 100 درجة مئوية عند مستوى سطح البحر.', '', '', '', '', 'صح', '', 'سهل', '1', 'الوحدة الأولى'],
      ['أكمل', 'ناتج 7 × 8 = ........', '', '', '', '', '56', '', 'متوسط', '1', 'الوحدة الثانية'],
      ['مقالي', 'اشرح دورة الماء في الطبيعة.', '', '', '', '', '', 'تبخر ← تكاثف ← هطول', 'صعب', '3', 'الوحدة الثانية'],
    ];
    examples.forEach((r) => ws.addRow(r));
    for (let r = 2; r <= 1001; r++) {
      ws.getCell(`A${r}`).dataValidation = {
        type: 'list', allowBlank: true, formulae: [`"${Object.values(TYPE_LABELS).join(',')}"`],
      };
      ws.getCell(`I${r}`).dataValidation = {
        type: 'list', allowBlank: true, formulae: [`"${Object.values(DIFFICULTY_LABELS).join(',')}"`],
      };
    }
    ws.getColumn(2).alignment = { wrapText: true, vertical: 'top' };

    const help = wb.addWorksheet('طريقة الملء', { views: [{ rightToLeft: true }] });
    help.getColumn(1).width = 110;
    [
      'امسح صفوف الأمثلة واكتب أسئلتك — كل سؤال في صف.',
      'نوع السؤال: اختياري / صح وخطأ / أكمل / مقالي (لو سبته فاضي البرنامج بيستنتجه).',
      'الاختياري: اكتب من 2 لـ 4 اختيارات، والإجابة الصحيحة حرف (أ/ب/ج/د) أو رقم (1-4) أو نص الاختيار نفسه.',
      'صح وخطأ: الإجابة الصحيحة "صح" أو "خطأ".',
      'أكمل: حط نقط (........) مكان الفراغ، واكتب الكلمة الناقصة في عمود الإجابة الصحيحة.',
      'مقالي: اكتب الإجابة النموذجية في عمود "الإجابة النموذجية / الشرح" (اختياري).',
      'المستوى والدرجة والوحدة اختياريين — لو فاضيين بياخدوا الإعدادات اللي هتختارها في البرنامج وقت الاستيراد.',
      'الوحدة / التاجات: ممكن أكتر من واحدة بينهم فاصلة (مثال: الوحدة الأولى، الدرس الثاني).',
      'الأسئلة المكررة (نفس النص موجود في البنك) بتتخطى تلقائياً.',
    ].forEach((t, i) => { const c = help.getCell(`A${i + 1}`); c.value = `${i + 1}. ${t}`; c.alignment = { wrapText: true }; });

    const out = await wb.xlsx.writeBuffer();
    return Buffer.from(out as ArrayBuffer);
  }

  private async _import(tenantId: string, teacherId: string, parsed: ParseResult, opts: ImportOptionsDto): Promise<ImportReport> {
    const errors = [...parsed.errors];
    const normalize = (s: string) => s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

    // تحقق نهائي بنفس قواعد إضافة السؤال يدوي
    const valid: Array<ReturnType<typeof CreateQuestionSchema.parse> & { ref: number }> = [];
    for (const q of parsed.questions) {
      const candidate = {
        type:          q.type,
        questionText:  normalize(q.questionText),
        subjectId:     opts.subjectId ?? null,
        grade:         opts.grade     ?? null,
        options:       q.options,
        correctAnswer: q.correctAnswer,
        modelAnswer:   q.modelAnswer,
        difficulty:    q.difficulty    ?? opts.difficulty,
        tags:          q.tags?.length ? q.tags : opts.tags,
        defaultDegree: q.defaultDegree ?? opts.defaultDegree,
      };
      const res = CreateQuestionSchema.safeParse(candidate);
      if (!res.success) {
        errors.push({ ref: q.ref, message: res.error.issues[0]?.message ?? 'بيانات غير صالحة' });
        continue;
      }
      valid.push({ ...res.data, ref: q.ref });
    }

    // منع التكرار: جوّه نفس الملف + مع اللي موجود في البنك
    const seen = new Set<string>();
    const existing = await this.repo.findExistingQuestionTexts(tenantId, [...new Set(valid.map((v) => v.questionText))]);
    const fresh = valid.filter((v) => {
      if (existing.has(v.questionText) || seen.has(v.questionText)) return false;
      seen.add(v.questionText);
      return true;
    });
    const duplicates = valid.length - fresh.length;

    let created = 0;
    if (!opts.dryRun && fresh.length > 0) {
      created = await this.repo.createQuestionsBulk(
        tenantId,
        fresh.map(({ ref: _ref, ...q }) => ({ ...q, teacherId, createdBy: teacherId })),
      );
    }

    return {
      dryRun:     !!opts.dryRun,
      found:      parsed.questions.length + parsed.errors.length,
      valid:      fresh.length,
      duplicates,
      created,
      errors:     errors.sort((a, b) => a.ref - b.ref).slice(0, 200),
      preview:    fresh.slice(0, 100).map((q) => ({
        ref: q.ref, type: q.type, questionText: q.questionText, options: q.options ?? null,
        correctAnswer: q.correctAnswer ?? null, difficulty: q.difficulty, defaultDegree: q.defaultDegree, tags: q.tags,
      })),
    };
  }

  /** الأسئلة المتاحة في البنك لكل نوع × مستوى + قائمة الوحدات — لواجهة المواصفات */
  async getAvailability(
    tenantId: string,
    params: { subjectId?: string; grade?: string; tags?: string[] },
  ) {
    return this.repo.getAvailability(tenantId, params);
  }

  // ═══════════════════════════════════════════════════════════
  // توليد PDF
  // ═══════════════════════════════════════════════════════════

  async generatePdf(
    tenantId: string,
    teacherId: string,
    examId: string,
    res: Response,
    opts: { answerKey?: boolean; version?: number } = {},
  ): Promise<void> {
    const { exam, items: baseItems } = await this.getExam(tenantId, teacherId, examId);
    const answerKey = !!opts.answerKey;
    const version   = opts.version;

    // النماذج (أ/ب/ج/د): نفس الأسئلة بترتيب مختلف + ترتيب اختيارات مختلف.
    // الترتيب ثابت لكل (امتحان × نموذج) فنموذج الإجابة بيطابق ورقة الطالب دايماً.
    const items  = version !== undefined ? applyVersion(baseItems, exam.id, version) : baseItems;
    const images = await this._loadImages(items);
    const html   = this._buildExamHtml(exam, items, images, { answerKey, version });

    // نفس متصفح Puppeteer المشترك بتاع التقارير (بدل ما نفتح Chrome جديد مع كل امتحان)
    const pdfBuffer = await this.pdf.renderHtml(html, {
      margin: { top: '15mm', bottom: '15mm', left: '14mm', right: '14mm' },
    });

    const vSuffix  = version !== undefined ? `-${'ABCD'[version]}` : '';
    const filename = `${answerKey ? 'answer-key' : 'exam'}-${exam.id.slice(0, 8)}${vSuffix}.pdf`;
    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      pdfBuffer.length.toString(),
    });
    res.send(pdfBuffer);
  }

  // ═══════════════════════════════════════════════════════════
  // مساعدات داخلية
  // ═══════════════════════════════════════════════════════════

  private async _getExamOwned(tenantId: string, teacherId: string, id: string): Promise<ExamEntity> {
    const exam = await this.repo.findExamById(tenantId, id);
    if (!exam) throw new AppError('NOT_FOUND', 'الامتحان غير موجود', 404);
    void teacherId;
    return exam;
  }

  private _buildExamHtml(
    exam: ExamEntity,
    items: ExamItemEntity[],
    images: Map<string, string>,
    opts: { answerKey: boolean; version?: number },
  ): string {
    const cfg             = (exam.designConfig ?? {}) as Record<string, any>;
    const headerColor     = safeColor(cfg.header_color, BRAND_HEADER_COLOR);
    const showDegree      = cfg.show_degree       ?? true;
    const showDate        = cfg.show_date         ?? true;
    const showStudentName = (cfg.show_student_name ?? true) && !opts.answerKey;
    const customHeader    = typeof cfg.custom_header_text === 'string' ? cfg.custom_header_text : '';

    const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
    const questionsHtml = sorted
      .map((item, idx) => this._buildQuestionHtml(item, idx + 1, showDegree, images, opts.answerKey))
      .join('\n');

    const examDate = exam.examDate
      ? new Date(exam.examDate).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
      : '...............';

    const title = opts.answerKey ? `${exam.title} — نموذج الإجابة` : exam.title;

    return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>${esc(title)}</title>
  <style>
    ${EMBEDDED_CAIRO_CSS}
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'NabghaCairo', 'Cairo', Tahoma, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.8;
      color: #1a1a1a;
      background: #fff;
    }
    .exam-header {
      background: ${headerColor};
      color: white;
      padding: 18px 24px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .exam-title { font-size: 22px; font-weight: 700; margin-bottom: 6px; }
    .exam-meta  { font-size: 13px; opacity: 0.92; display: flex; gap: 24px; flex-wrap: wrap; }
    .version-tag { background: rgba(255,255,255,0.18); border-radius: 6px; padding: 0 10px; font-weight: 700; }
    .key-badge  { display: inline-block; background: #fff; color: ${headerColor}; border-radius: 999px; padding: 0 12px; font-size: 12px; font-weight: 700; margin-bottom: 6px; }
    .info-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 20px;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 12px 16px;
      font-size: 13px;
    }
    .info-value { border-bottom: 1px dotted #9ca3af; min-width: 160px; display: inline-block; }
    .instructions {
      background: #f8fafc;
      border-right: 4px solid ${headerColor};
      padding: 10px 14px;
      margin-bottom: 20px;
      border-radius: 4px;
      font-size: 13px;
      white-space: pre-line;
    }
    .question-block { margin-bottom: 22px; page-break-inside: avoid; }
    .section-title {
      background: #f1f5f9;
      padding: 8px 14px;
      border-radius: 4px;
      font-weight: 700;
      font-size: 15px;
      margin-bottom: 12px;
      color: ${headerColor};
    }
    .question-text { font-weight: 600; margin-bottom: 8px; display: flex; gap: 8px; }
    .question-body { white-space: pre-line; flex: 1; }
    .question-num {
      background: ${headerColor};
      color: white;
      border-radius: 50%;
      width: 26px;
      height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      flex-shrink: 0;
    }
    .question-degree { color: #6b7280; font-size: 12px; font-weight: 400; white-space: nowrap; }
    .question-image { display: block; max-width: 70%; max-height: 260px; margin: 4px 34px 10px 0; border-radius: 4px; }
    .options-list { list-style: none; padding-right: 34px; }
    .options-list li { margin-bottom: 6px; display: flex; align-items: center; gap: 8px; }
    .option-circle { width: 18px; height: 18px; border: 2px solid #9ca3af; border-radius: 50%; flex-shrink: 0; }
    .option-circle.correct { background: ${headerColor}; border-color: ${headerColor}; }
    li.correct, .tf-option.correct { font-weight: 700; color: ${headerColor}; }
    .fill-line { border-bottom: 1px solid #9ca3af; height: 24px; margin: 4px 34px 4px 0; }
    .essay-lines { margin: 4px 34px 4px 0; }
    .essay-line { border-bottom: 1px solid #d1d5db; height: 32px; margin-bottom: 2px; }
    .tf-options { display: flex; gap: 24px; padding-right: 34px; }
    .tf-option { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 15px; }
    .answer-box {
      margin: 4px 34px 4px 0;
      border: 1px dashed ${headerColor};
      background: #f6faf8;
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 13px;
      white-space: pre-line;
    }
    .answer-box .lbl { font-weight: 700; color: ${headerColor}; }
    .footer { margin-top: 32px; text-align: center; color: #9ca3af; font-size: 11px; border-top: 1px solid #e5e7eb; padding-top: 12px; }
  </style>
</head>
<body>
  <div class="exam-header">
    ${opts.answerKey ? `<div class="key-badge">نموذج الإجابة — للمدرس فقط</div>` : ''}
    ${customHeader ? `<div style="font-size:13px;margin-bottom:6px;opacity:0.85">${esc(customHeader)}</div>` : ''}
    <div class="exam-title">${esc(exam.title)}</div>
    <div class="exam-meta">
      ${exam.grade        ? `<span>الصف: ${esc(exam.grade)}</span>` : ''}
      ${exam.durationMins ? `<span>المدة: ${exam.durationMins} دقيقة</span>` : ''}
      ${showDegree        ? `<span>المجموع: ${fmtNum(exam.totalDegree)} درجة</span>` : ''}
      ${showDate          ? `<span>التاريخ: ${examDate}</span>` : ''}
      ${opts.version !== undefined ? `<span class="version-tag">نموذج (${VERSION_LABELS[opts.version]})</span>` : ''}
    </div>
  </div>

  ${showStudentName ? `
  <div class="info-row">
    <div>اسم الطالب: <span class="info-value">&nbsp;</span></div>
    <div>رقم الجلوس / الكود: <span class="info-value">&nbsp;</span></div>
  </div>` : ''}

  ${exam.instructions && !opts.answerKey ? `<div class="instructions"><strong>تعليمات:</strong> ${esc(exam.instructions)}</div>` : ''}

  ${questionsHtml}

  <div class="footer">${opts.answerKey ? 'نهاية نموذج الإجابة' : 'انتهت الأسئلة — بالتوفيق'}</div>
</body>
</html>`;
  }

  private _buildQuestionHtml(
    item: ExamItemEntity,
    num: number,
    showDegree: boolean,
    images: Map<string, string>,
    answerKey: boolean,
  ): string {
    const degreeText   = showDegree ? `<span class="question-degree">(${fmtNum(item.degree)} ${item.degree === 1 ? 'درجة' : 'درجات'})</span>` : '';
    const sectionTitle = item.sectionTitle ? `<div class="section-title">${esc(item.sectionTitle)}</div>` : '';
    const imgSrc       = item.imageUrl ? images.get(item.imageUrl) : undefined;
    const imageHtml    = imgSrc ? `<img class="question-image" src="${imgSrc}" alt="">` : '';

    let answerArea = '';
    switch (item.type) {
      case 'mcq': {
        const options    = item.options ?? [];
        const correctIdx = answerKey ? findCorrectOptionIndex(options, item.correctAnswer) : -1;
        answerArea = `<ul class="options-list">${
          options.map((opt, i) => {
            const ok = i === correctIdx;
            return `<li class="${ok ? 'correct' : ''}"><div class="option-circle${ok ? ' correct' : ''}"></div>${OPTION_LETTERS[i] ?? (i + 1)}) ${esc(opt)}${ok ? ' ✓' : ''}</li>`;
          }).join('')
        }</ul>`;
        if (answerKey && correctIdx < 0 && item.correctAnswer) {
          answerArea += `<div class="answer-box"><span class="lbl">الإجابة:</span> ${esc(item.correctAnswer)}</div>`;
        }
        break;
      }
      case 'true_false': {
        const ans = answerKey ? normalizeTrueFalse(item.correctAnswer) : null;
        answerArea = `<div class="tf-options">
          <div class="tf-option${ans === true ? ' correct' : ''}"><div class="option-circle${ans === true ? ' correct' : ''}"></div> صح ✓</div>
          <div class="tf-option${ans === false ? ' correct' : ''}"><div class="option-circle${ans === false ? ' correct' : ''}"></div> خطأ ✗</div>
        </div>`;
        break;
      }
      case 'fill':
        answerArea = answerKey
          ? `<div class="answer-box"><span class="lbl">الإجابة:</span> ${esc(item.correctAnswer ?? item.modelAnswer ?? '—')}</div>`
          : `<div class="fill-line"></div>`;
        break;
      case 'essay':
        answerArea = answerKey
          ? `<div class="answer-box"><span class="lbl">الإجابة النموذجية:</span> ${esc(item.modelAnswer ?? item.correctAnswer ?? '—')}</div>`
          : `<div class="essay-lines">${Array(5).fill('<div class="essay-line"></div>').join('')}</div>`;
        break;
    }

    // نموذج الإجابة: لو فيه شرح/إجابة نموذجية لسؤال اختياري أو صح/غلط نعرضه تحت الاختيارات
    if (answerKey && (item.type === 'mcq' || item.type === 'true_false') && item.modelAnswer) {
      answerArea += `<div class="answer-box"><span class="lbl">توضيح:</span> ${esc(item.modelAnswer)}</div>`;
    }

    return `${sectionTitle}
<div class="question-block">
  <div class="question-text">
    <div class="question-num">${num}</div>
    <span class="question-body">${esc(item.questionText)}</span>
    ${degreeText}
  </div>
  ${imageHtml}
  ${answerArea}
</div>`;
  }

  /** يحوّل صور الأسئلة لـ data URLs — Puppeteer مش هيعرف يفتح روابط نسبية زي /storage/... */
  private async _loadImages(items: ExamItemEntity[]): Promise<Map<string, string>> {
    const map  = new Map<string, string>();
    const urls = [...new Set(items.map((i) => i.imageUrl).filter((u): u is string => !!u))];
    await Promise.all(urls.map(async (url) => {
      if (/^https?:\/\//i.test(url)) { map.set(url, esc(url)); return; }
      const buf = await this.storage.getFileBuffer(url);
      if (!buf) return;
      map.set(url, `data:${sniffImageMime(buf)};base64,${buf.toString('base64')}`);
    }));
    return map;
  }
}

// ═══════════════════════════════════════════════════════════
// Helpers (module-level)
// ═══════════════════════════════════════════════════════════

const BRAND_HEADER_COLOR = '#0E3B2E';
const GRADED_SESSION_TYPES = ['lesson_revision', 'lesson_exam', 'exam', 'grade_exam'];
export const VERSION_LABELS = ['أ', 'ب', 'ج', 'د'];
const OPTION_LETTERS     = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح'];

/** Escape لأي نص جاي من المستخدم قبل ما يدخل HTML — بيمنع حقن سكريبت جوّه Puppeteer */
export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** لون الهيدر بييجي من إعدادات التصميم — نقبل hex بس عشان محدش يحقن CSS */
export function safeColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim()) ? value.trim() : fallback;
}

function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

/**
 * الإجابة الصحيحة في الاختياري ممكن تكون متسجلة كنص الاختيار نفسه، أو كحرف (أ/ب/ج)،
 * أو كرقم (1/2/3) — بندوّر بالترتيب ده.
 */
export function findCorrectOptionIndex(options: string[], correct: string | null): number {
  if (!correct) return -1;
  const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
  const target = norm(correct);
  const byText = options.findIndex((o) => norm(o) === target);
  if (byText >= 0) return byText;
  const letter = target.replace(/[)\-.:]/g, '').trim();
  const byLetter = OPTION_LETTERS.findIndex((l) => l === letter);
  if (byLetter >= 0 && byLetter < options.length) return byLetter;
  const asNum = Number(letter);
  if (Number.isInteger(asNum) && asNum >= 1 && asNum <= options.length) return asNum - 1;
  return -1;
}

export function normalizeTrueFalse(value: string | null): boolean | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (['صح', 'صحيح', 'true', 't', '1', '✓', 'yes'].includes(v)) return true;
  if (['خطأ', 'خطا', 'غلط', 'false', 'f', '0', '✗', 'no'].includes(v)) return false;
  return null;
}

function sniffImageMime(buf: Buffer): string {
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf.length > 11 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'image/webp';
  return 'application/octet-stream';
}

// ═══════════════════════════════════════════════════════════
// النماذج المختلفة — خلط ثابت (deterministic) بالـ seed
// ═══════════════════════════════════════════════════════════

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(arr: T[], rnd: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** اختيارات زي "كل ما سبق" لازم تفضل في الآخر عشان المعنى مايبوظش */
const PINNED_OPTION = /(ما\s*سبق|مما\s*سبق|كل\s*ما\s*سبق|جميع\s*ما\s*سبق|all of the above|none of the above|both)/i;

/**
 * نموذج رقم 0 (أ) = الترتيب الأصلي. باقي النماذج:
 * - الأسئلة بتتخلط جوّه كل قسم (القسم بيبدأ عند أي سؤال عليه عنوان قسم) — الأقسام نفسها مكانها ثابت
 * - اختيارات الاختياري بتتخلط (الإجابة الصحيحة متخزنة كنص فبتفضل صح؛ لو كانت حرف/رقم بنحوّلها لنص)
 */
export function applyVersion(items: ExamItemEntity[], examId: string, version: number): ExamItemEntity[] {
  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  if (version === 0) return sorted;
  const rnd = mulberry32(hashSeed(`${examId}:${version}`));

  // تقسيم لأقسام
  const sections: ExamItemEntity[][] = [];
  for (const it of sorted) {
    if (it.sectionTitle || sections.length === 0) sections.push([]);
    sections[sections.length - 1].push(it);
  }

  const out: ExamItemEntity[] = [];
  for (const sec of sections) {
    const title = sec[0].sectionTitle;
    const shuffled = shuffleInPlace([...sec], rnd).map((it, i) => {
      const copy = new ExamItemEntity({ ...it, sectionTitle: i === 0 ? title : null });
      if (it.type === 'mcq' && it.options && it.options.length > 1) {
        const correctIdx = findCorrectOptionIndex(it.options, it.correctAnswer);
        const movable = it.options.filter((o) => !PINNED_OPTION.test(o));
        const pinned  = it.options.filter((o) => PINNED_OPTION.test(o));
        copy.options = [...shuffleInPlace([...movable], rnd), ...pinned];
        if (correctIdx >= 0) copy.correctAnswer = it.options[correctIdx];
      }
      return copy;
    });
    out.push(...shuffled);
  }
  return out.map((it, i) => Object.assign(it, { sortOrder: i }));
}
