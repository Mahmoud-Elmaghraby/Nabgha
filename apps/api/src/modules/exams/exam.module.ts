import { Module }          from '@nestjs/common';
import { DatabaseModule }  from '../../shared/infrastructure/database/database.module';
import { ExportModule }    from '../../shared/infrastructure/export/export.module';
import { UploadModule }    from '../upload/upload.module';
import { ExamController }  from './presentation/exam.controller';
import { ExamUseCase }     from './application/use-cases/exam.usecase';
import { ExamRepository }  from './infrastructure/repositories/exam.repository';
import { EXAM_REPOSITORY } from './domain/repositories/exam.repository.interface';

@Module({
  imports:     [DatabaseModule, ExportModule, UploadModule],
  controllers: [ExamController],
  providers:   [
    ExamUseCase,
    ExamRepository,
    { provide: EXAM_REPOSITORY, useClass: ExamRepository },
  ],
  exports: [ExamUseCase],
})
export class ExamsModule {}
