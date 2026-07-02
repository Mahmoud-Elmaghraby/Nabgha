import { Module } from '@nestjs/common';
import { CenterSettingsRepository, ModuleSettingsRepository } from './infrastructure/settings.repository';
import { CenterSettingsUseCase } from './application/use-cases/center-settings.usecase';
import { BrandingService } from './application/services/branding.service';
import { SettingsController } from './presentation/settings.controller';

@Module({
  controllers: [SettingsController],
  providers: [
    CenterSettingsRepository,
    ModuleSettingsRepository,
    CenterSettingsUseCase,
    BrandingService,
  ],
  exports: [
    CenterSettingsRepository,
    ModuleSettingsRepository,
    CenterSettingsUseCase,
    BrandingService,
  ],
})
export class SettingsModule {}
