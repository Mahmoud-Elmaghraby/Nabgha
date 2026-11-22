import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IWaBulkJobRepository, WA_BULK_JOB_REPOSITORY } from '../../domain/repositories/wa.repository.interface';
import { IWaMessageRepository, WA_MESSAGE_REPOSITORY } from '../../domain/repositories/wa.repository.interface';
import { IWaSessionRepository, WA_SESSION_REPOSITORY } from '../../domain/repositories/wa.repository.interface';
import { IWaSettingsRepository, WA_SETTINGS_REPOSITORY } from '../../domain/repositories/wa.repository.interface';
import { IWaProvider, WA_PROVIDER } from '../../domain/interfaces/wa-provider.interface';
import { WaSettingsEntity } from '../../domain/entities/wa-settings.entity';
import { KyselyService } from '../../../../shared/infrastructure/database/kysely.service';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';

export interface SendBulkInput {
  tenantId: string;
  title: string;
  body: string;
  phones: string[];
  createdBy: string;
  scheduledAt?: Date;
}

export interface BulkProgress {
  jobId: string;
  total: number;
  sent: number;
  failed: number;
  queued: number;
  progress: number;
  status: string;
}

@Injectable()
export class SendBulkUseCase implements OnApplicationBootstrap {
  private readonly logger = new Logger(SendBulkUseCase.name);
  private activeJobs = new Map<string, boolean>();

  constructor(
    @Inject(WA_PROVIDER) private readonly provider: IWaProvider,
    @Inject(WA_SESSION_REPOSITORY) private readonly sessionRepo: IWaSessionRepository,
    @Inject(WA_SETTINGS_REPOSITORY) private readonly settingsRepo: IWaSettingsRepository,
    @Inject(WA_MESSAGE_REPOSITORY) private readonly messageRepo: IWaMessageRepository,
    @Inject(WA_BULK_JOB_REPOSITORY) private readonly bulkJobRepo: IWaBulkJobRepository,
    private readonly prisma: PrismaService,
    private readonly kysely: KyselyService,
  ) {}

  /**
   * أي إرسال جماعي كان شغال وقت ما البرنامج اتقفل بيفضل "running" في قاعدة البيانات
   * للأبد — والفحص اللي بيمنع إرسالين في نفس الوقت كان بيرفض أي إرسال جماعي جديد
   * بعدها. عند التشغيل بنعلّمهم "فشل" (الحلقة اللي كانت بتبعتهم ماتت مع البرنامج).
   */
  async onApplicationBootstrap(): Promise<void> {
    try {
      const tenants = await this.prisma.tenant.findMany({ where: { isActive: true }, select: { id: true } });
      for (const t of tenants) {
        const res = await this.kysely.getTenantDb(t.id)
          .updateTable('wa_bulk_jobs')
          .set({ status: 'failed', completed_at: new Date(), updated_at: new Date() } as any)
          .where('status', '=', 'running')
          .executeTakeFirst();
        const n = Number(res?.numUpdatedRows ?? 0);
        if (n) this.logger.warn(`Tenant ${t.id}: ${n} interrupted bulk job(s) marked failed after restart`);
      }
    } catch (err: any) {
      this.logger.error(`Interrupted bulk jobs cleanup failed: ${err.message}`);
    }
  }

