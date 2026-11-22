import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, UseGuards, Request,
  UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../../shared/infrastructure/guards/jwt-auth.guard';
import { TenantGuard } from '../../../shared/infrastructure/guards/tenant.guard';
import { RolesGuard } from '../../../shared/infrastructure/guards/roles.guard';
import { PermissionGuard } from '../../../shared/infrastructure/guards/permission.guard';
import { RequirePermission } from '../../../shared/infrastructure/guards/permission.decorator';
import { SessionUseCase } from '../application/use-cases/session.usecase';
import { StorageService } from '../../../shared/infrastructure/storage/storage.service';
import { AppError } from '../../../core/errors/app.error';
import {
  CreateSessionSchema, UpdateSessionSchema, UpdateAttendanceSchema,
  BulkUpdateAttendanceSchema, ScanQrSchema, ListSessionsSchema,
  AddExternalAttendanceSchema,
} from '../application/dtos/session.dto';

@Controller('sessions')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, PermissionGuard)
export class SessionController {
  constructor(
    private readonly useCase: SessionUseCase,
    private readonly storage: StorageService,
  ) {}

  private static readonly MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

  // ─── CRUD ─────────────────────────────────────────────────
  @Get()
  @RequirePermission('sessions.view')
  async list(@Request() req: any, @Query() query: any) {
    const parsed = ListSessionsSchema.safeParse(query);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', parsed.error.message, 400);
    const result = await this.useCase.list(req.user.tenantId, parsed.data);
    return { success: true, data: result };
  }

  @Get(':id')
  @RequirePermission('sessions.view')
  async getById(@Request() req: any, @Param('id') id: string) {
    const data = await this.useCase.getById(req.user.tenantId, id);
    return { success: true, data };
  }

  @Post()
  @RequirePermission('sessions.create')
  async create(@Request() req: any, @Body() body: any) {
    const parsed = CreateSessionSchema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', parsed.error.message, 400);
    const data = await this.useCase.create(req.user.tenantId, parsed.data, req.user.sub);
    return { success: true, data };
  }

  // توليد يدوي لحصص اليوم بناءً على الجدول الأسبوعي للمجموعات — بديل زرار "توليد
  // الفواتير" الموجود في المالية، بس للحصص. لازم يتحط قبل @Get(':id') منطقياً
  // بس هو POST فمفيش تعارض مسارات فعلي.
  @Post('generate-today')
  @RequirePermission('sessions.create')
  async generateToday(@Request() req: any, @Body() body: any) {
    const date = typeof body?.date === 'string' && body.date ? body.date : undefined;
    const result = await this.useCase.generateToday(req.user.tenantId, req.user.sub, date);
    return { success: true, data: result };
  }

  @Put(':id')
  @RequirePermission('sessions.edit')
  async update(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    const parsed = UpdateSessionSchema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', parsed.error.message, 400);
    const data = await this.useCase.update(req.user.tenantId, id, parsed.data);
    return { success: true, data };
  }

  @Delete(':id')
  @RequirePermission('sessions.delete')
  async delete(@Request() req: any, @Param('id') id: string) {
    await this.useCase.delete(req.user.tenantId, id);
    return { success: true };
  }

  // ─── Status Transitions ───────────────────────────────────
  @Patch(':id/start')
  @RequirePermission('sessions.edit')
  async start(@Request() req: any, @Param('id') id: string) {
    const data = await this.useCase.start(req.user.tenantId, id);
    return { success: true, data };
  }

  @Patch(':id/complete')
  @RequirePermission('sessions.edit')
  async complete(@Request() req: any, @Param('id') id: string) {
    const data = await this.useCase.complete(req.user.tenantId, id);
    return { success: true, data };
  }

  @Patch(':id/cancel')
  @RequirePermission('sessions.edit')
  async cancel(@Request() req: any, @Param('id') id: string) {
    const data = await this.useCase.cancel(req.user.tenantId, id);
    return { success: true, data };
  }

  // ─── Attendance ───────────────────────────────────────────
  @Get(':id/attendance')
  @RequirePermission('sessions.view')
  async getAttendance(@Request() req: any, @Param('id') id: string) {
    const data = await this.useCase.getAttendance(req.user.tenantId, id);
    return { success: true, data };
  }

  @Patch(':id/attendance/:studentId')
  @RequirePermission('sessions.attendance')
  async updateAttendance(
    @Request() req: any,
    @Param('id') id: string,
    @Param('studentId') studentId: string,
    @Body() body: any,
  ) {
    const parsed = UpdateAttendanceSchema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', parsed.error.message, 400);
    const data = await this.useCase.updateAttendance(req.user.tenantId, id, studentId, parsed.data);
    return { success: true, data };
  }

  @Patch(':id/attendance')
  @RequirePermission('sessions.attendance')
  async bulkUpdateAttendance(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const parsed = BulkUpdateAttendanceSchema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', parsed.error.message, 400);
    const { failed } = await this.useCase.bulkUpdateAttendance(req.user.tenantId, id, parsed.data);
    return { success: true, data: { failed } };
  }

