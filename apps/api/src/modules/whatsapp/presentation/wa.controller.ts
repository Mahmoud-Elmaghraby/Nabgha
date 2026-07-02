import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../shared/infrastructure/guards/jwt-auth.guard';
import { TenantGuard } from '../../../shared/infrastructure/guards/tenant.guard';
import { RolesGuard } from '../../../shared/infrastructure/guards/roles.guard';
import { PermissionGuard } from '../../../shared/infrastructure/guards/permission.guard';
import { RequirePermission } from '../../../shared/infrastructure/guards/permission.decorator';
import { ConnectDeviceUseCase } from '../application/use-cases/connect-device.usecase';
import { UpdateSettingsUseCase } from '../application/use-cases/update-settings.usecase';
import { UpdateTemplateUseCase } from '../application/use-cases/update-template.usecase';
import { SendBulkUseCase } from '../application/use-cases/send-bulk.usecase';
import { HandleInboundUseCase } from '../application/use-cases/handle-inbound.usecase';
import { WaHealthMonitorUseCase } from '../application/use-cases/wa-health-monitor.usecase';
import { SendNotificationUseCase } from '../application/use-cases/send-notification.usecase';
import { GetMessagesUseCase } from '../application/use-cases/get-messages.usecase';
import { ResolveAudienceUseCase } from '../application/use-cases/resolve-audience.usecase';
import {
  UpdateSettingsSchema, UpdateTemplateSchema,
  SendBulkSchema, SendTestSchema, ResolveAudienceSchema,
} from '../application/dtos/wa.dto';
import { WaTemplateKey } from '../domain/entities/wa-template.entity';
import { AppError } from '../../../core/errors/app.error';
import { Inject } from '@nestjs/common';
import { IWaProvider, WA_PROVIDER } from '../domain/interfaces/wa-provider.interface';

@Controller('whatsapp')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, PermissionGuard)
export class WaController {
  constructor(
    private readonly connectDevice: ConnectDeviceUseCase,
    private readonly updateSettings: UpdateSettingsUseCase,
    private readonly updateTemplate: UpdateTemplateUseCase,
    private readonly sendBulk: SendBulkUseCase,
    private readonly handleInbound: HandleInboundUseCase,
    private readonly healthMonitor: WaHealthMonitorUseCase,
    private readonly sendNotification: SendNotificationUseCase,
    private readonly getMessages: GetMessagesUseCase,
    private readonly resolveAudience: ResolveAudienceUseCase,
    @Inject(WA_PROVIDER) private readonly provider: IWaProvider,
  ) {}

  // ─── Connection ───────────────────────────────────────────

  @Post('connect')
  @RequirePermission('settings.edit')
  async connect(@Request() req: any) {
    const result = await this.connectDevice.execute(req.user.tenantId);
    return { success: true, data: result };
  }

  @Post('disconnect')
  @RequirePermission('settings.edit')
  async disconnect(@Request() req: any) {
    await this.connectDevice.disconnect(req.user.tenantId);
    return { success: true };
  }

  @Get('status')
  @RequirePermission('settings.view')
  async getStatus(@Request() req: any) {
    const data = await this.connectDevice.getStatus(req.user.tenantId);
    return { success: true, data };
  }

  @Get('health')
  @RequirePermission('settings.view')
  async getHealth(@Request() req: any) {
    const data = await this.healthMonitor.getHealthStatus(req.user.tenantId);
    return { success: true, data };
  }

  // ─── Settings ─────────────────────────────────────────────

  @Get('settings')
  @RequirePermission('settings.view')
  async getSettings(@Request() req: any) {
    const data = await this.updateSettings.getOrCreate(req.user.tenantId);
    return { success: true, data };
  }

  @Put('settings')
  @RequirePermission('settings.edit')
  async updateSettingsHandler(@Request() req: any, @Body() body: any) {
    const parsed = UpdateSettingsSchema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', parsed.error.message, 400);
    const data = await this.updateSettings.execute({ tenantId: req.user.tenantId, ...parsed.data });
    return { success: true, data };
  }

