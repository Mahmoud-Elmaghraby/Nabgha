import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { SessionController } from './presentation/session.controller';
import { SessionUseCase } from './application/use-cases/session.usecase';
import { SessionRepository } from './infrastructure/session.repository';
import { KyselyModule } from '../../shared/infrastructure/database/kysely.module';

@Module({
  imports: [
    KyselyModule,
    MulterModule.register({ storage: memoryStorage() }),
  ],
  controllers: [SessionController],
  providers: [SessionUseCase, SessionRepository],
  exports: [SessionUseCase],
})
export class SessionsModule {}