  // ─── Previous Absent ──────────────────────────────────────
  @Get(':id/previous-absent')
  @RequirePermission('sessions.view')
  async getPreviousAbsent(@Request() req: any, @Param('id') id: string) {
    const data = await this.useCase.getPreviousAbsentStudents(req.user.tenantId, id);
    return { success: true, data };
  }

  // ─── إنذار عدم السداد + تقرير الغياب ─────────────────────
  @Get(':id/unpaid')
  @RequirePermission('sessions.view')
  async getUnpaid(@Request() req: any, @Param('id') id: string) {
    const data = await this.useCase.getUnpaidStudents(req.user.tenantId, id);
    return { success: true, data };
  }

  @Get(':id/absence-report')
  @RequirePermission('sessions.view')
  async getAbsenceReport(@Request() req: any, @Param('id') id: string) {
    const data = await this.useCase.getAbsenceReport(req.user.tenantId, id);
    return { success: true, data };
  }

  // ─── QR Scan ──────────────────────────────────────────────
  @Post(':id/scan')
  @RequirePermission('sessions.attendance')
  async scanQr(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const parsed = ScanQrSchema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', parsed.error.message, 400);
    const data = await this.useCase.scanQr(req.user.tenantId, id, parsed.data);
    return { success: true, data };
  }

  // ─── صورة الحصة (لأنواع الامتحان/التسميع) ─────────────────
  @Post(':id/image')
  @RequirePermission('sessions.attendance')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadSessionImage(
    @Request() req: any,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const url = await this.storage.validateAndUploadImage(
      file, `tenants/${req.user.tenantId}/sessions`, 5 * 1024 * 1024,
    );
    const data = await this.useCase.setImage(req.user.tenantId, id, url);
    return { success: true, data };
  }

  @Delete(':id/image')
  @RequirePermission('sessions.attendance')
  async removeSessionImage(@Request() req: any, @Param('id') id: string) {
    const data = await this.useCase.removeImage(req.user.tenantId, id);
    return { success: true, data };
  }

  @Post(':id/attendance/:studentId/notify-grade')
  @RequirePermission('sessions.attendance')
  async resendGradeNotification(
    @Request() req: any,
    @Param('id') id: string,
    @Param('studentId') studentId: string,
  ) {
    await this.useCase.resendGradeNotification(req.user.tenantId, id, studentId);
    return { success: true };
  }

  @Post(':id/attendance/notify-all-grades')
  @RequirePermission('sessions.attendance')
  async sendAllGradeNotifications(@Request() req: any, @Param('id') id: string) {
    const data = await this.useCase.sendAllGradeNotifications(req.user.tenantId, id, req.user.sub);
    return { success: true, data };
  }

  @Get(':id/attendance/notify-all-grades/:jobId')
  @RequirePermission('sessions.attendance')
  async getGradeNotificationProgress(
    @Request() req: any, @Param('id') id: string, @Param('jobId') jobId: string,
  ) {
    const data = await this.useCase.getGradeNotificationJobProgress(req.user.tenantId, jobId);
    if (!data) throw new AppError('NOT_FOUND', 'العملية غير موجودة', 404);
    return { success: true, data };
  }

  // ─── إرسال الدرجات عبر تليجرام — نفس شكل endpoints الواتساب فوق بالظبط،
  // بس مسار مختلف ("-telegram") ومنفصل تمامًا في الـ use case ─────────────
  @Post(':id/attendance/:studentId/notify-grade-telegram')
  @RequirePermission('sessions.attendance')
  async resendGradeNotificationTelegram(
    @Request() req: any,
    @Param('id') id: string,
    @Param('studentId') studentId: string,
  ) {
    await this.useCase.resendTelegramGradeNotification(req.user.tenantId, id, studentId);
    return { success: true };
  }

  @Post(':id/attendance/notify-all-grades-telegram')
  @RequirePermission('sessions.attendance')
  async sendAllGradeNotificationsTelegram(@Request() req: any, @Param('id') id: string) {
    const data = await this.useCase.sendAllTelegramGradeNotifications(req.user.tenantId, id, req.user.sub);
    return { success: true, data };
  }

  @Get(':id/attendance/notify-all-grades-telegram/:jobId')
  @RequirePermission('sessions.attendance')
  async getGradeNotificationProgressTelegram(
    @Request() req: any, @Param('id') id: string, @Param('jobId') jobId: string,
  ) {
    const data = await this.useCase.getTelegramGradeNotificationJobProgress(req.user.tenantId, jobId);
    if (!data) throw new AppError('NOT_FOUND', 'العملية غير موجودة', 404);
    return { success: true, data };
  }

  // ─── حضور بديل (طالب من مجموعة تانية) ─────────────────────
  @Post(':id/attendance/external')
  @RequirePermission('sessions.attendance')
  async addExternalAttendance(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const parsed = AddExternalAttendanceSchema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', parsed.error.message, 400);
    const data = await this.useCase.addExternalAttendance(req.user.tenantId, id, parsed.data);
    return { success: true, data };
  }
}
