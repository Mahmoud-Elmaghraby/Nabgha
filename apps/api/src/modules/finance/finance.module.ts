import { Module } from '@nestjs/common';
import { FinanceController } from './presentation/finance.controller';
import { FinanceUseCase } from './application/use-cases/finance.usecase';
import { FinanceRepository } from './infrastructure/repositories/finance.repository';
import { FINANCE_REPOSITORY } from './domain/repositories/finance.repository.interface';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { TelegramModule } from '../telegram/telegram.module';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module';

@Module({
  imports: [WhatsAppModule, TelegramModule, DatabaseModule],
  controllers: [FinanceController],
  providers: [
    {
      provide: FINANCE_REPOSITORY,
      useClass: FinanceRepository,
    },
    FinanceUseCase,
  ],
  exports: [FinanceUseCase],
})
export class FinanceModule {}
