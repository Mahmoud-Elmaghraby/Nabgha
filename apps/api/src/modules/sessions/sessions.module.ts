import { Module } from '@nestjs/common';
import { SessionController } from './presentation/session.controller';
import { SessionUseCase } from './application/use-cases/session.usecase';
import { SessionRepository } from './infrastructure/session.repository';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { TelegramModule } from '../telegram/telegram.module';
import { SettingsModule } from '../settings/settings.module';
import { StorageService } from '../../shared/infrastructure/storage/storage.service';
import { AttendanceCreditService } from './application/services/attendance-credit.service';
import { AttendanceCreditRepository } from './infrastructure/attendance-credit.repository';

@Module({
  imports: [DatabaseModule, WhatsAppModule, TelegramModule, SettingsModule],
  controllers: [SessionController],
  providers: [SessionUseCase, SessionRepository, StorageService, AttendanceCreditService, AttendanceCreditRepository],
  exports: [SessionUseCase],
})
export class SessionsModule {}
