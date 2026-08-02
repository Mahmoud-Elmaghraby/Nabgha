import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BaileysProvider } from './infrastructure/baileys.provider';
import {
  WaSessionRepository,
  WaSettingsRepository,
  WaTemplateRepository,
  WaMessageRepository,
  WaBulkJobRepository,
  WaInboundRepository,
} from './infrastructure/wa-kysely.repository';
import { ConnectDeviceUseCase } from './application/use-cases/connect-device.usecase';
import { SendNotificationUseCase } from './application/use-cases/send-notification.usecase';
import { GetMessagesUseCase } from './application/use-cases/get-messages.usecase';
import { ResolveAudienceUseCase } from './application/use-cases/resolve-audience.usecase';
import { RestoreSessionsUseCase } from './application/use-cases/restore-sessions.usecase';
import { RetryFailedMessagesUseCase } from './application/use-cases/retry-failed-messages.usecase';
import { SendBulkUseCase } from './application/use-cases/send-bulk.usecase';
import { UpdateSettingsUseCase } from './application/use-cases/update-settings.usecase';
import { UpdateTemplateUseCase } from './application/use-cases/update-template.usecase';
import { HandleInboundUseCase } from './application/use-cases/handle-inbound.usecase';
import { WaHealthMonitorUseCase } from './application/use-cases/wa-health-monitor.usecase';
import { WaController } from './presentation/wa.controller';
import {
  WA_SESSION_REPOSITORY,
  WA_SETTINGS_REPOSITORY,
  WA_TEMPLATE_REPOSITORY,
  WA_MESSAGE_REPOSITORY,
  WA_BULK_JOB_REPOSITORY,
  WA_INBOUND_REPOSITORY,
} from './domain/repositories/wa.repository.interface';
import { WA_PROVIDER as WA_PROVIDER_TOKEN } from './domain/interfaces/wa-provider.interface';

@Module({
  imports: [],
  controllers: [WaController],
  providers: [
    { provide: WA_PROVIDER_TOKEN, useClass: BaileysProvider },
    { provide: WA_SESSION_REPOSITORY, useClass: WaSessionRepository },
    { provide: WA_SETTINGS_REPOSITORY, useClass: WaSettingsRepository },
    { provide: WA_TEMPLATE_REPOSITORY, useClass: WaTemplateRepository },
    { provide: WA_MESSAGE_REPOSITORY, useClass: WaMessageRepository },
    { provide: WA_BULK_JOB_REPOSITORY, useClass: WaBulkJobRepository },
    { provide: WA_INBOUND_REPOSITORY, useClass: WaInboundRepository },
    ConnectDeviceUseCase,
    SendNotificationUseCase,
    GetMessagesUseCase,
    ResolveAudienceUseCase,
    RestoreSessionsUseCase,
    RetryFailedMessagesUseCase,
    SendBulkUseCase,
    UpdateSettingsUseCase,
    UpdateTemplateUseCase,
    HandleInboundUseCase,
    WaHealthMonitorUseCase,
  ],
  exports: [
    SendNotificationUseCase, GetMessagesUseCase,
    WA_PROVIDER_TOKEN, WA_SESSION_REPOSITORY, WA_SETTINGS_REPOSITORY,
    WA_MESSAGE_REPOSITORY, WA_BULK_JOB_REPOSITORY,
  ],
})
export class WhatsAppModule {}
