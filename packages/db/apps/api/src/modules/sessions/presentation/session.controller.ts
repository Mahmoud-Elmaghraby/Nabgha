import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, UseGuards, Request, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../../../shared/infrastructure/guards/jwt-auth.guard';
import { TenantGuard } from '../../../../shared/infrastructure/guards/tenant.guard';
import { RolesGuard } from '../../../../shared/infrastructure/guards/roles.guard';
import { PermissionGuard } from '../../../../shared/infrastructure/guards/permission.guard';
import { RequirePermission } from '../../../../shared/infrastructure/guards/permission.decorator';
import { SessionUseCase } from '../application/use-cases/session.usecase';
import { AppError } from '../../../../core/errors/app.error';
import {
  CreateSessionSchema, UpdateSessionSchema, UpdateAttendanceSchema,
  BulkUpdateAttendanceSchema, ScanQrSchema, ListSessionsSchema,
} from '../application/dtos/session.dto';

@Controller('sessions')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, PermissionGuard)
export class SessionController {
  constructor(private readonly useCase: SessionUseCase) {}

  // ─── Sessions CRUD ────────────────────────────────────────
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

  // ─── Status transitions ───────────────────────────────────
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

  // ─── Image Upload ─────────────────────────────────────────
  @Post(':id/image')
  @RequirePermission('sessions.edit')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (_, file, cb) => {
      if (!file.mimetype.startsWith('image/')) {
        return cb(new AppError('INVALID_FILE', 'يجب أن يكون الملف صورة', 400) as any, false);
      }
      cb(null, true);
    },
  }))
  async uploadImage(
    @Request() req: any,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new AppError('MISSING_FILE', 'الصورة مطلوبة', 400);
    // TODO: رفع الصورة على MinIO وجيب الـ URL
    // في الوقت الحالي بنحفظ الاسم مؤقتاً
    const imageUrl = `sessions/${id}/${Date.now()}_${file.originalname}`;
    const data = await this.useCase.setImage(req.user.tenantId, id, imageUrl);
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

  @Patch(':id/attendance/bulk')
  @RequirePermission('sessions.attendance')
  async bulkUpdateAttendance(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const parsed = BulkUpdateAttendanceSchema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', parsed.error.message, 400);
    await this.useCase.bulkUpdateAttendance(req.user.tenantId, id, parsed.data);
    return { success: true };
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
}
