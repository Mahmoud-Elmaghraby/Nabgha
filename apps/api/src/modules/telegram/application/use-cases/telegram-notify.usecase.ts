import { Injectable, Logger } from '@nestjs/common';
import { TelegramSettingsRepository } from '../../infrastructure/telegram-settings.repository';
import { TelegramTemplatesRepository } from '../../infrastructure/telegram-templates.repository';
import { TelegramMessagesRepository } from '../../infrastructure/telegram-messages.repository';
import { TelegramLinksRepository, TelegramEntityType } from '../../infrastructure/telegram-links.repository';
import { TelegramService } from '../../telegram.service';
import { TelegramTemplateKey } from '../../domain/entities/telegram-template.entity';
import { TelegramSettingsEntity } from '../../domain/entities/telegram-settings.entity';

export interface TelegramNotifyInput {
  tenantId: string;
  entityType: TelegramEntityType;
  entityId: string;
  templateKey: TelegramTemplateKey;
  vars: Record<string, string>;
  /** لو موجودة، بتتبعت كصورة مرفقة (sendPhoto) والنص بيبقى الـ caption بدل رسالة نصية عادية */
  imageBuffer?: Buffer;
}

export interface TelegramNotifyResult {
  success: boolean;
  error?: string;
}

/**
 * القلب الجديد — مرآة لـ SendNotificationUseCase (whatsapp) بس من غير تعقيد
 * الحماية من الحظر (بوت تليجرام الرسمي مالوش مخاطر حظر). دي نقطة الوصل
 * "الإضافية" اللي بتتنادى من finance/groups/sessions/students **بعد** نداء
 * الواتساب الأصلي، من غير ما تلمسه أو تأثر فيه — أي خطأ هنا بيتلقّط في مكان
 * النداء نفسه (catch منفصل)، فمستحيل يوقف أو يأثر على مسار الواتساب.
 */
@Injectable()
export class TelegramNotifyUseCase {
  private readonly logger = new Logger(TelegramNotifyUseCase.name);

  constructor(
    private readonly settingsRepo: TelegramSettingsRepository,
    private readonly templateRepo: TelegramTemplatesRepository,
    private readonly messagesRepo: TelegramMessagesRepository,
    private readonly links: TelegramLinksRepository,
    private readonly telegram: TelegramService,
  ) {}

  async execute(input: TelegramNotifyInput): Promise<TelegramNotifyResult> {
    const { tenantId, entityType, entityId, templateKey, vars, imageBuffer } = input;

    const settings = await this.settingsRepo.findByTenantId(tenantId);
    if (!settings?.telegramEnabled) {
      return { success: false, error: 'telegram_disabled' };
    }

    const flagKey = this.resolveFlagKey(templateKey, vars);
    if (flagKey && !(settings as any)[flagKey]) {
      this.logger.debug(`Telegram notification toggle off for ${templateKey} (flag: ${flagKey}) — tenant ${tenantId}`);
      return { success: false, error: 'notification_disabled' };
    }

    if (!settings.isWithinSendHours()) {
      // ساعات هدوء اختيارية بس — مش زي الواتساب، هنا مفيش "قائمة انتظار
      // لإعادة المحاولة" لأنه مفيش سبب حظر نتفاداه؛ ببساطة نتخطى الإرسال دلوقتي.
      return { success: false, error: 'outside_send_hours' };
    }

    const chatId = await this.links.findChatId(tenantId, entityType, entityId);
    if (!chatId) {
      // الحالة الطبيعية لأغلب الطلاب لسه — مش خطأ نسجّله بصوت عالي
      return { success: false, error: 'not_linked' };
    }

    const template = await this.templateRepo.findByKey(tenantId, templateKey);
    if (!template) {
      return { success: false, error: 'template_not_found' };
    }

    const body = template.render(vars);

    const message = await this.messagesRepo.create({
      tenantId, chatId, entityType, entityId, templateKey, body,
    });

    const sent = imageBuffer
      ? await this.telegram.sendPhoto(tenantId, chatId, imageBuffer, body)
      : await this.telegram.sendMessage(tenantId, chatId, body);

    if (sent) {
      message.markSent();
    } else {
      message.markFailed('send_failed');
    }
    await this.messagesRepo.save(message);

    return { success: sent, error: sent ? undefined : 'send_failed' };
  }

  private resolveFlagKey(templateKey: TelegramTemplateKey, vars: Record<string, string>): keyof TelegramSettingsEntity | null {
    if (templateKey === 'PAYMENT_DUE') {
      return vars.days === '1' ? 'notifyPaymentDue1d' : 'notifyPaymentDue7d';
    }
    const map: Partial<Record<TelegramTemplateKey, keyof TelegramSettingsEntity>> = {
      NEW_STUDENT: 'notifyNewStudent',
      GROUP_ADDED: 'notifyGroupAdded',
      GROUP_REMOVED: 'notifyGroupRemoved',
      ABSENT: 'notifyAbsent',
      PRESENT: 'notifyPresent',
      LATE: 'notifyLate',
      THREE_ABSENCES: 'notify3Absences',
      PAYMENT_CONFIRM: 'notifyPaymentConfirm',
      PAYMENT_OVERDUE: 'notifyPaymentOverdue',
      ABSENCE_EXCUSED: 'notifyAbsenceExcused',
      GRADE_RECORDED: 'notifyGradeRecorded',
    };
    return map[templateKey] ?? null;
  }
}
