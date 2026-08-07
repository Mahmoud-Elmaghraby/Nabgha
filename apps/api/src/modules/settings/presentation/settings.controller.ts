import {
  Controller, Get, Put, Query, Param,
  Body, UseGuards, Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../shared/infrastructure/guards/jwt-auth.guard';
import { TenantGuard } from '../../../shared/infrastructure/guards/tenant.guard';
import { RolesGuard } from '../../../shared/infrastructure/guards/roles.guard';
import { PermissionGuard } from '../../../shared/infrastructure/guards/permission.guard';
import { RequirePermission } from '../../../shared/infrastructure/guards/permission.decorator';
import { CenterSettingsUseCase } from '../application/use-cases/center-settings.usecase';
import { BrandingService } from '../application/services/branding.service';
import { TenantCapabilitiesService } from '../../../shared/infrastructure/tenant-capabilities/tenant-capabilities.service';
import { ModuleSettingsRepository } from '../infrastructure/settings.repository';
import { AppError } from '../../../core/errors/app.error';
import { UpdateCenterSettingsSchema } from '../application/dtos/settings.dto';

@Controller('settings')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, PermissionGuard)
export class SettingsController {
  constructor(
    private readonly centerSettings: CenterSettingsUseCase,
    private readonly moduleSettings: ModuleSettingsRepository,
    private readonly branding: BrandingService,
    private readonly capabilities: TenantCapabilitiesService,
  ) {}

  @Get('capabilities')
  @RequirePermission('settings.view')
  async getCapabilities(@Request() req: any) {
    const data = await this.capabilities.getCapabilities(req.user.tenantId);
    return { success: true, data };
  }

  @Get('center')
  @RequirePermission('settings.view')
  async getCenterSettings(@Request() req: any) {
    const data = await this.centerSettings.getOrCreate(req.user.tenantId);
    return { success: true, data };
  }

  @Put('center')
  @RequirePermission('settings.edit')
  async updateCenterSettings(@Request() req: any, @Body() body: any) {
    const parsed = UpdateCenterSettingsSchema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', parsed.error.message, 400);
    const data = await this.centerSettings.update(req.user.tenantId, parsed.data);
    return { success: true, data };
  }

  @Get('telegram')
  @RequirePermission('settings.view')
  async getTelegramSettings(@Request() req: any) {
    const token = await this.moduleSettings.get(req.user.tenantId, 'telegram_bot_token');
    return { success: true, data: { hasToken: !!token } };
  }

  @Put('telegram')
  @RequirePermission('settings.edit')
  async saveTelegramToken(@Request() req: any, @Body() body: any) {
    if (body.token !== undefined) {
      await this.moduleSettings.set(req.user.tenantId, 'telegram_bot_token', body.token);
    }
    return { success: true };
  }

  @Get('card-designer')
  @RequirePermission('settings.view')
  async getCardDesigner(@Request() req: any) {
    const raw = await this.moduleSettings.get(req.user.tenantId, 'card_designer');
    const data = raw ? JSON.parse(raw) : null;
    return { success: true, data };
  }

  @Put('card-designer')
  @RequirePermission('settings.edit')
  async saveCardDesigner(@Request() req: any, @Body() body: any) {
    await this.moduleSettings.set(req.user.tenantId, 'card_designer', JSON.stringify(body));
    return { success: true, data: body };
  }

  @Get('columns/:module')
  @RequirePermission('settings.view')
  async getVisibleColumns(@Request() req: any, @Param('module') moduleName: string) {
    const raw = await this.moduleSettings.get(req.user.tenantId, `visible_columns:${moduleName}`);
    const data = raw ? JSON.parse(raw) : null;
    return { success: true, data };
  }

  @Put('columns/:module')
  @RequirePermission('settings.edit')
  async saveVisibleColumns(@Request() req: any, @Param('module') moduleName: string, @Body() body: any) {
    const columns = Array.isArray(body?.columns) ? body.columns : [];
    await this.moduleSettings.set(req.user.tenantId, `visible_columns:${moduleName}`, JSON.stringify(columns));
    return { success: true, data: { columns } };
  }

  @Get('branding')
  @RequirePermission('settings.view')
  async getBranding(@Request() req: any) {
    const mode = await this.branding.getMode(req.user.tenantId);
    return { success: true, data: { mode } };
  }

  @Put('branding')
  @RequirePermission('settings.edit')
  async updateBranding(@Request() req: any, @Body() body: any) {
    const mode = body?.mode === 'teacher' ? 'teacher' : 'center';
    await this.branding.setMode(req.user.tenantId, mode);
    return { success: true, data: { mode } };
  }

  // بدون RequirePermission — بيانات عرض بس (اسم/رقم) مطلوبة لأي حد بيطبع إيصال
  // (زي موظف تحصيل ممكن معندوش settings.view أصلاً)
  @Get('branding-info')
  async getBrandingInfo(@Request() req: any, @Query() query: any) {
    const data = await this.branding.getBrandingInfo(req.user.tenantId, {
      monthlyDueId: query.monthlyDueId,
      groupId: query.groupId,
      subjectGradeId: query.subjectGradeId,
      studentId: query.studentId,
      teacherId: query.teacherId,
    });
    return { success: true, data };
  }
}