  // ─── Cron: Scheduled Jobs Runner ────────────────────────────
  /**
   * كل دقيقة يتحقق من الـ bulk jobs المجدولة ويبدأ اللي حان وقتها.
   * هكذا scheduledAt بيشتغل فعلياً بدل ما يتخزن ويتجاهل.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async runScheduledJobs(): Promise<void> {
    try {
      const tenants = await this.prisma.tenant.findMany({
        where: { isActive: true },
        select: { id: true },
      });

      for (const tenant of tenants) {
        const pendingJobs = await this.bulkJobRepo.findPendingScheduled(tenant.id, new Date());
        for (const job of pendingJobs) {
          // تجنب تشغيل نفس الـ job مرتين لو في instance تاني
          if (this.activeJobs.has(job.id)) continue;

          const session  = await this.sessionRepo.findByTenantId(tenant.id);
          const settings = await this.settingsRepo.findByTenantId(tenant.id);
          if (!session?.isConnected || session.isBanned || !settings?.waEnabled) continue;

          const phones: string[] = (job as any).phones ?? [];
          const effectiveDailyLimit = session.getCurrentDailyLimit(settings.dailyLimit, settings.warmupEnabled);

          this.logger.log(`Starting scheduled job ${job.id} for tenant ${tenant.id}`);
          this.processJobInBackground(
            job.id, tenant.id, phones, job.body,
            settings.delayMinSeconds, settings.delayMaxSeconds,
            effectiveDailyLimit, settings,
          ).catch((err) =>
            this.logger.error(`Scheduled job ${job.id} failed: ${err.message}`),
          );
        }
      }
    } catch (err: any) {
      this.logger.error(`runScheduledJobs error: ${err.message}`);
    }
  }


  async execute(input: SendBulkInput): Promise<BulkProgress> {
    const { tenantId, title, body, phones, createdBy, scheduledAt } = input;

    const session = await this.sessionRepo.findByTenantId(tenantId);
    if (!session?.isConnected) throw new Error('not_connected');
    if (session.isBanned) throw new Error('session_banned');

    const settings = await this.settingsRepo.findByTenantId(tenantId);
    if (!settings?.waEnabled) throw new Error('wa_disabled');

    // منع تشغيل أكتر من bulk job في نفس الوقت لنفس المركز — لو حصل ضغط مزدوج على
    // الزرار أو فتح تابين، كنا ممكن نبعت نفس الرسايل مرتين لنفس الأرقام
    const recentJobs = await this.bulkJobRepo.findByTenantId(tenantId, 5);
    if (recentJobs.some((j) => j.status === 'running')) {
      throw new Error('bulk_job_already_running');
    }

    const job = await this.bulkJobRepo.create({
      tenantId, title, body,
      total: phones.length,
      createdBy, scheduledAt: scheduledAt ?? null,
    });

    const effectiveDailyLimit = session.getCurrentDailyLimit(settings.dailyLimit, settings.warmupEnabled);
    // fire-and-forget مع catch شامل لضمان تحديث حالة الـ Job عند أي خطأ غير متوقع
    this.processJobInBackground(job.id, tenantId, phones, body, settings.delayMinSeconds, settings.delayMaxSeconds, effectiveDailyLimit, settings)
      .catch(async (err) => {
        this.logger.error(`Unexpected error in bulk job ${job.id}: ${err.message}`);
        try {
          const failedJob = await this.bulkJobRepo.findById(tenantId, job.id);
          if (failedJob && failedJob.status === 'running') {
            failedJob.cancel();
            await this.bulkJobRepo.save(failedJob);
          }
        } catch {}
      });

    return {
      jobId: job.id,
      total: job.total,
      sent: job.sent,
      failed: job.failed,
      queued: job.queued,
      progress: job.progress,
      status: job.status,
    };
  }

  async cancel(tenantId: string, jobId: string): Promise<void> {
    this.activeJobs.set(jobId, false);
    const job = await this.bulkJobRepo.findById(tenantId, jobId);
    if (job) {
      job.cancel();
      await this.bulkJobRepo.save(job);
    }
  }

  async getProgress(tenantId: string, jobId: string): Promise<BulkProgress | null> {
    const job = await this.bulkJobRepo.findById(tenantId, jobId);
    if (!job) return null;
    return {
      jobId: job.id,
      total: job.total,
      sent: job.sent,
      failed: job.failed,
      queued: job.queued,
      progress: job.progress,
      status: job.status,
    };
  }

  private async processJobInBackground(
    jobId: string,
    tenantId: string,
    phones: string[],
    body: string,
    delayMin: number,
    delayMax: number,
    dailyLimit: number,
    settings: WaSettingsEntity,
  ): Promise<void> {
    this.activeJobs.set(jobId, true);

    const job = await this.bulkJobRepo.findById(tenantId, jobId);
    if (!job) return;

    job.start();
    await this.bulkJobRepo.save(job);

    for (const phone of phones) {
      if (!this.activeJobs.get(jobId)) {
        this.logger.log(`Job ${jobId} cancelled`);
        break;
      }

      // فحص ساعات الإرسال — لو خرجنا عن النطاق المسموح نسجّل الرقم فاشل قابل
      // لإعادة المحاولة تلقائياً (مش وقف حقيقي للـ job، الـ job بيكمل باقي القائمة)
      if (!settings.isWithinSendHours()) {
        this.logger.log(`Job ${jobId} — phone ${phone} skipped, outside send hours (will retry)`);
        const skipped = await this.messageRepo.create({
          tenantId, phone, templateKey: null,
          body, status: 'pending', bulkJobId: jobId,
        });
        skipped.markFailed('outside_send_hours');
        await this.messageRepo.save(skipped);
        job.incrementFailed();
        await this.bulkJobRepo.save(job);
        continue;
      }

      // نجيب العدد الحقيقي من قاعدة البيانات في كل تكرار (مش عداد في الذاكرة بيتراكم لوحده) —
      // عشان لو حصل إرسال من مكان تاني في البرنامج في نفس الوقت (إشعار فردي من شاشة تانية
      // مثلاً)، الـ job يشوفه فورًا ويوقف عند الحد الصحيح. التكلفة إهمالية جنب تأخير الإرسال
      // الموجود أصلاً بين كل رسالة وتانية (استعلام واحد بسيط على عمود مفهرس).
      const sentToday = await this.messageRepo.countTodayByTenantId(tenantId);
      if (sentToday >= dailyLimit) {
        // بدل ما نتجاهل الأرقام الباقية بصمت (كان بيحصل قبل كده)، نسجلها فاشلة قابلة لإعادة
        // المحاولة تلقائياً بكرة عبر retry-failed-messages.usecase.ts
        const skipped = await this.messageRepo.create({
          tenantId, phone, templateKey: null,
          body, status: 'pending', bulkJobId: jobId,
        });
        skipped.markFailed('daily_limit_reached');
        await this.messageRepo.save(skipped);
        job.incrementFailed();
        await this.bulkJobRepo.save(job);
        continue;
      }

      const message = await this.messageRepo.create({
        tenantId, phone, templateKey: null,
        body, status: 'pending', bulkJobId: jobId,
      });

      // الفاصل بين الرسايل بيتطبق جوه طابور الإرسال (BaileysProvider)
      const result = await this.provider.sendMessage(tenantId, phone, body);

      if (result.success) {
        message.markSent();
        job.incrementSent();
      } else {
        message.markFailed(result.error ?? 'unknown');
        job.incrementFailed();
      }

      await this.messageRepo.save(message);
      await this.bulkJobRepo.save(job);
    }

    this.activeJobs.delete(jobId);
  }

  private randomDelay(min: number, max: number): number {
    return (Math.random() * (max - min) + min) * 1000;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
