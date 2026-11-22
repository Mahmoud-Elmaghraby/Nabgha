import { Injectable, Logger, Inject } from '@nestjs/common';
import { Response } from 'express';
import { EXAM_REPOSITORY, IExamRepository, CreateExamItemData } from '../../domain/repositories/exam.repository.interface';
import { ExamQuestionEntity, ExamEntity, ExamItemEntity } from '../../domain/entities/exam.entity';
import { AppError } from '../../../../core/errors/app.error';
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
  ) {}

  // ═══════════════════════════════════════════════════════════
  // بنك الأسئلة
  // ═══════════════════════════════════════════════════════════

  async listQuestions(
    tenantId: string,
    teacherId: string,
    params: ListQuestionsDto,
  ): Promise<{ data: ExamQuestionEntity[]; total: number; page: number; limit: number }> {
    const result = await this.repo.findQuestions(tenantId, teacherId, params);
    return { ...result, page: params.page ?? 1, limit: params.limit ?? 20 };
  }

  async getQuestion(tenantId: string, teacherId: string, id: string): Promise<ExamQuestionEntity> {
    const question = await this.repo.findQuestionById(tenantId, id);
    if (!question) throw new AppError('NOT_FOUND', 'السؤال غير موجود', 404);
    if (question.teacherId !== teacherId) throw new AppError('FORBIDDEN', 'ليس لديك صلاحية الوصول لهذا السؤال', 403);
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
    const result = await this.repo.findExams(tenantId, teacherId, params);
    return { ...result, page: params.page ?? 1, limit: params.limit ?? 20 };
  }

  async getExam(
    tenantId: string,
    teacherId: string,
    id: string,
  ): Promise<{ exam: ExamEntity; items: ExamItemEntity[] }> {
    const exam = await this.repo.findExamById(tenantId, id);
    if (!exam) throw new AppError('NOT_FOUND', 'الامتحان غير موجود', 404);
    if (exam.teacherId !== teacherId) throw new AppError('FORBIDDEN', 'ليس لديك صلاحية الوصول لهذا الامتحان', 403);

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
    // جلب أسئلة عشوائية من البنك الخاص بالمدرس
    const questions = await this.repo.findRandomQuestions(tenantId, teacherId, {
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
  ): Promise<void> {
    const { exam, items } = await this.getExam(tenantId, teacherId, examId);

    const html = this._buildExamHtml(exam, items);

    // تحميل Puppeteer واستخدامه لتوليد PDF
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const puppeteer = require('puppeteer');
    const browser   = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({
        format:    'A4',
        printBackground: true,
        margin:    { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
      });

      const filename = `exam-${exam.id}-${Date.now()}.pdf`;
      res.set({
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length':      pdfBuffer.length.toString(),
      });
      res.send(Buffer.from(pdfBuffer));
    } finally {
      await browser.close();
    }
  }

  // ═══════════════════════════════════════════════════════════
  // مساعدات داخلية
  // ═══════════════════════════════════════════════════════════

  private async _getExamOwned(tenantId: string, teacherId: string, id: string): Promise<ExamEntity> {
    const exam = await this.repo.findExamById(tenantId, id);
    if (!exam) throw new AppError('NOT_FOUND', 'الامتحان غير موجود', 404);
    if (exam.teacherId !== teacherId) throw new AppError('FORBIDDEN', 'ليس لديك صلاحية التعديل على هذا الامتحان', 403);
    return exam;
  }

  private _buildExamHtml(exam: ExamEntity, items: ExamItemEntity[]): string {
    const cfg     = exam.designConfig ?? {};
    const headerColor   = (cfg as any).header_color      ?? '#1e40af';
    const fontFamily    = (cfg as any).font_family        ?? 'Cairo';
    const showDegree    = (cfg as any).show_degree        ?? true;
    const showDate      = (cfg as any).show_date          ?? true;
    const showStudentName = (cfg as any).show_student_name ?? true;
    const customHeader  = (cfg as any).custom_header_text ?? '';

    const questionsHtml = items
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item, idx) => this._buildQuestionHtml(item, idx + 1, showDegree))
      .join('\n');

    const examDate = exam.examDate
      ? new Date(exam.examDate).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
      : '...............';

    return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${exam.title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, '+')}:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: '${fontFamily}', Arial, sans-serif;
      font-size: 14px;
      line-height: 1.8;
      color: #1a1a1a;
      background: #fff;
    }
    .exam-header {
      background: ${headerColor};
      color: white;
      padding: 20px 24px;
      border-radius: 0 0 8px 8px;
      margin-bottom: 24px;
    }
    .exam-title { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
    .exam-meta  { font-size: 13px; opacity: 0.9; display: flex; gap: 24px; flex-wrap: wrap; }
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
    .info-label { color: #6b7280; }
    .info-value { border-bottom: 1px dotted #9ca3af; min-width: 80px; display: inline-block; }
    .instructions {
      background: #f8fafc;
      border-right: 4px solid ${headerColor};
      padding: 10px 14px;
      margin-bottom: 20px;
      border-radius: 4px;
      font-size: 13px;
    }
    .question-block {
      margin-bottom: 24px;
      page-break-inside: avoid;
    }
    .section-title {
      background: #f1f5f9;
      padding: 8px 14px;
      border-radius: 4px;
      font-weight: 700;
      font-size: 15px;
      margin-bottom: 12px;
      color: ${headerColor};
    }
    .question-text {
      font-weight: 600;
      margin-bottom: 10px;
      display: flex;
      gap: 8px;
    }
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
    .question-degree { color: #6b7280; font-size: 12px; font-weight: 400; margin-right: auto; }
    .options-list { list-style: none; padding-right: 34px; }
    .options-list li { margin-bottom: 6px; display: flex; align-items: center; gap: 8px; }
    .option-circle { width: 18px; height: 18px; border: 2px solid #9ca3af; border-radius: 50%; flex-shrink: 0; }
    .fill-line { border-bottom: 1px solid #9ca3af; height: 24px; margin: 4px 34px 4px 0; }
    .essay-lines { margin: 4px 34px 4px 0; }
    .essay-line { border-bottom: 1px solid #d1d5db; height: 32px; margin-bottom: 2px; }
    .tf-options { display: flex; gap: 24px; padding-right: 34px; }
    .tf-option { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 15px; }
    .footer { margin-top: 32px; text-align: center; color: #9ca3af; font-size: 11px; border-top: 1px solid #e5e7eb; padding-top: 12px; }
  </style>
</head>
<body>
  <div class="exam-header">
    ${customHeader ? `<div style="font-size:13px;margin-bottom:8px;opacity:0.85">${customHeader}</div>` : ''}
    <div class="exam-title">${exam.title}</div>
    <div class="exam-meta">
      ${exam.grade        ? `<span>الصف: ${exam.grade}</span>` : ''}
      ${exam.durationMins ? `<span>المدة: ${exam.durationMins} دقيقة</span>` : ''}
      ${showDegree        ? `<span>المجموع: ${exam.totalDegree} درجة</span>` : ''}
      ${showDate          ? `<span>التاريخ: ${examDate}</span>` : ''}
    </div>
  </div>

  ${showStudentName ? `
  <div class="info-row">
    <div>اسم الطالب: <span class="info-value">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></div>
    <div>رقم الجلوس: <span class="info-value">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></div>
  </div>` : ''}

  ${exam.instructions ? `<div class="instructions"><strong>تعليمات:</strong> ${exam.instructions}</div>` : ''}

  ${questionsHtml}

  <div class="footer">انتهت الأسئلة — بالتوفيق 🌟</div>
</body>
</html>`;
  }

  private _buildQuestionHtml(item: ExamItemEntity, num: number, showDegree: boolean): string {
    const arabicLetters = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];
    const degreeText    = showDegree ? `<span class="question-degree">(${item.degree} درجة)</span>` : '';
    const sectionTitle  = item.sectionTitle ? `<div class="section-title">${item.sectionTitle}</div>` : '';

    let answerArea = '';
    switch (item.type) {
      case 'mcq':
        answerArea = `<ul class="options-list">${
          (item.options ?? []).map((opt, i) => `
            <li><div class="option-circle"></div>${arabicLetters[i] ?? (i + 1) + '.'} ${opt}</li>`).join('')
        }</ul>`;
        break;
      case 'true_false':
        answerArea = `<div class="tf-options">
          <div class="tf-option"><div class="option-circle"></div> صح ✓</div>
          <div class="tf-option"><div class="option-circle"></div> خطأ ✗</div>
        </div>`;
        break;
      case 'fill':
        answerArea = `<div class="fill-line"></div>`;
        break;
      case 'essay':
        answerArea = `<div class="essay-lines">${Array(5).fill('<div class="essay-line"></div>').join('')}</div>`;
        break;
    }

    return `${sectionTitle}
<div class="question-block">
  <div class="question-text">
    <div class="question-num">${num}</div>
    <span>${item.questionText}</span>
    ${degreeText}
  </div>
  ${answerArea}
</div>`;
  }
}
