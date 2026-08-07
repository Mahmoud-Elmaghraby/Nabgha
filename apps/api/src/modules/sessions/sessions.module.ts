import { Module } from '@nestjs/common';
import { SessionController } from './presentation/session.controller';
import { SessionUseCase } from './application/use-cases/session.usecase';
import { SessionRepository } from './infrastructure/session.repository';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { SettingsModule } from '../settings/settings.module';
import { StorageService } from '../../shared/infrastructure/storage/storage.service';

@Module({
  imports: [DatabaseModule, WhatsAppModule, SettingsModule],
  controllers: [SessionController],
  providers: [SessionUseCase, SessionRepository, StorageService],
  exports: [SessionUseCase],
})
export class SessionsModule {}
