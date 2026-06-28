import { SubjectEntity } from '../entities/subject.entity';
import { SubjectGradeEntity } from '../entities/subject-grade.entity';

export interface ISubjectRepository {
  findAll(tenantId: string): Promise<SubjectEntity[]>;
  findById(tenantId: string, id: string): Promise<SubjectEntity | null>;
  findByIdWithGrades(tenantId: string, id: string): Promise<{ subject: SubjectEntity; grades: SubjectGradeEntity[] } | null>;
  create(tenantId: string, data: { name: string; color?: string }): Promise<SubjectEntity>;
  save(tenantId: string, subject: SubjectEntity): Promise<void>;
}

export interface ISubjectGradeRepository {
  findBySubjectId(tenantId: string, subjectId: string): Promise<SubjectGradeEntity[]>;
  findById(tenantId: string, id: string): Promise<SubjectGradeEntity | null>;
  findBySubjectAndGrade(tenantId: string, subjectId: string, grade: string): Promise<SubjectGradeEntity | null>;
  create(tenantId: string, data: {
    subjectId: string;
    grade: string;
    fee: number;
    paymentType: 'monthly' | 'per_session' | 'termly';
    sessionDuration: number;
  }): Promise<SubjectGradeEntity>;
  save(tenantId: string, grade: SubjectGradeEntity): Promise<void>;
}
