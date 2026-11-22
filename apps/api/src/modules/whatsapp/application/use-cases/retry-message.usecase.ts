import { Inject, Injectable } from '@nestjs/common';
import { IWaProvider, WA_PROVIDER } from '../../domain/interfaces/wa-provider.interface';
import {
  IWaMessageRepository, WA_MESSAGE_REPOSITORY,
  IWaSettingsRepository, WA_SETTINGS_REPOSITORY,
  IWaSessionRepository, WA_SESSION_REPOSITORY,
} from '../../domain/repositories/wa.repository.interface';
import { WaMessageEntity } from '../../domain/entities/wa-message.entity';
import { AppError } from '../../../../core/errors/app.error';

// إعادة إرسال يدوية لرسالة واحدة فشلت — بيضغط عليها المدرس بنفسه من سجل الرسائل
// (زر ↻ جمب الرسالة الفاشلة). بتتبع نفس نص الرسالة المحفوظ وقت الفشل (من غير إعادة
// توليد القالب)، وبتمر على نفس شروط الأمان اللي الإعادة التلقائية (retry-failed-messages
// cron) بتتحقق منها قبل أي محاولة إرسال فعلية — عشان مفيش أي طريق يتخطى حماية الحظر
// (تفعيل الواتساب، ساعات الإرسال، الاتصال، الحد اليومي). الإرسال نفسه بيعدي على
// BaileysProvider.sendMessage() اللي بقى فيه طابور تسلسلي لكل tenant (enqueueSend)،
// فمفيش خطر إرسال متزامن حتى لو المدرس ضغط ريتراي على أكتر من رسالة بسرعة.
@Injectable()
export class RetryMessageUseCase {
  constructor(
    @Inject(WA_PROVIDER) private readonly provider: IWaProvider,
    @Inject(WA_MESSAGE_REPOSITORY) private readonly messageRepo: IWaMessageRepository,
    @Inject(WA_SETTINGS_REPOSITORY) private readonly settingsRepo: IWaSettingsRepository,
    @Inject(WA_SESSION_REPOSITORY) private readonly sessionRepo: IWaSessionRepository,
  ) {}

  async execute(tenantId: string, messageId: string): Promise<WaMessageEntity> {
    const message = await this.messageRepo.findById(tenantId, messageId);
    if (!message) throw new AppError('NOT_FOUND', 'الرسالة غير موجودة', 404);
    if (message.status !== 'failed') {
      throw new AppError('INVALID_STATUS', 'إعادة الإرسال متاحة فقط للرسائل الفاشلة', 400);
    }

    const settings = await this.settingsRepo.findByTenantId(tenantId);
    if (!settings?.waEnabled) throw new AppError('WA_DISABLED', 'خدمة الواتساب غير مفعّلة حاليًا', 400);
    if (!settings.isWithinSendHours()) {
      throw new AppError('OUTSIDE_SEND_HOURS', 'خارج ساعات الإرسال المسموح بها حاليًا', 400);
    }

    const session = await this.sessionRepo.findByTenantId(tenantId);
    if (!session?.isConnected) throw new AppError('NOT_CONNECTED', 'الواتساب غير متصل حاليًا', 400);

    const sentToday = await this.messageRepo.countTodayByTenantId(tenantId);
    const dailyLimit = session.getCurrentDailyLimit(settings.dailyLimit, settings.warmupEnabled);
    if (sentToday >= dailyLimit) {
      throw new AppError('DAILY_LIMIT_REACHED', 'تم الوصول للحد اليومي المسموح به من الرسائل', 400);
    }

    // من هنا فصاعدًا المحاولة بدأت فعليًا — نتائج الإرسال نفسه (نجاح/فشل تاني) بترجع
    // عادي مع الرسالة المحدّثة، مش كـ AppError، عشان الفرونت يقدر يعرضها inline
    // زي أي حالة فشل عادية بدل ما يتعامل معاها كخطأ في الطلب نفسه.
    const result = await this.provider.sendMessage(tenantId, message.phone, message.body);
    if (result.success) {
      message.markSent();
    } else {
      message.markFailed(result.error || 'فشلت المحاولة');
    }
    await this.messageRepo.save(message);

    return message;
  }
}
