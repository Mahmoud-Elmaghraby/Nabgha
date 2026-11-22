import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Inject } from '@nestjs/common';
import { IWaProvider, WA_PROVIDER } from '../../domain/interfaces/wa-provider.interface';
import { IWaMessageRepository, WA_MESSAGE_REPOSITORY } from '../../domain/repositories/wa.repository.interface';
import { IWaSettingsRepository, WA_SETTINGS_REPOSITORY } from '../../domain/repositories/wa.repository.interface';
import { IWaSessionRepository, WA_SESSION_REPOSITORY } from '../../domain/repositories/wa.repository.interface';
import { IWaTemplateRepository, WA_TEMPLATE_REPOSITORY } from '../../domain/repositories/wa.repository.interface';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { KyselyService } from '../../../../shared/infrastructure/database/kysely.service';
import { sql } from 'kysely';

const MAX_RETRIES = 3;

// ⚠️ تصليح (Oct 2026): الرسائل اللي بتتأخر (واتساب فاصل، خارج ساعات الإرسال، الحد اليومي)
// كانت بتتبعت بعد ساعات أو أيام — "غياب" أو "مطلوب دفع" بتوصل متأخر وغالبًا بقت غلط
// (الطالب حضر أو الأب دفع في الوقت ده). دلوقتي كل نوع رسالة له عمر أقصى بعده
// بتتعلّم "منتهية" وبتتوقف نهائيًا بدل ما تتبعت. (الرسائل الجماعية بدون قالب بتفضل زي ما هي.)
const MESSAGE_TTL_HOURS: Record<string, number> = {
  ABSENT: 3, PRESENT: 3, LATE: 3, ABSENCE_EXCUSED: 3, THREE_ABSENCES: 6,
  PAYMENT_DUE: 6, PAYMENT_OVERDUE: 6, PAYMENT_CONFIRM: 24,
  GRADE_RECORDED: 24, NEW_STUDENT: 24, GROUP_ADDED: 24, GROUP_REMOVED: 24, TELEGRAM_LINK: 48,
};
const RETRYABLE_ERRORS = ['not_connected', 'outside_send_hours', 'circuit_open', 'daily_limit_reached'];

@Injectable()
export class RetryFailedMessagesUseCase {
  private readonly logger = new Logger(RetryFailedMessagesUseCase.name);

