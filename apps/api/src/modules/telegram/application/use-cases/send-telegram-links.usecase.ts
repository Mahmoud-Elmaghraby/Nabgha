import { Inject, Injectable, Logger } from '@nestjs/common';
import { ResolveAudienceUseCase } from '../../../whatsapp/application/use-cases/resolve-audience.usecase';
import { SendNotificationUseCase } from '../../../whatsapp/application/use-cases/send-notification.usecase';
import {
  IWaBulkJobRepository, WA_BULK_JOB_REPOSITORY,
  IWaSessionRepository, WA_SESSION_REPOSITORY,
  IWaSettingsRepository, WA_SETTINGS_REPOSITORY,
} from '../../../whatsapp/domain/repositories/wa.repository.interface';
import type { ResolveAudienceDto } from '../../../whatsapp/application/dtos/wa.dto';
import { BrandingService } from '../../../settings/application/services/branding.service';
import { TelegramService } from '../../telegram.service';
import { TelegramLinksRepository } from '../../infrastructure/telegram-links.repository';
import { AppError } from '../../../../core/errors/app.error';

export interface SendTelegramLinksInput {
  tenantId: string;
  createdBy: string;
  audience: ResolveAudienceDto;
}

export interface SendTelegramLinksResult {
  jobId: string | null;
  total: number;
  eligible: number;
  alreadyLinked: number;
}

interface EligibleStudent {
  studentId: string;
  studentName: string;
  studentCode: string;
  parentPhone: string;
}

/**
 * إرسال جماعي لروابط ربط تليجرام لأولياء الأمور — عن طريق بوت الواتساب المتصل
 * بالفعل (مش بوت تليجرام). كل رسالة شخصية برابط الطالب بتاعه بس، فمش ممكن
 * نستخدم SendBulkUseCase (مصمم لنص واحد موحّد لكل المستلمين) — بننادي
 * SendNotificationUseCase لكل ولي أمر لوحده عشان نستفيد مجانًا من كل فحوصات
 * الحماية من الحظر (ساعات الإرسال، الاتصال، الحد اليومي، التأخير) من غير ما
 * نلمس أو نكرر أي منطق منها هنا.
 */
@Injectable()
export class SendTelegramLinksUseCase {
  private readonly logger = new Logger(SendTelegramLinksUseCase.name);

  /**
   * الـ jobs الشغالة دلوقتي: jobId → { tenantId, cancelled }.
   * نفس فكرة activeJobs في SendBulkUseCase بتاع الواتساب — الإلغاء بيقلب
   * cancelled لـ true، والحلقة بتشوفها قبل كل رسالة وتقف.
   */
  private readonly activeJobs = new Map<string, { tenantId: string; cancelled: boolean }>();

  constructor(
    private readonly resolveAudience: ResolveAudienceUseCase,
    private readonly sendNotification: SendNotificationUseCase,
    private readonly branding: BrandingService,
    private readonly telegram: TelegramService,
    private readonly links: TelegramLinksRepository,
    @Inject(WA_BULK_JOB_REPOSITORY) private readonly bulkJobRepo: IWaBulkJobRepository,
    @Inject(WA_SESSION_REPOSITORY) private readonly sessionRepo: IWaSessionRepository,
    @Inject(WA_SETTINGS_REPOSITORY) private readonly settingsRepo: IWaSettingsRepository,
  ) {}

