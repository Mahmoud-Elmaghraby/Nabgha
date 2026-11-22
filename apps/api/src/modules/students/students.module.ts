import { Module } from '@nestjs/common';
import { StudentController } from './presentation/student.controller';
import { StudentUseCase } from './application/use-cases/student.usecase';
import { StudentRepository } from './infrastructure/student.repository';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { TelegramModule } from '../telegram/telegram.module';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module';
import { SettingsModule } from '../settings/settings.module';
import { ExportModule } from '../../shared/infrastructure/export/export.module';

@Module({
  imports: [WhatsAppModule, TelegramModule, DatabaseModule, SettingsModule, ExportModule],
  controllers: [StudentController],
  providers: [StudentUseCase, StudentRepository],
  exports: [StudentUseCase, StudentRepository],
})
export class StudentsModule {}
