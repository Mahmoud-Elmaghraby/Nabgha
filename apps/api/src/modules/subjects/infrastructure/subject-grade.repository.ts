import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { KyselyService } from '../../../shared/infrastructure/database/kysely.service';
import { SubjectGradeEntity, PaymentType } from '../domain/entities/subject-grade.entity';

@Injectable()
export class SubjectGradeRepository {
  constructor(private readonly kysely: KyselyService) {}

  async findBySubjectId(tenantId: string, subjectId: string): Promise<SubjectGradeEntity[]> {
    const db = this.kysely.getTenantDb(tenantId);
    const rows = await db
      .selectFrom('subject_grades')
      .selectAll()
      .where('subject_id', '=', sql<string>`${subjectId}::uuid`)
      .where('deleted_at', 'is', null)
      .orderBy('grade', 'asc')
      .execute();
    return rows.map(this.toEntity);
  }

  async findById(tenantId: string, id: string): Promise<SubjectGradeEntity | null> {
    const db = this.kysely.getTenantDb(tenantId);
    const row = await db
      .selectFrom('subject_grades')
      .selectAll()
      .where('id', '=', sql<string>`${id}::uuid`)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    return row ? this.toEntity(row) : null;
  }

  async findBySubjectAndGrade(
    tenantId: string,
    subjectId: string,
    grade: string,
  ): Promise<SubjectGradeEntity | null> {
    const db = this.kysely.getTenantDb(tenantId);
    const row = await db
      .selectFrom('subject_grades')
      .selectAll()
      .where('subject_id', '=', sql<string>`${subjectId}::uuid`)
      .where('grade', '=', grade)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    return row ? this.toEntity(row) : null;
  }

  async create(
    tenantId: string,
    data: {
      subjectId: string;
      grade: string;
      fee: number;
      paymentType: PaymentType;
      sessionDuration: number;
    },
  ): Promise<SubjectGradeEntity> {
    const db = this.kysely.getTenantDb(tenantId);
    const row = await db
      .insertInto('subject_grades')
      .values({
        subject_id: sql<string>`${data.subjectId}::uuid` as any,
        grade: data.grade,
        fee: data.fee,
        payment_type: data.paymentType,
        session_duration: data.sessionDuration,
        is_active: true,
      } as any)
      .returningAll()
      .executeTakeFirstOrThrow();
    return this.toEntity(row);
  }

  async save(tenantId: string, grade: SubjectGradeEntity): Promise<void> {
    const db = this.kysely.getTenantDb(tenantId);
    await db
      .updateTable('subject_grades')
      .set({
        fee: grade.fee,
        payment_type: grade.paymentType,
        session_duration: grade.sessionDuration,
        is_active: grade.isActive,
        updated_at: new Date(),
        deleted_at: grade.deletedAt,
      } as any)
      .where('id', '=', sql<string>`${grade.id}::uuid`)
      .execute();
  }

  private toEntity(row: any): SubjectGradeEntity {
    return new SubjectGradeEntity(
      row.id,
      row.subject_id,
      row.grade,
      Number(row.fee),
      row.payment_type as PaymentType,
      Number(row.session_duration),
      row.is_active,
      row.created_at,
      row.updated_at,
      row.deleted_at,
    );
  }
}
