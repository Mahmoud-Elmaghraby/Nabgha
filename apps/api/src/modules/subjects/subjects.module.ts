import { Module } from '@nestjs/common';
import { SubjectController } from './presentation/subject.controller';
import { SubjectUseCase } from './application/use-cases/subject.usecase';
import { SubjectRepository } from './infrastructure/subject.repository';
import { SubjectGradeRepository } from './infrastructure/subject-grade.repository';

@Module({
  controllers: [SubjectController],
  providers: [SubjectUseCase, SubjectRepository, SubjectGradeRepository],
  exports: [SubjectRepository, SubjectGradeRepository],
})
export class SubjectsModule {}
