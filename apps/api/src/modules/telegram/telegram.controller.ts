import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/infrastructure/guards/jwt-auth.guard';
import { TenantGuard } from '../../shared/infrastructure/guards/tenant.guard';
import { RolesGuard } from '../../shared/infrastructure/guards/roles.guard';
import { PermissionGuard } from '../../shared/infrastructure/guards/permission.guard';
import { RequirePermission } from '../../shared/infrastructure/guards/permission.decorator';
import { TelegramService } from './telegram.service';
import { TelegramPollingService } from './application/services/telegram-polling.service';
import { SendTelegramLinksUseCase } from './application/use-cases/send-telegram-links.usecase';
import { UpdateTelegramSettingsUseCase } from './application/use-cases/update-telegram-settings.usecase';
import { UpdateTelegramTemplateUseCase } from './application/use-cases/update-telegram-template.usecase';
import { HandleTelegramInboundUseCase } from './application/use-cases/handle-telegram-inbound.usecase';
import { GetTelegramMessagesUseCase } from './application/use-cases/get-telegram-messages.usecase';
import { GetTelegramLinkStatusUseCase } from './application/use-cases/get-telegram-link-status.usecase';
import { TelegramTemplateKey } from './domain/entities/telegram-template.entity';
import { ModuleSettingsRepository } from '../settings/infrastructure/settings.repository';
import { ResolveAudienceSchema } from '../whatsapp/application/dtos/wa.dto';
import { AppError } from '../../core/errors/app.error';
import { z } from 'zod';

// ملحوظة معمارية: مفيش أي endpoint عام (بدون auth) في الموديول ده خالص —
// الاستقبال بقى عن طريق Long Polling (TelegramPollingService) مش Webhook، فمفيش
// حاجة اسمها "endpoint بيستقبل من تليجرام مباشرة" أصلاً تحتاج تتقفل. كل حاجة هنا
// محمية بنفس pipeline الـ guards المستخدم في باقي الموديولات.
@Controller('telegram')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, PermissionGuard)
export class TelegramController {
  constructor(
    private readonly telegram: TelegramService,
    private readonly polling: TelegramPollingService,
    private readonly settingsRepo: ModuleSettingsRepository,
    private readonly sendLinks: SendTelegramLinksUseCase,
    private readonly notifySettings: UpdateTelegramSettingsUseCase,
    private readonly notifyTemplates: UpdateTelegramTemplateUseCase,
    private readonly inbound: HandleTelegramInboundUseCase,
    private readonly getMessages: GetTelegramMessagesUseCase,
    private readonly getLinkStatus: GetTelegramLinkStatusUseCase,
  ) {}

  // كانت GET/PUT /settings/telegram جوه settings.controller.ts — نُقلت هنا لأن
  // حفظ التوكن محتاج يبدأ الـ polling فورًا (startPollingForTenant)، وده منطقي
  // يعيش جوه موديول تيليجرام نفسه بدل ما نعمل تبعية دائرية بين الموديولين.
  @Get('settings')
  @RequirePermission('settings.view')
  async getSettings(@Request() req: any) {
    const token = await this.telegram.getBotToken(req.user.tenantId);
    return { success: true, data: { hasToken: !!token } };
  }

  @Put('settings')
  @RequirePermission('settings.edit')
  async saveSettings(@Request() req: any, @Body() body: any) {
    const tenantId = req.user.tenantId;
    if (body.token !== undefined) {
      // لازم كل مركز يكون ليه بوت تليجرام خاص به (زي رقم الواتساب بالظبط) —
      // Telegram Bot API بيسمح بمستهلك getUpdates واحد بس لكل توكن، فلو نفس
      // التوكن اتسجل عند مركزين هيحصل تصادم وضياع رسايل. نرفض الحفظ من الأول
      // بدل ما نسيب المشكلة تظهر بصمت بعد كده.
      const conflictTenantName = await this.telegram.findTenantUsingToken(body.token, tenantId);
      if (conflictTenantName) {
        throw new AppError(
          'TELEGRAM_TOKEN_ALREADY_USED',
          `هذا التوكن مستخدم بالفعل في مركز آخر (${conflictTenantName}). كل مركز لازم يكون له بوت تليجرام خاص به — أنشئ بوت جديد من @BotFather على تليجرام واحصل على توكن مختلف.`,
          409,
        );
      }
      await this.settingsRepo.set(tenantId, 'telegram_bot_token', body.token);
      // التوكن الجديد يشتغل فورًا لو صحيح — ده بديل زرار "ضبط Webhook" القديم بالكامل
      const botInfo = await this.telegram.getBotInfo(tenantId);
      if (botInfo) this.polling.startPollingForTenant(tenantId);
    }
    return { success: true };
  }

  @Get('bot-info')
  @RequirePermission('settings.view')
  async getBotInfo(@Request() req: any) {
    const info = await this.telegram.getBotInfo(req.user.tenantId);
    return { success: true, data: info };
  }

  // قطع الاتصال — بيوقف الـ polling loop فورًا ويمسح التوكن المحفوظ. الطلاب
  // المربوطين (telegram_links) بيفضلوا زي ما هم من غير أي تغيير — لو حصل ربط
  // بتوكن جديد بعدين، تاريخهم القديم يفضل موجود.
  @Post('disconnect')
  @RequirePermission('settings.edit')
  async disconnect(@Request() req: any) {
    const tenantId = req.user.tenantId;
    this.polling.stopPollingForTenant(tenantId);
    await this.telegram.disconnect(tenantId);
    return { success: true };
  }