  @Get('messages')
  @RequirePermission('settings.view')
  async getMessagesLog(@Request() req: any, @Query() query: any) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const status = query.status || undefined;
    const search = query.search?.trim() || undefined;
    const data = await this.getMessages.execute(req.user.tenantId, { page, limit, status, search });
    return { success: true, data };
  }

  // ─── Templates ────────────────────────────────────────────

  @Get('templates')
  @RequirePermission('settings.view')
  async getTemplates(@Request() req: any) {
    const data = await this.updateTemplate.getAllTemplates(req.user.tenantId);
    return { success: true, data };
  }

  @Put('templates/:key')
  @RequirePermission('settings.edit')
  async updateTemplateHandler(@Request() req: any, @Param('key') key: string, @Body() body: any) {
    const parsed = UpdateTemplateSchema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', parsed.error.message, 400);
    const data = await this.updateTemplate.execute({
      tenantId: req.user.tenantId,
      key: key as WaTemplateKey,
      body: parsed.data.body,
    });
    return { success: true, data };
  }

  @Post('templates/:key/reset')
  @RequirePermission('settings.edit')
  async resetTemplate(@Request() req: any, @Param('key') key: string) {
    const data = await this.updateTemplate.resetToDefault(req.user.tenantId, key as WaTemplateKey);
    return { success: true, data };
  }

  // ─── Audience Resolution (لتحديد المستلمين تلقائياً بدل الإدخال اليدوي) ───
  @Get('audience')
  @RequirePermission('reports.send_whatsapp')
  async resolveAudienceHandler(@Request() req: any, @Query() query: any) {
    const parsed = ResolveAudienceSchema.safeParse(query);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', parsed.error.message, 400);
    const data = await this.resolveAudience.execute(req.user.tenantId, parsed.data);
    return { success: true, data };
  }

  // ─── Bulk Send ────────────────────────────────────────────

  @Post('bulk')
  @RequirePermission('reports.send_whatsapp')
  async sendBulkHandler(@Request() req: any, @Body() body: any) {
    const parsed = SendBulkSchema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', parsed.error.message, 400);
    const data = await this.sendBulk.execute({
      tenantId: req.user.tenantId,
      createdBy: req.user.sub,
      ...parsed.data,
      scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : undefined,
    });
    return { success: true, data };
  }

  @Get('bulk/:jobId')
  @RequirePermission('reports.send_whatsapp')
  async getBulkProgress(@Request() req: any, @Param('jobId') jobId: string) {
    const data = await this.sendBulk.getProgress(req.user.tenantId, jobId);
    if (!data) throw new AppError('NOT_FOUND', 'Job not found', 404);
    return { success: true, data };
  }

  @Delete('bulk/:jobId')
  @RequirePermission('reports.send_whatsapp')
  async cancelBulk(@Request() req: any, @Param('jobId') jobId: string) {
    await this.sendBulk.cancel(req.user.tenantId, jobId);
    return { success: true };
  }

  // ─── Inbound Messages ─────────────────────────────────────

  @Get('inbound')
  @RequirePermission('students.view')
  async getInbound(
    @Request() req: any,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('studentId') studentId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const data = await this.handleInbound.getInboundMessages(req.user.tenantId, {
      unreadOnly: unreadOnly === 'true',
      studentId,
      limit: limit ? Number(limit) : 20,
      offset: offset ? Number(offset) : 0,
    });
    return { success: true, ...data };
  }

  @Put('inbound/:id/read')
  @RequirePermission('students.view')
  async markRead(@Request() req: any, @Param('id') id: string) {
    await this.handleInbound.markRead(req.user.tenantId, id);
    return { success: true };
  }

  // ─── Check Phone ──────────────────────────────────────────
  @Post('check-phone')
  @RequirePermission('settings.view')
  async checkPhone(@Request() req: any, @Body() body: any) {
    const { phone } = body;
    try {
      const result = await this.provider.checkPhone(req.user.tenantId, phone);
      return { success: true, data: result };
    } catch {
      return { success: true, data: { exists: false } };
    }
  }

  // ─── Test Send ────────────────────────────────────────────

  @Post('test')
  @RequirePermission('settings.edit')
  async sendTest(@Request() req: any, @Body() body: any) {
    const parsed = SendTestSchema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', parsed.error.message, 400);
    const result = await this.sendNotification.execute({
      tenantId: req.user.tenantId,
      phone: parsed.data.phone,
      templateKey: parsed.data.templateKey as WaTemplateKey,
      vars: {
        student_name: 'أحمد محمد',
        subject: 'الرياضيات',
        date: new Date().toLocaleDateString('ar-EG'),
        time: new Date().toLocaleTimeString('ar-EG'),
        amount: '500',
        days: '7',
        count: '3',
        center_name: 'نبغة',
        group_name: 'الأول الثانوي',
      },
    });
    return { success: true, data: result };
  }
}
