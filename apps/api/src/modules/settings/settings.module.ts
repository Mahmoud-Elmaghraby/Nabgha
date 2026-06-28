import { Module } from '@nestjs/common';
import { CenterSettingsRepository, ModuleSettingsRepository } from './infrastructure/settings.repository';
import { CenterSettingsUseCase } from './application/use-cases/center-settings.usecase';
import { SettingsController } from './presentation/settings.controller';

@Module({
  controllers: [SettingsController],
  providers: [
    CenterSettingsRepository,
    ModuleSettingsRepository,
    CenterSettingsUseCase,
  ],
  exports: [
    CenterSettingsRepository,
    ModuleSettingsRepository,
    CenterSettingsUseCase,
  ],
})
export class SettingsModule {}
