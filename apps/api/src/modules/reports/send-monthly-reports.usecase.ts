import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  IWaBulkJobRepository, WA_BULK_JOB_REPOSITORY,
  IWaMessageRepository, WA_MESSAGE_REPOSITORY,
  IWaSessionRepository, WA_SESSION_REPOSITORY,
  IWaSettingsRepository, WA_SETTINGS_REPOSITORY,
} from '../whatsapp/domain/repositories/wa.repository.interface';
import { IWaProvider, WA_PROVIDER } from '../whatsapp/domain/interfaces/wa-provider.interface';
import { WaSettingsEntity } from '../whatsapp/domain/entities/wa-settings.entity';
import { ReportRegistryService } from './report-registry.service';
import { StudentUseCase } from '../students/application/use-cases/student.usecase';

export interface SendMonthlyReportsInput {
  tenantId: string;
  studentIds: string[];
  month: string;
  createdBy: string;
}

export interface MonthlyWhatsappProgress {
  jobId: string;
  total: number;
  sent: number;
  failed: number;
  queued: number;
  progress: number;
  status: string;
}

@Injectable()
export class SendMonthlyReportsUseCase {
  private readonly logger = new Logger(SendMonthlyReportsUseCase.name);
  private activeJobs = new Map<string, boolean>();

  constructor(
    @Inject(WA_PROVIDER) private readonly provider: IWaProvider,
    @Inject(WA_SESSION_REPOSITORY) private readonly sessionRepo: IWaSessionRepository,
    @Inject(WA_SETTINGS_REPOSITORY) private readonly settingsRepo: IWaSettingsRepository,
    @Inject(WA_MESSAGE_REPOSITORY) private readonly messageRepo: IWaMessageRepository,
    @Inject(WA_BULK_JOB_REPOSITORY) private readonly bulkJobRepo: IWaBulkJobRepository,
    private readonly registry: ReportRegistryService,
    private readonly studentUseCase: StudentUseCase,
  ) {}

  async execute(input: SendMonthlyReportsInput): Promise<MonthlyWhatsappProgress> {
    const { tenantId, studentIds, month, createdBy } = input;

    const session = await this.sessionRepo.findByTenantId(tenantId);
    if (!session?.isConnected) throw new Error('not_connected');

    const settings = await this.settingsRepo.findByTenantId(tenantId);
    if (!settings?.waEnabled) throw new Error('wa_disabled');

    const job = await this.bulkJobRepo.create({
      tenantId,
      title: 'التقارير الشهرية لأولياء الأمور',
      body: `التقرير الشهري — ${month}`,
      total: studentIds.length,
      createdBy,
      scheduledAt: null,
    });

    const effectiveDailyLimit = session.getCurrentDailyLimit(settings.dailyLimit, settings.warmupEnabled);
    this.processJobInBackground(
      job.id, tenantId, studentIds, month,
      settings.delayMinSeconds, settings.delayMaxSeconds, effectiveDailyLimit, settings,
    );

    return this.toProgress(job);
  }

  async cancel(tenantId: string, jobId: string): Promise<void> {
    this.activeJobs.set(jobId, false);
    const job = await this.bulkJobRepo.findById(tenantId, jobId);
    if (job) {
      job.cancel();
      await this.bulkJobRepo.save(job);
    }
  }

  async getProgress(tenantId: string, jobId: string): Promise<MonthlyWhatsappProgress | null> {
    const job = await this.bulkJobRepo.findById(tenantId, jobId);
    if (!job) return null;
    return this.toProgress(job);
  }

  private toProgress(job: any): MonthlyWhatsappProgress {
    return {
      jobId: job.id, total: job.total, sent: job.sent,
      failed: job.failed, queued: job.queued, progress: job.progress, status: job.status,
    };
  }

  private async processJobInBackground(
    jobId: string, tenantId: string, studentIds: string[], month: string,
    delayMin: number, delayMax: number, dailyLimit: number,
    settings: WaSettingsEntity,
  ): Promise<void> {
    this.activeJobs.set(jobId, true);

    const job = await this.bulkJobRepo.findById(tenantId, jobId);
    if (!job) return;

    job.start();
    await this.bulkJobRepo.save(job);

    let sentToday = await this.messageRepo.countTodayByTenantId(tenantId);
    const reportDef = this.registry.get('student-monthly-report');

    for (const studentId of studentIds) {
      if (!this.activeJobs.get(jobId)) {
        this.logger.log(`Job ${jobId} cancelled`);
        break;
      }

      let student;
      try {
        student = await this.studentUseCase.getById(tenantId, studentId);
      } catch {
        const failedMsg = await this.messageRepo.create({
          tenantId, phone: '', templateKey: null,
          body: `تعذر جلب بيانات الطالب ${studentId}`, status: 'pending', bulkJobId: jobId,
        });
        failedMsg.markFailed('student_not_found');
        await this.messageRepo.save(failedMsg);
        job.incrementFailed();
        await this.bulkJobRepo.save(job);
        continue;
      }

      const caption = `التقرير الشهري — ${student.fullName} — ${month}`;

      // فحص ساعات الإرسال
      if (!settings.isWithinSendHours()) {
        this.logger.log(`Job ${jobId} paused — outside send hours`);
        const skipped = await this.messageRepo.create({
          tenantId, phone: '', templateKey: null,
          body: `التقرير الشهري — ${studentId}`, status: 'pending', bulkJobId: jobId,
        });
        skipped.markFailed('outside_send_hours');
        await this.messageRepo.save(skipped);
        job.incrementFailed();
        await this.bulkJobRepo.save(job);
        continue;
      }

      if (sentToday >= dailyLimit) {
        const skipped = await this.messageRepo.create({
          tenantId, phone: student.parentPhone, templateKey: null,
          body: caption, status: 'pending', bulkJobId: jobId,
        });
        skipped.markFailed('daily_limit_reached');
        await this.messageRepo.save(skipped);
        job.incrementFailed();
        await this.bulkJobRepo.save(job);
        continue;
      }

      const message = await this.messageRepo.create({
        tenantId, phone: student.parentPhone, templateKey: null,
        body: caption, status: 'pending', bulkJobId: jobId,
      });

      // الفاصل بين الرسايل بيتطبق جوه طابور الإرسال (BaileysProvider)

      try {
        if (!reportDef) throw new Error('report_not_registered');
        const pdfBuffer = await reportDef.generate(tenantId, { studentId, month }, 'pdf');
        const fileName = `التقرير-الشهري-${student.fullName}-${month}.pdf`;
        const result = await this.provider.sendDocument(tenantId, student.parentPhone, pdfBuffer, fileName, caption);

        if (result.success) {
          message.markSent();
          job.incrementSent();
          sentToday++;
        } else {
          message.markFailed(result.error ?? 'unknown');
          job.incrementFailed();
        }
      } catch (err: any) {
        message.markFailed(err.message ?? 'generation_failed');
        job.incrementFailed();
      }

      await this.messageRepo.save(message);
      await this.bulkJobRepo.save(job);
    }

    this.activeJobs.delete(jobId);
  }
}
