import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards, Request, Res,
  UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard }      from '../../../shared/infrastructure/guards/jwt-auth.guard';
import { TenantGuard }       from '../../../shared/infrastructure/guards/tenant.guard';
import { RolesGuard }        from '../../../shared/infrastructure/guards/roles.guard';
import { PermissionGuard }   from '../../../shared/infrastructure/guards/permission.guard';
import { RequirePermission } from '../../../shared/infrastructure/guards/permission.decorator';
import { ExamUseCase }       from '../application/use-cases/exam.usecase';
import { AppError }          from '../../../core/errors/app.error';
import {
  ListQuestionsSchema,
  CreateQuestionSchema,
  UpdateQuestionSchema,
  ListExamsSchema,
  CreateExamSchema,
  UpdateExamSchema,
  SaveExamItemsSchema,
  GenerateExamSchema,
  ImportOptionsSchema,
  ImportTextSchema,
} from '../application/dtos/exam.dto';

@Controller('exams')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, PermissionGuard)
export class ExamController {
  constructor(private readonly useCase: ExamUseCase) {}

  // ═══════════════════════════════════════════════════════════
  // بنك الأسئلة — /exams/questions
  // ═══════════════════════════════════════════════════════════

  @Get('questions')
  @RequirePermission('exams.view')
  async listQuestions(@Request() req: any, @Query() query: any) {
    const result = ListQuestionsSchema.safeParse(query);
    if (!result.success) throw new AppError('VALIDATION_ERROR', result.error.message, 400);
    const data = await this.useCase.listQuestions(req.user.tenantId, req.user.sub, result.data);
    return { success: true, data };
  }

  // ─── استيراد ─────────────────────────────────────────────────
  @Get('questions/import/template')
  @RequirePermission('exams.create')
  async importTemplate(@Res() res: Response) {
    const buf = await this.useCase.buildImportTemplate();
    res.set({
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="nabgha-questions-template.xlsx"',
      'Content-Length':      buf.length.toString(),
    });
    res.send(buf);
  }

  @Post('questions/import/text')
  @RequirePermission('exams.create')
  async importText(@Request() req: any, @Body() body: any) {
    const result = ImportTextSchema.safeParse(body);
    if (!result.success) throw new AppError('VALIDATION_ERROR', result.error.issues[0]?.message ?? 'بيانات غير صالحة', 400);
    const { text, ...opts } = result.data;
    const data = await this.useCase.importFromText(req.user.tenantId, req.user.sub, text, opts);
    return { success: true, data };
  }

  @Post('questions/import/excel')
  @RequirePermission('exams.create')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async importExcel(@Request() req: any, @UploadedFile() file: Express.Multer.File, @Body() body: any) {
    if (!file?.buffer) throw new AppError('VALIDATION_ERROR', 'ارفع ملف Excel', 400);
    const isXlsx = /\.xlsx$/i.test(file.originalname ?? '') && file.buffer.slice(0, 2).toString() === 'PK';
    if (!isXlsx) throw new AppError('INVALID_FILE', 'الملف لازم يكون Excel بصيغة .xlsx', 400);
    const result = ImportOptionsSchema.safeParse(body ?? {});
    if (!result.success) throw new AppError('VALIDATION_ERROR', result.error.issues[0]?.message ?? 'بيانات غير صالحة', 400);
    const data = await this.useCase.importFromExcel(req.user.tenantId, req.user.sub, file.buffer, result.data);
    return { success: true, data };
  }

  // متاح في البنك لكل نوع × مستوى + الوحدات — لازم يتعرّف قبل questions/:id
  @Get('questions/availability')
  @RequirePermission('exams.view')
  async getAvailability(@Request() req: any, @Query() query: any) {
    const uuid = /^[0-9a-f-]{36}$/i;
    const subjectId = typeof query.subjectId === 'string' && uuid.test(query.subjectId) ? query.subjectId : undefined;
    const grade     = typeof query.grade === 'string' && query.grade ? query.grade.slice(0, 100) : undefined;
    const tags      = typeof query.tags === 'string' && query.tags
      ? query.tags.split(',').map((t: string) => t.trim()).filter(Boolean).slice(0, 30)
      : undefined;
    const data = await this.useCase.getAvailability(req.user.tenantId, { subjectId, grade, tags });
    return { success: true, data };
  }

  @Get('questions/:id')
  @RequirePermission('exams.view')
  async getQuestion(@Request() req: any, @Param('id') id: string) {
    const data = await this.useCase.getQuestion(req.user.tenantId, req.user.sub, id);
    return { success: true, data };
  }

  @Post('questions')
  @RequirePermission('exams.create')
  async createQuestion(@Request() req: any, @Body() body: any) {
    const result = CreateQuestionSchema.safeParse(body);
    if (!result.success) throw new AppError('VALIDATION_ERROR', result.error.message, 400);
    const data = await this.useCase.createQuestion(req.user.tenantId, req.user.sub, result.data);
    return { success: true, data };
  }

  @Put('questions/:id')
  @RequirePermission('exams.edit')
  async updateQuestion(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    const result = UpdateQuestionSchema.safeParse(body);
    if (!result.success) throw new AppError('VALIDATION_ERROR', result.error.message, 400);
    const data = await this.useCase.updateQuestion(req.user.tenantId, req.user.sub, id, result.data);
    return { success: true, data };
  }

