import { Module } from '@nestjs/common';
import { GroupController } from './presentation/group.controller';
import { GroupUseCase } from './application/use-cases/group.usecase';
import { GroupRepository } from './infrastructure/group.repository';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module';
import { SettingsModule } from '../settings/settings.module';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [WhatsAppModule, DatabaseModule, SettingsModule, FinanceModule],
  controllers: [GroupController],
  providers: [GroupUseCase, GroupRepository],
  exports: [GroupUseCase, GroupRepository],
})
export class GroupsModule {}
