import { Injectable } from '@nestjs/common';
import { SubjectRepository } from '../../infrastructure/subject.repository';
import { SubjectGradeRepository } from '../../infrastructure/subject-grade.repository';
import { SubjectEntity } from '../../domain/entities/subject.entity';
import { SubjectGradeEntity } from '../../domain/entities/subject-grade.entity';
import { AppError } from '../../../../core/errors/app.error';
import type {
  CreateSubjectDto,
  UpdateSubjectDto,
  CreateSubjectGradeDto,
  UpdateSubjectGradeDto,
} from '../dtos/subject.dto';

@Injectable()
export class SubjectUseCase {
  constructor(
    private readonly subjectRepo: SubjectRepository,
    private readonly gradeRepo: SubjectGradeRepository,
  ) {}

  async getAll(tenantId: string): Promise<{ subject: SubjectEntity; grades: SubjectGradeEntity[] }[]> {
    const subjects = await this.subjectRepo.findAll(tenantId);
    const result = await Promise.all(
      subjects.map(async (subject) => {
        const grades = await this.gradeRepo.findBySubjectId(tenantId, subject.id);
        return { subject, grades };
      }),
    );
    return result;
  }

  async getById(tenantId: string, id: string): Promise<{ subject: SubjectEntity; grades: SubjectGradeEntity[] }> {
    const result = await this.subjectRepo.findByIdWithGrades(tenantId, id);
    if (!result) throw new AppError('NOT_FOUND', 'المادة غير موجودة', 404);
    return result;
  }

  async create(tenantId: string, data: CreateSubjectDto): Promise<SubjectEntity> {
    return this.subjectRepo.create(tenantId, {
      name: data.name,
      color: data.color,
    });
  }

  async update(tenantId: string, id: string, data: UpdateSubjectDto): Promise<SubjectEntity> {
    const subject = await this.subjectRepo.findById(tenantId, id);
    if (!subject) throw new AppError('NOT_FOUND', 'المادة غير موجودة', 404);
    subject.update(data);
    await this.subjectRepo.save(tenantId, subject);
    return subject;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const subject = await this.subjectRepo.findById(tenantId, id);
    if (!subject) throw new AppError('NOT_FOUND', 'المادة غير موجودة', 404);
    subject.softDelete();
    await this.subjectRepo.save(tenantId, subject);
  }

  async addGrade(tenantId: string, subjectId: string, data: CreateSubjectGradeDto): Promise<SubjectGradeEntity> {
    const subject = await this.subjectRepo.findById(tenantId, subjectId);
    if (!subject) throw new AppError('NOT_FOUND', 'المادة غير موجودة', 404);

    const existing = await this.gradeRepo.findBySubjectAndGrade(tenantId, subjectId, data.grade);
    if (existing) throw new AppError('CONFLICT', `الصف "${data.grade}" مضاف بالفعل لهذه المادة`, 409);

    return this.gradeRepo.create(tenantId, {
      subjectId,
      grade: data.grade,
      fee: data.fee,
      paymentType: data.paymentType,
      sessionDuration: data.sessionDuration,
    });
  }

  async updateGrade(tenantId: string, subjectId: string, gradeId: string, data: UpdateSubjectGradeDto): Promise<SubjectGradeEntity> {
    const grade = await this.gradeRepo.findById(tenantId, gradeId);
    if (!grade || grade.subjectId !== subjectId) {
      throw new AppError('NOT_FOUND', 'الصف غير موجود', 404);
    }
    grade.update(data);
    await this.gradeRepo.save(tenantId, grade);
    return grade;
  }

  async deleteGrade(tenantId: string, subjectId: string, gradeId: string): Promise<void> {
    const grade = await this.gradeRepo.findById(tenantId, gradeId);
    if (!grade || grade.subjectId !== subjectId) {
      throw new AppError('NOT_FOUND', 'الصف غير موجود', 404);
    }
    grade.softDelete();
    await this.gradeRepo.save(tenantId, grade);
  }
}
