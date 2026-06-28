import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { KyselyService } from '../../../shared/infrastructure/database/kysely.service';
import { TeacherEntity } from '../domain/entities/teacher.entity';
import type { CreateTeacherDto } from '../application/dtos/teacher.dto';

@Injectable()
export class TeacherRepository {
  constructor(private readonly kysely: KyselyService) {}

  async findAll(tenantId: string, search?: string): Promise<TeacherEntity[]> {
    const db = await this.kysely.getTenantDb(tenantId);
    let query = db.selectFrom('teachers').selectAll().where('deleted_at', 'is', null);
    if (search) {
      query = query.where((eb) =>
        eb.or([
          eb('name', 'ilike', `%${search}%`),
          eb('phone', 'ilike', `%${search}%`),
          eb('email', 'ilike', `%${search}%`),
        ]),
      );
    }
    const rows = await query.orderBy('name', 'asc').execute();
    return rows.map(this.toEntity);
  }

  async findById(tenantId: string, id: string): Promise<TeacherEntity | null> {
    const db = await this.kysely.getTenantDb(tenantId);
    const row = await db
      .selectFrom('teachers')
      .selectAll()
      .where('id', '=', sql<string>`${id}::uuid`)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    return row ? this.toEntity(row) : null;
  }

  async create(tenantId: string, data: CreateTeacherDto): Promise<TeacherEntity> {
    const db = await this.kysely.getTenantDb(tenantId);
    const row = await db
      .insertInto('teachers')
      .values({
        name: data.name,
        phone: data.phone ?? null,
        email: data.email ?? null,
        subject_ids: JSON.stringify(data.subjectIds ?? []) as any,
        notes: data.notes ?? null,
        is_active: true,
      } as any)
      .returningAll()
      .executeTakeFirstOrThrow();
    return this.toEntity(row);
  }

  async save(tenantId: string, teacher: TeacherEntity): Promise<void> {
    const db = await this.kysely.getTenantDb(tenantId);
    await db
      .updateTable('teachers')
      .set({
        name: teacher.name,
        phone: teacher.phone,
        email: teacher.email,
        subject_ids: JSON.stringify(teacher.subjectIds) as any,
        notes: teacher.notes,
        is_active: teacher.isActive,
        updated_at: new Date(),
        deleted_at: teacher.deletedAt,
      } as any)
      .where('id', '=', sql<string>`${teacher.id}::uuid`)
      .execute();
  }

  private toEntity(row: any): TeacherEntity {
    return new TeacherEntity(
      row.id,
      row.name,
      row.phone,
      row.email,
      Array.isArray(row.subject_ids) ? row.subject_ids : JSON.parse(row.subject_ids || '[]'),
      row.notes,
      row.is_active,
      row.created_at,
      row.updated_at,
      row.deleted_at,
    );
  }
}