  // صلاحية students.view مش settings.* — أي حد يقدر يشوف بروفايل الطالب المفروض
  // يقدر يبعتله رابط تليجرام، مش بس أدمن الإعدادات
  @Get('deep-link/student/:studentCode')
  @RequirePermission('students.view')
  async getStudentDeepLink(@Request() req: any, @Param('studentCode') studentCode: string) {
    const link = await this.telegram.getDeepLink(req.user.tenantId, studentCode);
    return { success: true, data: { link } };
  }

  // ─── حالة ربط تليجرام لمجموعة طلاب (شاشة "حالة الربط") ──────────────────
  // الفرونت إند بيحدد قائمة الطلاب بنفسه أولاً عبر GET /whatsapp/audience
  // (نفس آلية اختيار الجمهور المستخدمة في الإرسال الجماعي: كل الطلاب/مجموعة/
  // مادة+صف/صف كامل/مدرس)، وهنا بنرجّع بس حالة الربط لكل واحد فيهم — صفر
  // تكرار لمنطق فلترة الطلاب الموجود بالفعل في ResolveAudienceUseCase.
  @Post('link-status')
  @RequirePermission('students.view')
  async getLinkStatusForStudents(@Request() req: any, @Body() body: any) {
    const schema = z.object({ studentIds: z.array(z.string().uuid()).min(1).max(2000) });
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', parsed.error.message, 400);
    const data = await this.getLinkStatus.execute(req.user.tenantId, parsed.data.studentIds);
    return { success: true, data };
  }

  // إرسال جماعي لروابط الربط لأولياء الأمور عن طريق بوت الواتساب المتصل بالفعل
  // (مش بوت تليجرام) — نفس صلاحية أي إرسال جماعي واتساب موجود بالفعل في الكتالوج
  @Post('bulk-links')
  @RequirePermission('reports.send_whatsapp')
  async sendBulkLinks(@Request() req: any, @Body() body: any) {
    const parsed = ResolveAudienceSchema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', parsed.error.message, 400);
    const data = await this.sendLinks.execute({
      tenantId: req.user.tenantId,
      createdBy: req.user.sub,
      audience: parsed.data,
    });
    return { success: true, data };
  }

  @Delete('bulk-links/:jobId')
  @RequirePermission('reports.send_whatsapp')
  async cancelBulkLinks(@Request() req: any, @Param('jobId') jobId: string) {
    if (!z.string().uuid().safeParse(jobId).success) throw new AppError('VALIDATION_ERROR', 'معرّف غير صحيح', 400);
    await this.sendLinks.cancel(req.user.tenantId, jobId);
    return { success: true };
  }

  // ─── إعدادات إشعارات تليجرام (منفصلة تمامًا عن /telegram/settings الخاصة
  // بتوكن البوت، وعن إعدادات الواتساب) ─────────────────────────────────────
  @Get('notify-settings')
  @RequirePermission('settings.view')
  async getNotifySettings(@Request() req: any) {
    const data = await this.notifySettings.getOrCreate(req.user.tenantId);
    return { success: true, data };
  }

  @Put('notify-settings')
  @RequirePermission('settings.edit')
  async updateNotifySettings(@Request() req: any, @Body() body: any) {
    const data = await this.notifySettings.execute({ tenantId: req.user.tenantId, ...body });
    return { success: true, data };
  }

  // ─── سجل الرسائل الصادرة (بحث/فلترة/صفحات) — مرآة لـ GET /whatsapp/messages
  @Get('messages')
  @RequirePermission('settings.view')
  async getMessagesLog(@Request() req: any, @Query() query: any) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const status = query.status || undefined;
    const search = query.search?.trim() || undefined;
    const from = query.from || undefined;
    const to = query.to || undefined;
    const data = await this.getMessages.execute(req.user.tenantId, { page, limit, status, search, from, to });
    return { success: true, data };
  }

  // ─── قوالب تليجرام (منفصلة تمامًا عن قوالب الواتساب) ────────────────────
  @Get('templates')
  @RequirePermission('settings.view')
  async getTemplates(@Request() req: any) {
    const data = await this.notifyTemplates.getAllTemplates(req.user.tenantId);
    return { success: true, data };
  }

  @Put('templates/:key')
  @RequirePermission('settings.edit')
  async updateTemplate(@Request() req: any, @Param('key') key: string, @Body() body: any) {
    const data = await this.notifyTemplates.execute({
      tenantId: req.user.tenantId,
      key: key as TelegramTemplateKey,
      body: body.body,
    });
    return { success: true, data };
  }

  @Post('templates/:key/reset')
  @RequirePermission('settings.edit')
  async resetTemplate(@Request() req: any, @Param('key') key: string) {
    const data = await this.notifyTemplates.resetToDefault(req.user.tenantId, key as TelegramTemplateKey);
    return { success: true, data };
  }

  // ─── صندوق الوارد (الميزة التنافسية الجديدة: محادثة ثنائية فعلية) ────────
  @Get('inbound')
  @RequirePermission('students.view')
  async getInbound(
    @Request() req: any,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('entityId') entityId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const data = await this.inbound.getInboundMessages(req.user.tenantId, {
      unreadOnly: unreadOnly === 'true',
      entityId,
      limit: limit ? Number(limit) : 20,
      offset: offset ? Number(offset) : 0,
    });
    return { success: true, ...data };
  }

  @Put('inbound/:id/read')
  @RequirePermission('students.view')
  async markInboundRead(@Request() req: any, @Param('id') id: string) {
    await this.inbound.markRead(req.user.tenantId, id);
    return { success: true };
  }
}
