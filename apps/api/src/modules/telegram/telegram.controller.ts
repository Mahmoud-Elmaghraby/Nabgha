import { Controller, Post, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/infrastructure/guards/jwt-auth.guard';
import { TenantGuard } from '../../shared/infrastructure/guards/tenant.guard';
import { RolesGuard } from '../../shared/infrastructure/guards/roles.guard';
import { PermissionGuard } from '../../shared/infrastructure/guards/permission.guard';
import { SkipThrottle } from '@nestjs/throttler';
import { TelegramService } from './telegram.service';
import { ModuleSettingsRepository } from '../settings/infrastructure/settings.repository';

@Controller('telegram')
export class TelegramController {
  constructor(
    private readonly telegram: TelegramService,
    private readonly settingsRepo: ModuleSettingsRepository,
  ) {}

  // Webhook — بيستقبل رسايل من التليجرام (بدون auth)
  @Post('webhook/:tenantId')
  @SkipThrottle()
  async handleWebhook(
    @Param('tenantId') tenantId: string,
    @Body() body: any,
  ) {
    const message = body?.message;
    if (!message?.text || !message?.chat?.id) return { ok: true };

    const chatId = String(message.chat.id);
    const text = message.text.trim();

    // /start STU-00001
    if (text.startsWith('/start')) {
      const studentCode = text.split(' ')[1]?.trim();
      if (studentCode) {
        const saved = await this.telegram.saveChatId(tenantId, studentCode, chatId);
        if (saved) {
          await this.telegram.sendMessage(tenantId, chatId,
            `✅ <b>تم الربط بنجاح!</b>\nستصلك إشعارات الطالب على هذا الحساب.`
          );
        } else {
          await this.telegram.sendMessage(tenantId, chatId,
            `❌ لم يتم العثور على الطالب. تأكد من الرابط.`
          );
        }
      }
    }

    return { ok: true };
  }

  // Endpoints محمية بـ JWT
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, PermissionGuard)
  @Get('bot-info')
  async getBotInfo(@Request() req: any) {
    const info = await this.telegram.getBotInfo(req.user.tenantId);
    return { success: true, data: info };
  }

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, PermissionGuard)
  @Post('setup-webhook')
  async setupWebhook(@Request() req: any) {
    const tenantId = req.user.tenantId;
    const webhookUrl = `${process.env.WEBHOOK_BASE_URL}/api/v1/telegram/webhook/${tenantId}`;
    const ok = await this.telegram.setWebhook(tenantId, webhookUrl);
    return { success: ok, data: { webhookUrl } };
  }

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, PermissionGuard)
  @Get('deep-link/:studentCode')
  async getDeepLink(@Request() req: any, @Param('studentCode') studentCode: string) {
    const link = await this.telegram.getDeepLink(req.user.tenantId, studentCode);
    return { success: true, data: { link } };
  }
}
