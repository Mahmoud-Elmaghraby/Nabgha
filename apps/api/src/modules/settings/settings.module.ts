import { Module } from '@nestjs/common';
import { CenterSettingsRepository, ModuleSettingsRepository } from './infrastructure/settings.repository';
import { CenterSettingsUseCase } from './application/use-cases/center-settings.usecase';
import { BrandingService } from './application/services/branding.service';
import { SettingsController } from './presentation/settings.controller';
import { BackupController } from './presentation/backup.controller';
import { BackupUseCase } from './application/use-cases/backup.usecase';
import { ScheduledBackupUseCase } from './application/use-cases/scheduled-backup.usecase';
import { PgDumpLocatorService } from './infrastructure/backup/pg-dump-locator.service';
import { TenantCapabilitiesModule } from '../../shared/infrastructure/tenant-capabilities/tenant-capabilities.module';

@Module({
  imports: [TenantCapabilitiesModule],
  controllers: [SettingsController, BackupController],
  providers: [
    CenterSettingsRepository,
    ModuleSettingsRepository,
    CenterSettingsUseCase,
    BrandingService,
    BackupUseCase,
    ScheduledBackupUseCase,
    PgDumpLocatorService,
  ],
  exports: [
    CenterSettingsRepository,
    ModuleSettingsRepository,
    CenterSettingsUseCase,
    BrandingService,
  ],
})
export class SettingsModule {}
