import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BackupUseCase } from './backup.usecase';
import { isBackupAvailable } from '../../../../shared/infrastructure/guards/backup-availability.guard';

/**
 * BACKUP-003: قبل كده النسخة التلقائية كانت الساعة 3 الفجر بس، وأجهزة السناتر مقفولة وقتها،
 * فالنسخ عملياً ماكانش بيحصل. دلوقتي زي توليد المستحقات (ADR-0007):
 * فحص كل ساعة + بعد تشغيل البرنامج بـ 3 دقايق، ونسخة لو آخر نسخة ناجحة أقدم من 24 ساعة.
 */
@Injectable()
export class ScheduledBackupUseCase implements OnApplicationBootstrap {
  private readonly logger = new Logger(ScheduledBackupUseCase.name);

  constructor(private readonly backupUseCase: BackupUseCase) {}

  onApplicationBootstrap() {
    if (!isBackupAvailable()) return;
    // 3 دقايق بعد التشغيل: الـ migrations والموديولات التانية تكون خلصت، والمستخدم بدأ شغله
    setTimeout(() => { this.handleScheduledBackup(); }, 3 * 60_000).unref();
  }

  @Cron('40 * * * *')
  async handleScheduledBackup(): Promise<void> {
    if (!isBackupAvailable()) return; // النسخ التلقائي المحلي للديسكتوب بس (BACKUP-006)

    const tenantId = process.env.DESKTOP_TENANT_ID ?? '00000000-0000-0000-0000-000000000001';
    try {
      const result = await this.backupUseCase.runScheduledIfDue(tenantId);
      if (result === 'created') this.logger.log('Scheduled backup completed successfully');
    } catch (err: any) {
      // الفشل نفسه بيتسجّل في tenant_settings جوّه createBackup ويظهر في الواجهة (BACKUP-007)
      this.logger.error(`Scheduled backup failed: ${err.message}`);
    }
  }
}
