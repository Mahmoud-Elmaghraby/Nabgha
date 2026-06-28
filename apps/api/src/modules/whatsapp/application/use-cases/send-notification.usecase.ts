import { Inject, Injectable, Logger } from '@nestjs/common';
import { IWaProvider, WA_PROVIDER } from '../../domain/interfaces/wa-provider.interface';
import { IWaSessionRepository, WA_SESSION_REPOSITORY } from '../../domain/repositories/wa.repository.interface';
import { IWaSettingsRepository, WA_SETTINGS_REPOSITORY } from '../../domain/repositories/wa.repository.interface';
import { IWaTemplateRepository, WA_TEMPLATE_REPOSITORY } from '../../domain/repositories/wa.repository.interface';
import { IWaMessageRepository, WA_MESSAGE_REPOSITORY } from '../../domain/repositories/wa.repository.interface';
import { WaTemplateKey } from '../../domain/entities/wa-template.entity';

export interface SendNotificationInput {
  tenantId: string;
  phone: string;
  templateKey: WaTemplateKey;
  vars: Record<string, string>;
  bulkJobId?: string;
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
  ) {}

  async execute(input: SendNotificationInput): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const { tenantId, phone, templateKey, vars, bulkJobId } = input;

    const settings = await this.settingsRepo.findByTenantId(tenantId);
    if (!settings?.waEnabled) {
      this.logger.debug(`WA disabled for tenant ${tenantId}`);
      return { success: false, error: 'wa_disabled' };
    }

    if (!settings.isWithinSendHours()) {
      this.logger.debug(`Outside send hours for tenant ${tenantId}`);
      return { success: false, error: 'outside_send_hours' };
    }

    const session = await this.sessionRepo.findByTenantId(tenantId);
    if (!session?.isConnected) {
      return { success: false, error: 'not_connected' };
    }

    if (session.isBanned) {
      return { success: false, error: 'session_banned' };
    }

    // Daily limit check disabled

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
      PAYMENT_DUE: 'notifyPaymentDue7d',
      PAYMENT_OVERDUE: 'notifyPaymentOverdue',
    };
    const flagKey = notifyFlagMap[templateKey];
    if (flagKey && !(settings as any)[flagKey]) {
      this.logger.debug(`Notification toggle off for ${templateKey} (flag: ${flagKey}) — tenant ${tenantId}`);
      return { success: false, error: 'notification_disabled' };
    }


    // تحقق من إن الرقم عليه واتساب
    try {
      const phoneCheck = await this.provider.checkPhone(tenantId, phone);
      if (phoneCheck.exists === false) {
        this.logger.warn(`Phone ${phone} is not on WhatsApp — skipping`);
        return { success: false, error: 'phone_not_on_whatsapp' };
      }
    } catch (err: any) {
      this.logger.warn(`checkPhone failed for ${phone}: ${err.message} — proceeding with send`);
    }

    const body = template.render(vars);

    const message = await this.messageRepo.create({
      tenantId, phone, templateKey, body,
      status: 'pending', bulkJobId: bulkJobId ?? null,
    });

    const delay = this.randomDelay(settings.delayMinSeconds, settings.delayMaxSeconds);
    await this.sleep(delay);

    const result = await this.provider.sendMessage(tenantId, phone, body);

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
