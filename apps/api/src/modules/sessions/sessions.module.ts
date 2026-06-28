import { Module } from '@nestjs/common';
import { SessionController } from './presentation/session.controller';
import { SessionUseCase } from './application/use-cases/session.usecase';
import { SessionRepository } from './infrastructure/session.repository';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [DatabaseModule, WhatsAppModule],
  controllers: [SessionController],
  providers: [SessionUseCase, SessionRepository],
  exports: [SessionUseCase],
})
export class SessionsModule {}
