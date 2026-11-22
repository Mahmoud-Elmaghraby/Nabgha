import { Inject, Injectable, Logger } from '@nestjs/common';
import { IWaProvider, WA_PROVIDER } from '../../domain/interfaces/wa-provider.interface';
import { IWaSessionRepository, WA_SESSION_REPOSITORY } from '../../domain/repositories/wa.repository.interface';
import { IWaSettingsRepository, WA_SETTINGS_REPOSITORY } from '../../domain/repositories/wa.repository.interface';
import { IWaTemplateRepository, WA_TEMPLATE_REPOSITORY } from '../../domain/repositories/wa.repository.interface';
import { IWaMessageRepository, WA_MESSAGE_REPOSITORY } from '../../domain/repositories/wa.repository.interface';
import { WaTemplateKey } from '../../domain/entities/wa-template.entity';
import { KyselyService } from '../../../../shared/infrastructure/database/kysely.service';

export interface SendNotificationInput {
  tenantId: string;
  phone: string;
  templateKey: WaTemplateKey;
  vars: Record<string, string>;
  bulkJobId?: string;
  /** لو موجودة، بتتبعت كصورة مرفقة والنص بيبقى الـ caption بدل رسالة نصية عادية */
  imageBuffer?: Buffer;
  /** للاختبار/الإرسال اليدوي المتعمّد: تجاوز حماية منع التكرار */
  allowDuplicate?: boolean;
}

@Injectable()
export class SendNotificationUseCase {
  private readonly logger = new Logger(SendNotificationUseCase.name);

  constructor(
    @Inject(WA_PROVIDER) private readonly provider: IWaProvider,
    @Inject(WA_SESSION_REPOSITORY) private readonly sessionRepo: IWaSessionRepository,
    @Inject(WA_SETTINGS_REPOSITORY) private readonly settingsRepo: IWaSettingsRepository,
    @Inject(WA_TEMPLATE_REPOSITORY) private readonly templateRepo: IWaTemplateRepository,
    @Inject(WA_MESSAGE_REPOSITORY) private readonly messageRepo: IWaMessageRepository,
    private readonly kysely: KyselyService,
  ) {}

  async execute(input: SendNotificationInput): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const { tenantId, phone, templateKey, vars, bulkJobId, imageBuffer, allowDuplicate } = input;

    const settings = await this.settingsRepo.findByTenantId(tenantId);
    if (!settings?.waEnabled) {
      this.logger.debug(`WA disabled for tenant ${tenantId}`);
      return { success: false, error: 'wa_disabled' };
    }

    const template = await this.templateRepo.findByKey(tenantId, templateKey);
    if (!template) {
      return { success: false, error: 'template_not_found' };
    }

    // Check per-template notification toggle from settings
    const notifyFlagMap: Partial<Record<WaTemplateKey, keyof typeof settings>> = {
      NEW_STUDENT: 'notifyNewStudent',
      GROUP_ADDED: 'notifyGroupAdded',
      GROUP_REMOVED: 'notifyGroupRemoved',
      ABSENT: 'notifyAbsent',
      PRESENT: 'notifyPresent',
      LATE: 'notifyLate',
      THREE_ABSENCES: 'notify3Absences',
      PAYMENT_CONFIRM: 'notifyPaymentConfirm',
      // PAYMENT_DUE يُستخدم لأكثر من تذكير (7 أيام و 1 يوم) يتم التحقق من الإعداد المناسب حسب vars.days
      PAYMENT_OVERDUE: 'notifyPaymentOverdue',
      ABSENCE_EXCUSED: 'notifyAbsenceExcused',
      GRADE_RECORDED: 'notifyGradeRecorded',
    };
    let flagKey = notifyFlagMap[templateKey];
    // معالجة خاصة لـ PAYMENT_DUE: لو days = '1' نتحقق من notifyPaymentDue1d، وإلا notifyPaymentDue7d
    if (templateKey === 'PAYMENT_DUE') {
      flagKey = vars.days === '1' ? 'notifyPaymentDue1d' : 'notifyPaymentDue7d';
    }
    if (flagKey && !(settings as any)[flagKey]) {
      this.logger.debug(`Notification toggle off for ${templateKey} (flag: ${flagKey}) — tenant ${tenantId}`);
      return { success: false, error: 'notification_disabled' };
    }

    const body = template.render(vars);

