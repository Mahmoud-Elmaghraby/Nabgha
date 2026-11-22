import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { TelegramService } from '../../telegram.service';
import { TelegramCommandRegistry } from './telegram-command-registry';

const STARTUP_DELAY_MS = 5000;
const BACKOFF_INITIAL_MS = 5000;
const BACKOFF_MAX_MS = 5 * 60 * 1000; // 5 دقايق

interface TenantLoopState {
  stopped: boolean;
  backoffMs: number;
}

/**
 * بتدير loop مستقل لكل tenant عنده توكن بوت محفوظ، بينادي Long Polling
 * (TelegramService.getUpdates) بدل ما يستنى Webhook. نفس روح
 * RestoreSessionsUseCase بتاع الواتساب (whatsapp/application/use-cases/
 * restore-sessions.usecase.ts): تأخير بعد الإقلاع + استرجاع كل الـ tenants
 * النشطين تلقائيًا، لكن هنا بدل "استعادة اتصال Baileys" بنستعيد "استمرار الـ
 * polling loop".
 */
@Injectable()
export class TelegramPollingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramPollingService.name);
  private readonly loops = new Map<string, TenantLoopState>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
    private readonly commands: TelegramCommandRegistry,
  ) {}

  onModuleInit(): void {
    setTimeout(() => this.restoreAll(), STARTUP_DELAY_MS);
  }

  onModuleDestroy(): void {
    for (const state of this.loops.values()) state.stopped = true;
  }

  private async restoreAll(): Promise<void> {
    try {
      const tenants = await this.prisma.tenant.findMany({ where: { isActive: true }, select: { id: true, name: true } });
      // بنمنع نفس التوكن يبقى له أكتر من polling loop شغال في نفس الوقت —
      // Telegram Bot API بيسمح بمستهلك getUpdates واحد بس لكل توكن، فلو حصل
      // تصادم (بيانات قديمة من قبل ما إتضاف الفحص في وقت الحفظ) بنوقف بدء الـ
      // loop للتينانت التاني بدل ما نسيبهم يتنازعوا على الرسايل بصمت.
      const tokenOwners = new Map<string, string>(); // token -> اسم أول tenant استخدمه
      for (const tenant of tenants) {
        const token = await this.telegram.getBotToken(tenant.id);
        if (!token) continue;
        const owner = tokenOwners.get(token);
        if (owner) {
          this.logger.warn(
            `تعارض توكن تليجرام: المركز "${tenant.name}" بيستخدم نفس توكن المركز "${owner}" — ` +
              `مش هيتبدأله polling عشان نتفادى تصادم Telegram (409 Conflict) وضياع الرسايل. ` +
              `لازم كل مركز يكون له بوت تليجرام منفصل (زي رقم الواتساب بالظبط).`,
          );
          continue;
        }
        tokenOwners.set(token, tenant.name);
        this.startPollingForTenant(tenant.id);
      }
    } catch (err: any) {
      this.logger.error(`Failed to restore telegram polling: ${err.message}`);
    }
  }

  /**
   * بتتنادى فور نجاح حفظ/تحقق توكن جديد من شاشة الإعدادات — دي اللي بتحل محل
   * زرار "ضبط Webhook" القديم بالكامل، ومفيش أي endpoint HTTP عام مطلوب هنا خالص.
   */
  startPollingForTenant(tenantId: string): void {
    this.stopPollingForTenant(tenantId);
    const state: TenantLoopState = { stopped: false, backoffMs: 0 };
    this.loops.set(tenantId, state);
    this.logger.log(`Starting Telegram polling for tenant ${tenantId}`);
    void this.loop(tenantId, state);
  }

  stopPollingForTenant(tenantId: string): void {
    const state = this.loops.get(tenantId);
    if (state) state.stopped = true;
    this.loops.delete(tenantId);
  }

  private async loop(tenantId: string, state: TenantLoopState): Promise<void> {
    while (!state.stopped) {
      try {
        const updates = await this.telegram.getUpdates(tenantId);
        state.backoffMs = 0; // نجاح — رجّع الـ backoff لصفر
        for (const update of updates) {
          if (state.stopped) break;
          await this.commands.dispatch(tenantId, { chatId: update.chatId, text: update.text });
        }
      } catch (err: any) {
        state.backoffMs = state.backoffMs === 0 ? BACKOFF_INITIAL_MS : Math.min(state.backoffMs * 2, BACKOFF_MAX_MS);
        this.logger.warn(
          `Telegram polling error (tenant ${tenantId}): ${err.message} — retry in ${state.backoffMs / 1000}s`,
        );
        await this.sleep(state.backoffMs);
      }
    }
    this.logger.log(`Telegram polling stopped for tenant ${tenantId}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
