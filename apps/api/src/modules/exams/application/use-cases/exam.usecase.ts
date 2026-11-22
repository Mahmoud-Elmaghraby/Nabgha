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
} from '../dtos/exam.dto';

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

    return { exam, items };
  }

  // ═══════════════════════════════════════════════════════════
  // توليد امتحان تلقائي من البنك
  // ═══════════════════════════════════════════════════════════

  async generateExamAuto(
    tenantId: string,
    teacherId: string,
    dto: GenerateExamDto,
  ): Promise<{ exam: ExamEntity; items: ExamItemEntity[] }> {
    // جلب أسئلة عشوائية من بنك الحساب
    const questions = await this.repo.findRandomQuestions(tenantId, {
      subjectId:  dto.subjectId  ?? undefined,
      grade:      dto.grade      ?? undefined,
      difficulty: dto.difficulty ?? undefined,
      types:      dto.questionTypes,
      count:      dto.count,
    });

    if (questions.length === 0) {
      throw new AppError('NOT_FOUND', 'لا توجد أسئلة تطابق المعايير المحددة في بنك الأسئلة', 404);
    }

    // إنشاء الامتحان
    const exam = await this.repo.createExam(tenantId, {
      teacherId,
      title:     dto.title,
      subjectId: dto.subjectId ?? null,
      grade:     dto.grade     ?? null,
      createdBy: teacherId,
    });

    // إنشاء بنود الامتحان من الأسئلة المختارة
    const itemsData: CreateExamItemData[] = questions.map((q, idx) => ({
      examId:        exam.id,
      questionId:    q.id,
      questionText:  q.questionText,
      type:          q.type,
      options:       q.options       ?? null,
      correctAnswer: q.correctAnswer ?? null,
      modelAnswer:   q.modelAnswer   ?? null,
      imageUrl:      q.imageUrl      ?? null,
      // لو المدرس محددش درجة موحّدة، كل سؤال بياخد درجته الافتراضية من البنك
      degree:        dto.degreePerQuestion ?? q.defaultDegree,
      sortOrder:     idx,
      sectionTitle:  null,
    }));

    const items = await this.repo.replaceExamItems(tenantId, exam.id, itemsData);

    exam.recalculateTotalDegree(items);
    await this.repo.saveExam(tenantId, exam);

    return { exam, items };
  }

  // ═══════════════════════════════════════════════════════════
  // توليد PDF
  // ═══════════════════════════════════════════════════════════

  async generatePdf(
    tenantId: string,
    teacherId: string,
    examId: string,
    res: Response,
    opts: { answerKey?: boolean } = {},
  ): Promise<void> {
    const { exam, items } = await this.getExam(tenantId, teacherId, examId);
    const answerKey = !!opts.answerKey;

    const images = await this._loadImages(items);
    const html   = this._buildExamHtml(exam, items, images, { answerKey });

    // نفس متصفح Puppeteer المشترك بتاع التقارير (بدل ما نفتح Chrome جديد مع كل امتحان)
    const pdfBuffer = await this.pdf.renderHtml(html, {
      margin: { top: '15mm', bottom: '15mm', left: '14mm', right: '14mm' },
    });

    const filename = `${answerKey ? 'answer-key' : 'exam'}-${exam.id.slice(0, 8)}.pdf`;
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
    opts: { answerKey: boolean },
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
