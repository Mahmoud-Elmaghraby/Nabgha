import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { KyselyService } from '../../../../shared/infrastructure/database/kysely.service';
import { BackupUseCase } from './backup.usecase';

@Injectable()
export class ScheduledBackupUseCase {
  private readonly logger = new Logger(ScheduledBackupUseCase.name);

  constructor(
    private readonly backupUseCase: BackupUseCase,
    private readonly kysely: KyselyService,
  ) {}

  // كل يوم الساعة 3 صباحاً — وقت هادئ متوقّع محدش شغال على البرنامج فيه
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleScheduledBackup(): Promise<void> {
    const isDesktop = process.env.DEPLOY_MODE === 'desktop';
    if (!isDesktop) return; // النسخ التلقائي المحلي مخصص لوضع Desktop بس حالياً

    const tenantId = process.env.DESKTOP_TENANT_ID ?? '00000000-0000-0000-0000-000000000001';

    const enabled = await this.backupUseCase.getAutoBackupEnabled(tenantId);
    if (!enabled) return;

    try {
      await this.backupUseCase.createBackup(tenantId, 'scheduled');
      this.logger.log('Scheduled backup completed successfully');
    } catch (err: any) {
      this.logger.error(`Scheduled backup failed: ${err.message}`);
    }
  }
}
