import { Module } from '@nestjs/common';
import { StudentController } from './presentation/student.controller';
import { StudentUseCase } from './application/use-cases/student.usecase';
import { StudentRepository } from './infrastructure/student.repository';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module';

@Module({
  imports: [WhatsAppModule, DatabaseModule],
  controllers: [StudentController],
  providers: [StudentUseCase, StudentRepository],
  exports: [StudentUseCase, StudentRepository],
})
export class StudentsModule {}