    // ⚠️ حماية من التكرار (Oct 2026): نفس الرسالة بالظبط لنفس الرقم خلال دقيقتين (ضغطة
    // مزدوجة، نداء مكرر، إعادة محاولة من الواجهة) بتتتجاهل بدل ما تتبعت مرتين.
    // الدرجات (المدرس بيتحكم فيها بنفسه) والاختبار مستثنيين.
    if (!allowDuplicate && templateKey !== 'GRADE_RECORDED' && !bulkJobId) {
      try {
        const db = this.kysely.getTenantDb(tenantId);
        const dup = await db
          .selectFrom('wa_messages_log' as any)
          .select('id' as any)
          .where('phone' as any, '=', phone)
          .where('template_key' as any, '=', templateKey)
          .where('body' as any, '=', body)
          .where('created_at' as any, '>=', new Date(Date.now() - 2 * 60 * 1000))
          .limit(1)
          .executeTakeFirst();
        if (dup) {
          this.logger.warn(`Duplicate ${templateKey} to ${phone} within 2 minutes — skipped`);
          return { success: false, error: 'duplicate_recent' };
        }
      } catch (err: any) {
        this.logger.warn(`Duplicate check failed (continuing): ${err.message}`);
      }
    }

    // الحالات دي مؤقتة/ممكن تتصلح لوحدها (ساعات الإرسال، الاتصال، الحظر) —
    // لازم نسجّلها كرسالة فاشلة قابلة لإعادة المحاولة بدل ما نرفض الطلب من غير
    // أي أثر في قاعدة البيانات، عشان retry-failed-messages.usecase.ts يقدر يلتقطها
    // ويحاول يبعتها تاني بدل ما تضيع نهائي بصمت.
    if (!settings.isWithinSendHours()) {
      this.logger.debug(`Outside send hours for tenant ${tenantId}`);
      const queued = await this.messageRepo.create({
        tenantId, phone, templateKey, body,
        status: 'pending', bulkJobId: bulkJobId ?? null,
      });
      queued.markFailed('outside_send_hours');
      await this.messageRepo.save(queued);
      return { success: false, error: 'outside_send_hours' };
    }

    const session = await this.sessionRepo.findByTenantId(tenantId);
    if (!session?.isConnected) {
      const queued = await this.messageRepo.create({
        tenantId, phone, templateKey, body,
        status: 'pending', bulkJobId: bulkJobId ?? null,
      });
      queued.markFailed('not_connected');
      await this.messageRepo.save(queued);
      return { success: false, error: 'not_connected' };
    }

    if (session.isBanned) {
      const queued = await this.messageRepo.create({
        tenantId, phone, templateKey, body,
        status: 'pending', bulkJobId: bulkJobId ?? null,
      });
      queued.markFailed('session_banned');
      await this.messageRepo.save(queued);
      return { success: false, error: 'session_banned' };
    }

    // فحص الحد اليومي — كان معطّل بالكامل قبل كده، وده كان بيلغي الغرض من نظام الـ warmup
    const sentToday = await this.messageRepo.countTodayByTenantId(tenantId);
    const dailyLimit = session.getCurrentDailyLimit(settings.dailyLimit, settings.warmupEnabled);
    if (sentToday >= dailyLimit) {
      this.logger.warn(`Daily limit reached for tenant ${tenantId} (${sentToday}/${dailyLimit}) — message queued for retry`);
      const queued = await this.messageRepo.create({
        tenantId, phone, templateKey, body,
        status: 'pending', bulkJobId: bulkJobId ?? null,
      });
      queued.markFailed('daily_limit_reached');
      await this.messageRepo.save(queued);
      return { success: false, error: 'daily_limit_reached' };
    }

    const message = await this.messageRepo.create({
      tenantId, phone, templateKey, body,
      status: 'pending', bulkJobId: bulkJobId ?? null,
    });

    // الفاصل بين الرسايل بيتحسب جوه طابور الإرسال نفسه (BaileysProvider) من وقت آخر
    // رسالة اتبعتت فعلاً — مش هنا، عشان الإشعارات المتوازية ماتخلصش انتظار مع بعض
    const result = imageBuffer
      ? await this.provider.sendImage(tenantId, phone, imageBuffer, body)
      : await this.provider.sendMessage(tenantId, phone, body);

    if (result.success) {
      message.markSent();
    } else {
      message.markFailed(result.error ?? 'unknown');
    }

    await this.messageRepo.save(message);

    return result;
  }

  private randomDelay(min: number, max: number): number {
    return (Math.random() * (max - min) + min) * 1000;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