  constructor(
    @Inject(WA_PROVIDER) private readonly provider: IWaProvider,
    @Inject(WA_MESSAGE_REPOSITORY) private readonly messageRepo: IWaMessageRepository,
    @Inject(WA_SETTINGS_REPOSITORY) private readonly settingsRepo: IWaSettingsRepository,
    @Inject(WA_SESSION_REPOSITORY) private readonly sessionRepo: IWaSessionRepository,
    @Inject(WA_TEMPLATE_REPOSITORY) private readonly templateRepo: IWaTemplateRepository,
    private readonly prisma: PrismaService,
    private readonly kysely: KyselyService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async retryAll(): Promise<void> {
    // desktop mode — الـ WhatsApp شغال عادي
    try {
      const tenants = await this.prisma.tenant.findMany({
        where: { isActive: true },
        select: { id: true },
      });

      for (const tenant of tenants) {
        await this.retryForTenant(tenant.id);
      }
    } catch (err: any) {
      this.logger.error(`Retry job error: ${err.message}`);
    }
  }

  private async retryForTenant(tenantId: string): Promise<void> {
    const settings = await this.settingsRepo.findByTenantId(tenantId);
    if (!settings?.waEnabled) return;
    if (!settings.isWithinSendHours()) return;

    const session = await this.sessionRepo.findByTenantId(tenantId);
    if (!session?.isConnected) return;

    const db = this.kysely.getTenantDb(tenantId);

    let sentToday = await this.messageRepo.countTodayByTenantId(tenantId);
    const dailyLimit = session.getCurrentDailyLimit(settings.dailyLimit, settings.warmupEnabled);
    if (sentToday >= dailyLimit) return; // الحد اليومي مستهلك — ننتظر اليوم القادم

    // ── 0. إنهاء الرسائل القديمة (انتهت صلاحيتها) قبل اختيار اللي هيتعاد إرساله
    for (const [templateKey, hours] of Object.entries(MESSAGE_TTL_HOURS)) {
      await db.updateTable('wa_messages_log')
        .set({ error_message: 'expired_stale', retry_count: MAX_RETRIES } as any)
        .where('status', '=', 'failed')
        .where('template_key', '=', templateKey)
        .where('error_message', 'in', RETRYABLE_ERRORS)
        .where('created_at', '<', sql<Date>`NOW() - (${hours} * INTERVAL '1 hour')`)
        .execute();
    }

    // ── 1. رسائل وصلت الحد اليومي — نطاق 7 أيام ولا نعدّها كـ retry
    // ⚠️ الحد اتقلل من 10 لـ 3 (Aug 31 2026) — كان بيسمح بلحد 15 رسالة إضافية
    // كل 10 دقايق فوق أي نشاط عادي شغال في نفس الوقت (إشعارات فردية/bulk)،
    // وده بيزوّد فرصة الحظر بلا داعي. راجع تقرير تحليل حظر أرقام المدرسين.
    const limitedMessages = await db
      .selectFrom('wa_messages_log')
      .selectAll()
      .where('status', '=', 'failed')
      .where('error_message', '=', 'daily_limit_reached')
      .where('phone', '<>', '')
      // التقرير الشهري: الرسالة المسجلة هي الكابشن بس (الـ PDF بيتولّد وقت الإرسال) —
      // إعادة إرسال النص لوحده كانت بتوصّل ولي الأمر كابشن من غير ملف
      .where('body', 'not like', 'التقرير الشهري —%')
      // الدرجات: المدرس بيتحكم فيها بزرار صريح (وفيها صورة) — مفيش إعادة إرسال تلقائي
      // عشان ماتتكررش مع الإرسال اليدوي
      .where(sql<boolean>`template_key IS DISTINCT FROM 'GRADE_RECORDED'`)
      .where('created_at', '>=', sql<Date>`NOW() - INTERVAL '7 days'`)
      .orderBy('created_at', 'asc')
      .limit(3)
      .execute();

    // ── 2. رسائل فشلت بسبب انقطاع أو خارج ساعات الإرسال — حد 3 محاولات في 24 ساعة
    // ⚠️ الحد اتقلل من 5 لـ 2 لنفس سبب #1 أعلاه — إجمالي أقصى 5 رسائل retry
    // كل 10 دقايق بدل 15.
    const transientMessages = await db
      .selectFrom('wa_messages_log')
      .selectAll()
      .where('status', '=', 'failed')
      .where('error_message', 'in', ['not_connected', 'outside_send_hours', 'circuit_open'])
      .where('phone', '<>', '')
      // التقرير الشهري: الرسالة المسجلة هي الكابشن بس (الـ PDF بيتولّد وقت الإرسال) —
      // إعادة إرسال النص لوحده كانت بتوصّل ولي الأمر كابشن من غير ملف
      .where('body', 'not like', 'التقرير الشهري —%')
      // الدرجات: المدرس بيتحكم فيها بزرار صريح (وفيها صورة) — مفيش إعادة إرسال تلقائي
      // عشان ماتتكررش مع الإرسال اليدوي
      .where(sql<boolean>`template_key IS DISTINCT FROM 'GRADE_RECORDED'`)
      .where('retry_count', '<', MAX_RETRIES)
      .where('created_at', '>=', sql<Date>`NOW() - INTERVAL '24 hours'`)
      .orderBy('created_at', 'asc')
      .limit(2)
      .execute();

    const allMessages = [...limitedMessages, ...transientMessages];
    if (allMessages.length === 0) return;

    this.logger.log(`Retrying ${allMessages.length} messages for tenant ${tenantId} (${limitedMessages.length} daily-limit, ${transientMessages.length} transient)`);

    for (const msg of allMessages) {
      if (sentToday >= dailyLimit) {
        this.logger.log(`Daily limit reached mid-retry for tenant ${tenantId} — stopping until tomorrow`);
        break;
      }

      const isDailyLimit = msg.error_message === 'daily_limit_reached';

      try {
        const result = await this.provider.sendMessage(tenantId, msg.phone, msg.body);

        if (result.success) {
          await db.updateTable('wa_messages_log')
            .set({
              status: 'sent',
              sent_at: new Date(),
              error_message: null,
            } as any)
            .where('id', '=', sql<string>`${msg.id}::uuid`)
            .execute();
          sentToday++;
          this.logger.log(`Retry succeeded for message ${msg.id}`);
        } else {
          // رسائل الـ daily_limit_reached لا نعدّ retry_count عليها — هي مش فاشلة حقيقي
          // بس وقفت بسبب الحد اليومي، اليوم الجديد بيعيد المحاولة تلقائياً
          const updateData: any = { error_message: result.error };
          if (!isDailyLimit) {
            updateData.retry_count = sql`retry_count + 1`;
          }
          await db.updateTable('wa_messages_log')
            .set(updateData)
            .where('id', '=', sql<string>`${msg.id}::uuid`)
            .execute();
        }
      } catch (err: any) {
        this.logger.error(`Retry failed for message ${msg.id}: ${err.message}`);
      }

      // الفاصل بين الرسايل بيتطبق جوه طابور الإرسال (BaileysProvider)
    }
  }

  private randomDelay(min: number, max: number): number {
    return (Math.random() * (max - min) + min) * 1000;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