  @Delete('questions/:id')
  @RequirePermission('exams.delete')
  async deleteQuestion(@Request() req: any, @Param('id') id: string) {
    await this.useCase.deleteQuestion(req.user.tenantId, req.user.sub, id);
    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════
  // الامتحانات — /exams
  // ═══════════════════════════════════════════════════════════

  @Get()
  @RequirePermission('exams.view')
  async listExams(@Request() req: any, @Query() query: any) {
    const result = ListExamsSchema.safeParse(query);
    if (!result.success) throw new AppError('VALIDATION_ERROR', result.error.message, 400);
    const data = await this.useCase.listExams(req.user.tenantId, req.user.sub, result.data);
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermission('exams.view')
  async getExam(@Request() req: any, @Param('id') id: string) {
    const data = await this.useCase.getExam(req.user.tenantId, req.user.sub, id);
    return { success: true, data };
  }

  @Post()
  @RequirePermission('exams.create')
  async createExam(@Request() req: any, @Body() body: any) {
    const result = CreateExamSchema.safeParse(body);
    if (!result.success) throw new AppError('VALIDATION_ERROR', result.error.message, 400);
    const data = await this.useCase.createExam(req.user.tenantId, req.user.sub, result.data);
    return { success: true, data };
  }

  @Put(':id')
  @RequirePermission('exams.edit')
  async updateExam(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    const result = UpdateExamSchema.safeParse(body);
    if (!result.success) throw new AppError('VALIDATION_ERROR', result.error.message, 400);
    const data = await this.useCase.updateExam(req.user.tenantId, req.user.sub, id, result.data);
    return { success: true, data };
  }

  @Delete(':id')
  @RequirePermission('exams.delete')
  async deleteExam(@Request() req: any, @Param('id') id: string) {
    await this.useCase.deleteExam(req.user.tenantId, req.user.sub, id);
    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════
  // بنود الامتحان — /exams/:id/items
  // ═══════════════════════════════════════════════════════════

  @Put(':id/items')
  @RequirePermission('exams.edit')
  async saveExamItems(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    const result = SaveExamItemsSchema.safeParse(body);
    if (!result.success) throw new AppError('VALIDATION_ERROR', result.error.message, 400);
    const data = await this.useCase.saveExamItems(req.user.tenantId, req.user.sub, id, result.data);
    return { success: true, data };
  }

  // ═══════════════════════════════════════════════════════════
  // توليد تلقائي — /exams/generate
  // ═══════════════════════════════════════════════════════════

  @Post('generate')
  @RequirePermission('exams.create')
  async generateExam(@Request() req: any, @Body() body: any) {
    const result = GenerateExamSchema.safeParse(body);
    if (!result.success) throw new AppError('VALIDATION_ERROR', result.error.message, 400);
    const data = await this.useCase.generateExamAuto(req.user.tenantId, req.user.sub, result.data);
    return { success: true, data };
  }

  // ═══════════════════════════════════════════════════════════
  // الربط بالحصص
  // ═══════════════════════════════════════════════════════════

  @Get('by-session/:sessionId')
  @RequirePermission('exams.view')
  async getSessionExam(@Request() req: any, @Param('sessionId') sessionId: string) {
    const data = await this.useCase.getSessionExam(req.user.tenantId, sessionId);
    return { success: true, data };
  }

  @Delete('by-session/:sessionId')
  @RequirePermission('exams.edit')
  async unlinkSession(@Request() req: any, @Param('sessionId') sessionId: string) {
    await this.useCase.unlinkSession(req.user.tenantId, sessionId);
    return { success: true };
  }

  @Get(':id/sessions')
  @RequirePermission('exams.view')
  async getLinkedSessions(@Request() req: any, @Param('id') id: string) {
    const data = await this.useCase.getLinkedSessions(req.user.tenantId, id);
    return { success: true, data };
  }

  @Post(':id/link-session')
  @RequirePermission('exams.edit')
  async linkSession(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : '';
    if (!/^[0-9a-f-]{36}$/i.test(sessionId)) throw new AppError('VALIDATION_ERROR', 'sessionId غير صالح', 400);
    const data = await this.useCase.linkSession(req.user.tenantId, req.user.sub, id, sessionId);
    return { success: true, data };
  }

  // ═══════════════════════════════════════════════════════════
  // تصدير PDF — /exams/:id/pdf
  // ═══════════════════════════════════════════════════════════

  @Post(':id/pdf')
  @RequirePermission('exams.export')
  async generatePdf(
    @Request() req: any,
    @Param('id') id: string,
    @Query('answers') answers: string | undefined,
    @Query('version') versionParam: string | undefined,
    @Res() res: Response,
  ) {
    // ?answers=1 → نموذج الإجابة (نفس الامتحان مع تعليم الإجابات الصحيحة)
    // ?version=A..D → نموذج مختلف (ترتيب أسئلة واختيارات مختلف)
    const answerKey = answers === '1' || answers === 'true';
    let version: number | undefined;
    if (versionParam) {
      version = 'ABCD'.indexOf(versionParam.toUpperCase());
      if (versionParam.length !== 1 || version < 0) {
        throw new AppError('VALIDATION_ERROR', 'النموذج لازم يكون A أو B أو C أو D', 400);
      }
    }
    await this.useCase.generatePdf(req.user.tenantId, req.user.sub, id, res, { answerKey, version });
  }
}