  async execute(input: SendTelegramLinksInput): Promise<SendTelegramLinksResult> {
    const { tenantId, createdBy, audience } = input;

    // فحص مبكّر قبل أي شغل — لو الواتساب مش متصل أو معطّل، نرجّع خطأ واضح
    // فورًا بدل ما ننشئ job كامل ونخليه "يكمل" 100% وكل الرسايل جواه فاشلة من
    // غير أي سبب ظاهر للمستخدم (نفس فحص SendBulkUseCase بالظبط).
    // بنستخدم AppError مش Error عادي — GlobalExceptionFilter بيحوّل أي Error
    // عادي غير متوقع لرسالة عامة "Internal server error" (لتفادي تسريب تفاصيل
    // داخلية)، فلو رمينا Error('not_connected') عادي هتضيع الرسالة وتوصل
    // للواجهة "خطأ داخلي" غامض بدل السبب الحقيقي. AppError بيتعامل معه الفلتر
    // كحالة متوقعة وبيسيب الرسالة زي ما هي.
    const session = await this.sessionRepo.findByTenantId(tenantId);
    if (!session?.isConnected) throw new AppError('WA_NOT_CONNECTED', 'not_connected', 400);
    if (session.isBanned) throw new AppError('WA_SESSION_BANNED', 'session_banned', 400);

    const settings = await this.settingsRepo.findByTenantId(tenantId);
    if (!settings?.waEnabled) throw new AppError('WA_DISABLED', 'wa_disabled', 400);

    // فحص مبكّر لبوت تليجرام نفسه — من غيره الرابط (t.me/<username>?start=...)
    // مينفعش يتكوّن أصلاً. قبل كده كان الكود بيكمّل عادي، ينشئ job "بينجح"
    // (status: completed) لكن كل رسالة جواه فاشلة بصمت من غير أي سبب مسجّل —
    // ده كان بيّدي انطباع مضلل للمستخدم إن الإرسال "تم" لما فعليًا محدش وصله حاجة.
    const botInfo = await this.telegram.getBotInfo(tenantId);
    if (!botInfo) throw new AppError('TELEGRAM_NOT_CONNECTED', 'telegram_not_connected', 400);

    const resolved = await this.resolveAudience.execute(tenantId, audience);
    const total = resolved.total;

    const linkedIds = await this.links.findLinkedEntityIds(
      tenantId,
      'student',
      resolved.data.map((s) => s.studentId),
    );

    const eligible: EligibleStudent[] = resolved.data
      .filter((s) => !linkedIds.has(s.studentId) && !!s.parentPhone)
      .map((s) => ({
        studentId: s.studentId,
        studentName: s.studentName,
        studentCode: s.studentCode,
        parentPhone: s.parentPhone as string,
      }));
    const alreadyLinked = resolved.data.filter((s) => linkedIds.has(s.studentId)).length;

    // منع تشغيل إرسالين روابط في نفس الوقت لنفس المركز (ضغط مزدوج أو تابين مفتوحين)
    for (const active of this.activeJobs.values()) {
      if (active.tenantId === tenantId && !active.cancelled) {
        throw new AppError('BULK_ALREADY_RUNNING', 'bulk_job_already_running', 409);
      }
    }

    if (eligible.length === 0) {
      return { jobId: null, total, eligible: 0, alreadyLinked };
    }

    const job = await this.bulkJobRepo.create({
      tenantId,
      title: 'روابط تليجرام',
      body: `إرسال روابط تليجرام لـ ${eligible.length} طالب`,
      total: eligible.length,
      createdBy,
      scheduledAt: null,
    });

    // fire-and-forget — إلزامي حسب اتفاقية المشروع لأي إرسال لأكتر من رسالة
    // (راجع DEVELOPER_GUIDE.md قسم WhatsApp — تراكم تأخير anti-ban بين الرسايل)
    this.activeJobs.set(job.id, { tenantId, cancelled: false });
    this.processInBackground(tenantId, job.id, eligible)
      .catch((err: any) =>
        this.logger.error(`Unexpected error in telegram-links job ${job.id}: ${err.message}`),
      )
      .finally(() => this.activeJobs.delete(job.id));

    return { jobId: job.id, total, eligible: eligible.length, alreadyLinked };
  }

  /**
   * إلغاء إرسال روابط شغال. الرسالة اللي بتتبعت في اللحظة دي بتكمل، وكل اللي
   * بعدها بيتلغي. لو الـ job مش شغال في الذاكرة (مثلاً السيرفر اتعمله restart)
   * بنعلّمه ملغي في قاعدة البيانات بس.
   */
  async cancel(tenantId: string, jobId: string): Promise<void> {
    const active = this.activeJobs.get(jobId);
    if (active && active.tenantId === tenantId) active.cancelled = true;

    const job = await this.bulkJobRepo.findById(tenantId, jobId);
    if (!job) throw new AppError('NOT_FOUND', 'عملية الإرسال غير موجودة', 404);
    if (job.status === 'running' || job.status === 'pending') {
      job.cancel();
      await this.bulkJobRepo.save(job);
    }
  }

  /** ملغي من الذاكرة، أو من قاعدة البيانات (لو اتلغى من شاشة الواتساب لإن الجدول مشترك) */
  private async isCancelled(tenantId: string, jobId: string): Promise<boolean> {
    if (this.activeJobs.get(jobId)?.cancelled) return true;
    const fresh = await this.bulkJobRepo.findById(tenantId, jobId);
    return fresh?.status === 'cancelled';
  }

  private async processInBackground(tenantId: string, jobId: string, students: EligibleStudent[]): Promise<void> {
    const job = await this.bulkJobRepo.findById(tenantId, jobId);
    if (!job) return;

    job.start();
    await this.bulkJobRepo.save(job);

    // بوت المعلومات ثابتة لكل التنانت — بنجيبها مرة واحدة بدل ما نعمل HTTP call
    // لتليجرام لكل طالب لوحده (getDeepLink العادية بتعمل كده وهي مناسبة للاستخدام
    // الفردي بس، مش الجماعي)
    const botInfo = await this.telegram.getBotInfo(tenantId);
    const branding = await this.branding.getBrandingInfo(tenantId, {});

    for (const student of students) {
      if (await this.isCancelled(tenantId, jobId)) {
        this.logger.log(`Telegram-links job ${jobId} cancelled`);
        return;
      }

      let success = false;

      if (botInfo) {
        const link = `https://t.me/${botInfo.username}?start=${student.studentCode}`;
        const result = await this.sendNotification.execute({
          tenantId,
          phone: student.parentPhone,
          templateKey: 'TELEGRAM_LINK',
          vars: {
            student_name: student.studentName,
            link,
            center_name: branding.name,
          },
        });
        success = result.success;
      }

      if (success) job.incrementSent();
      else job.incrementFailed();

      // الإلغاء ممكن يحصل والرسالة لسه بتتبعت — من غير الفحص ده، الحفظ هنا كان
      // هيرجّع الحالة "running" فوق "cancelled" اللي اتسجلت
      if (await this.isCancelled(tenantId, jobId)) {
        job.cancel();
        await this.bulkJobRepo.save(job);
        this.logger.log(`Telegram-links job ${jobId} cancelled`);
        return;
      }
      await this.bulkJobRepo.save(job);
    }
  }
}
