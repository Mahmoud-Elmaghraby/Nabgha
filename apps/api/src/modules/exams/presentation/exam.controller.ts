import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards, Request, Res,
} from '@nestjs/common';
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
  // تصدير PDF — /exams/:id/pdf
  // ═══════════════════════════════════════════════════════════

  @Post(':id/pdf')
  @RequirePermission('exams.export')
  async generatePdf(@Request() req: any, @Param('id') id: string, @Res() res: Response) {
    await this.useCase.generatePdf(req.user.tenantId, req.user.sub, id, res);
  }
}
