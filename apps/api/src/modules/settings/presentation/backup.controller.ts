import { Controller, Get, Post, Put, Param, Body, Res, Request, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../../shared/infrastructure/guards/jwt-auth.guard';
import { TenantGuard } from '../../../shared/infrastructure/guards/tenant.guard';
import { RolesGuard } from '../../../shared/infrastructure/guards/roles.guard';
import { PermissionGuard } from '../../../shared/infrastructure/guards/permission.guard';
import { RequirePermission } from '../../../shared/infrastructure/guards/permission.decorator';
import { BackupAvailabilityGuard, isBackupAvailable } from '../../../shared/infrastructure/guards/backup-availability.guard';
import { BackupUseCase } from '../application/use-cases/backup.usecase';

@Controller('settings/backup')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, PermissionGuard)
export class BackupController {
  constructor(private readonly backupUseCase: BackupUseCase) {}

  /** الواجهة بتسأل هنا عشان تخفي تبويب النسخ الاحتياطي لو مش متاح (BACKUP-006) */
  @Get('availability')
  @RequirePermission('settings.view')
  availability() {
    return { success: true, data: { available: isBackupAvailable() } };
  }

  /**
   * BACKUP-007: حالة النسخ (آخر نجاح / آخر فشل / مفعّل ولا لأ) للإعدادات وتنبيه الصفحة الرئيسية.
   * من غير BackupAvailabilityGuard: برّا الديسكتوب بترجع available=false ومابتلمسش حاجة.
   */
  @Get('status')
  @RequirePermission('settings.view')
  async status(@Request() req: any) {
    const data = await this.backupUseCase.getStatus(req.user.tenantId);
    return { success: true, data };
  }

  @Post('create')
  @UseGuards(BackupAvailabilityGuard)
  @RequirePermission('settings.edit')
  async create(@Request() req: any) {
    const filePath = await this.backupUseCase.createBackup(req.user.tenantId, 'manual');
    return { success: true, data: { filename: filePath.split(/[\\/]/).pop() } };
  }

  @Get('list')
  @UseGuards(BackupAvailabilityGuard)
  @RequirePermission('settings.view')
  async list() {
    const data = await this.backupUseCase.listBackups();
    return { success: true, data };
  }

  @Get('download/:filename')
  @UseGuards(BackupAvailabilityGuard)
  @RequirePermission('settings.view')
  async download(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = this.backupUseCase.getBackupFilePath(filename);
    res.download(filePath, filename);
  }

  @Get('auto-backup')
  @UseGuards(BackupAvailabilityGuard)
  @RequirePermission('settings.view')
  async getAutoBackup(@Request() req: any) {
    const enabled = await this.backupUseCase.getAutoBackupEnabled(req.user.tenantId);
    return { success: true, data: { enabled } };
  }

  @Put('auto-backup')
  @UseGuards(BackupAvailabilityGuard)
  @RequirePermission('settings.edit')
  async setAutoBackup(@Request() req: any, @Body() body: { enabled: boolean }) {
    await this.backupUseCase.setAutoBackupEnabled(req.user.tenantId, !!body.enabled);
    return { success: true };
  }
}
