import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { KyselyService } from '../../../shared/infrastructure/database/kysely.service';
import { SubjectEntity } from '../domain/entities/subject.entity';
import { SubjectGradeEntity } from '../domain/entities/subject-grade.entity';
import { SubjectGradeRepository } from './subject-grade.repository';

@Injectable()
export class SubjectRepository {
  constructor(
    private readonly kysely: KyselyService,
    private readonly gradeRepo: SubjectGradeRepository,
  ) {}

  async findAll(tenantId: string): Promise<SubjectEntity[]> {
    const db = this.kysely.getTenantDb(tenantId);
    const rows = await db
      .selectFrom('subjects')
      .selectAll()
      .where('deleted_at', 'is', null)
      .orderBy('name', 'asc')
      .execute();
    return rows.map(this.toEntity);
  }

  async findById(tenantId: string, id: string): Promise<SubjectEntity | null> {
    const db = this.kysely.getTenantDb(tenantId);
    const row = await db
      .selectFrom('subjects')
      .selectAll()
      .where('id', '=', sql<string>`${id}::uuid`)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    return row ? this.toEntity(row) : null;
  }

  async findByIdWithGrades(
    tenantId: string,
    id: string,
  ): Promise<{ subject: SubjectEntity; grades: SubjectGradeEntity[] } | null> {
    const subject = await this.findById(tenantId, id);
    if (!subject) return null;
    const grades = await this.gradeRepo.findBySubjectId(tenantId, id);
    return { subject, grades };
  }

  async create(tenantId: string, data: { name: string; color?: string }): Promise<SubjectEntity> {
    const db = this.kysely.getTenantDb(tenantId);
    const row = await db
      .insertInto('subjects')
      .values({
        name: data.name,
        color: data.color ?? '#0E3B2E',
        is_active: true,
      } as any)
      .returningAll()
      .executeTakeFirstOrThrow();
    return this.toEntity(row);
  }

  async save(tenantId: string, subject: SubjectEntity): Promise<void> {
    const db = this.kysely.getTenantDb(tenantId);
    await db
      .updateTable('subjects')
      .set({
        name: subject.name,
        color: subject.color,
        is_active: subject.isActive,
        updated_at: new Date(),
        deleted_at: subject.deletedAt,
      } as any)
      .where('id', '=', sql<string>`${subject.id}::uuid`)
      .execute();
  }

  private toEntity(row: any): SubjectEntity {
    return new SubjectEntity(
      row.id,
      row.name,
      row.color,
      row.is_active,
      row.created_at,
      row.updated_at,
      row.deleted_at,
    );
  }
}
