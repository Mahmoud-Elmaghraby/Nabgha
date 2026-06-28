import { Module } from '@nestjs/common';
import { TeacherController } from './presentation/teacher.controller';
import { TeacherUseCase } from './application/use-cases/teacher.usecase';
import { TeacherRepository } from './infrastructure/teacher.repository';

@Module({
  controllers: [TeacherController],
  providers: [TeacherUseCase, TeacherRepository],
  exports: [TeacherUseCase, TeacherRepository],
})
export class TeachersModule {}
