import { Module }          from '@nestjs/common';
import { DatabaseModule }  from '../../shared/infrastructure/database/database.module';
import { ExamController }  from './presentation/exam.controller';
import { ExamUseCase }     from './application/use-cases/exam.usecase';
import { ExamRepository }  from './infrastructure/repositories/exam.repository';
import { EXAM_REPOSITORY } from './domain/repositories/exam.repository.interface';

@Module({
  imports:     [DatabaseModule],
  controllers: [ExamController],
  providers:   [
    ExamUseCase,
    ExamRepository,
    { provide: EXAM_REPOSITORY, useClass: ExamRepository },
  ],
  exports: [ExamUseCase],
})
export class ExamsModule {}
