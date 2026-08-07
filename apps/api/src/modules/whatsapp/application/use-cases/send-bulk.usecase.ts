import { Inject, Injectable, Logger } from '@nestjs/common';
import { IWaBulkJobRepository, WA_BULK_JOB_REPOSITORY } from '../../domain/repositories/wa.repository.interface';
import { IWaMessageRepository, WA_MESSAGE_REPOSITORY } from '../../domain/repositories/wa.repository.interface';
import { IWaSessionRepository, WA_SESSION_REPOSITORY } from '../../domain/repositories/wa.repository.interface';
import { IWaSettingsRepository, WA_SETTINGS_REPOSITORY } from '../../domain/repositories/wa.repository.interface';
import { IWaProvider, WA_PROVIDER } from '../../domain/interfaces/wa-provider.interface';

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
export class SendBulkUseCase {
  private readonly logger = new Logger(SendBulkUseCase.name);
  private activeJobs = new Map<string, boolean>();

  constructor(
    @Inject(WA_PROVIDER) private readonly provider: IWaProvider,
    @Inject(WA_SESSION_REPOSITORY) private readonly sessionRepo: IWaSessionRepository,
    @Inject(WA_SETTINGS_REPOSITORY) private readonly settingsRepo: IWaSettingsRepository,
    @Inject(WA_MESSAGE_REPOSITORY) private readonly messageRepo: IWaMessageRepository,
    @Inject(WA_BULK_JOB_REPOSITORY) private readonly bulkJobRepo: IWaBulkJobRepository,
  ) {}

  async execute(input: SendBulkInput): Promise<BulkProgress> {
    const { tenantId, title, body, phones, createdBy, scheduledAt } = input;

    const session = await this.sessionRepo.findByTenantId(tenantId);
    if (!session?.isConnected) throw new Error('not_connected');

    const settings = await this.settingsRepo.findByTenantId(tenantId);
    if (!settings?.waEnabled) throw new Error('wa_disabled');

    const job = await this.bulkJobRepo.create({
      tenantId, title, body,
      total: phones.length,
      createdBy, scheduledAt: scheduledAt ?? null,
    });

    const effectiveDailyLimit = session.getCurrentDailyLimit(settings.dailyLimit);
    this.processJobInBackground(job.id, tenantId, phones, body, settings.delayMinSeconds, settings.delayMaxSeconds, effectiveDailyLimit);

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
  ): Promise<void> {
    this.activeJobs.set(jobId, true);

    const job = await this.bulkJobRepo.findById(tenantId, jobId);
    if (!job) return;

    job.start();
    await this.bulkJobRepo.save(job);

    let sentToday = await this.messageRepo.countTodayByTenantId(tenantId);

    for (const phone of phones) {
      if (!this.activeJobs.get(jobId)) {
        this.logger.log(`Job ${jobId} cancelled`);
        break;
      }

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

      const delay = this.randomDelay(delayMin, delayMax);
      await this.sleep(delay);

      const result = await this.provider.sendMessage(tenantId, phone, body);

      if (result.success) {
        message.markSent();
        job.incrementSent();
        sentToday++;
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
