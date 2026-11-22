import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import { TelegramLinksRepository } from './infrastructure/telegram-links.repository';
import { TelegramSettingsRepository } from './infrastructure/telegram-settings.repository';
import { TelegramTemplatesRepository } from './infrastructure/telegram-templates.repository';
import { TelegramMessagesRepository } from './infrastructure/telegram-messages.repository';
import { TelegramInboundRepository } from './infrastructure/telegram-inbound.repository';
import { TelegramCommandRegistry } from './application/services/telegram-command-registry';
import { TelegramPollingService } from './application/services/telegram-polling.service';
import { SendTelegramLinksUseCase } from './application/use-cases/send-telegram-links.usecase';
import { TelegramNotifyUseCase } from './application/use-cases/telegram-notify.usecase';
import { UpdateTelegramSettingsUseCase } from './application/use-cases/update-telegram-settings.usecase';
import { UpdateTelegramTemplateUseCase } from './application/use-cases/update-telegram-template.usecase';
import { HandleTelegramInboundUseCase } from './application/use-cases/handle-telegram-inbound.usecase';
import { GetTelegramMessagesUseCase } from './application/use-cases/get-telegram-messages.usecase';
import { GetTelegramLinkStatusUseCase } from './application/use-cases/get-telegram-link-status.usecase';
import { SettingsModule } from '../settings/settings.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [SettingsModule, WhatsAppModule],
  controllers: [TelegramController],
  providers: [
    TelegramService,
    TelegramLinksRepository,
    TelegramSettingsRepository,
    TelegramTemplatesRepository,
    TelegramMessagesRepository,
    TelegramInboundRepository,
    TelegramCommandRegistry,
    TelegramPollingService,
    SendTelegramLinksUseCase,
    TelegramNotifyUseCase,
    UpdateTelegramSettingsUseCase,
    UpdateTelegramTemplateUseCase,
    HandleTelegramInboundUseCase,
    GetTelegramMessagesUseCase,
    GetTelegramLinkStatusUseCase,
  ],
  // TelegramNotifyUseCase مُصدَّرة عشان finance/groups/sessions/students تقدر
  // تستوردها وتضيف نداء إضافي بعد نداء الواتساب الموجود (من غير ما تلمسه) —
  // نفس نمط تصدير ResolveAudienceUseCase من WhatsAppModule بالظبط.
  exports: [TelegramService, TelegramNotifyUseCase],
})
export class TelegramModule {}
