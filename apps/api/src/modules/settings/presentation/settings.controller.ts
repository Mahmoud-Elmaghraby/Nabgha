import {
  Controller, Get, Put,
  Body, UseGuards, Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../shared/infrastructure/guards/jwt-auth.guard';
import { TenantGuard } from '../../../shared/infrastructure/guards/tenant.guard';
import { RolesGuard } from '../../../shared/infrastructure/guards/roles.guard';
import { PermissionGuard } from '../../../shared/infrastructure/guards/permission.guard';
import { RequirePermission } from '../../../shared/infrastructure/guards/permission.decorator';
import { CenterSettingsUseCase } from '../application/use-cases/center-settings.usecase';
import { ModuleSettingsRepository } from '../infrastructure/settings.repository';
import { AppError } from '../../../core/errors/app.error';
import { UpdateCenterSettingsSchema } from '../application/dtos/settings.dto';

@Controller('settings')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, PermissionGuard)
export class SettingsController {
  constructor(
    private readonly centerSettings: CenterSettingsUseCase,
    private readonly moduleSettings: ModuleSettingsRepository,
  ) {}

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
}
