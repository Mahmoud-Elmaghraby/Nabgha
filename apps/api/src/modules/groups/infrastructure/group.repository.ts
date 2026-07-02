import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { KyselyService } from '../../../shared/infrastructure/database/kysely.service';
import { GroupEntity, GroupStudentEntity, ScheduleItem } from '../domain/entities/group.entity';
import type { CreateGroupDto, ListGroupsDto } from '../application/dtos/group.dto';

@Injectable()
export class GroupRepository {
  constructor(private readonly kysely: KyselyService) {}

  async findAll(
    tenantId: string,
    params: ListGroupsDto,
  ): Promise<{ data: GroupEntity[]; total: number; page: number; limit: number }> {
    const db = this.kysely.getTenantDb(tenantId);
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    let base = db.selectFrom('groups').where('deleted_at', 'is', null);

    if (params.search) {
      base = base.where('name', 'ilike', `%${params.search}%`);
    }
    if (params.teacherId) {
      base = base.where('teacher_id', '=', sql<string>`${params.teacherId}::uuid`);
    }
    if (params.subjectGradeId) {
      base = base.where('subject_grade_id', '=', sql<string>`${params.subjectGradeId}::uuid`);
    }
    if (params.isActive !== undefined) {
      base = base.where('is_active', '=', params.isActive);
    }

    const countResult = await base
      .select(db.fn.countAll<number>().as('count'))
      .executeTakeFirst();
    const total = Number(countResult?.count || 0);

    const rows = await base
      .selectAll()
      .orderBy('name', 'asc')
      .limit(limit)
      .offset(offset)
      .execute();

    const groupIds = rows.map(r => r.id);
    const counts: Record<string, number> = {};

    if (groupIds.length > 0) {
      const countRows = await db
        .selectFrom('group_students')
        .select(['group_id', db.fn.countAll<number>().as('cnt')])
        .where('group_id', 'in', groupIds as any)
        .where('left_at', 'is', null)
        .groupBy('group_id')
        .execute();
      for (const r of countRows) {
        counts[r.group_id] = Number(r.cnt);
      }
    }

    return {
      data: rows.map(r => this.toEntity(r, counts[r.id] || 0)),
      total,
      page,
      limit,
    };
  }

  async findById(tenantId: string, id: string): Promise<GroupEntity | null> {
    const db = this.kysely.getTenantDb(tenantId);
    const row = await db
      .selectFrom('groups')
      .selectAll()
      .where('id', '=', sql<string>`${id}::uuid`)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    if (!row) return null;

    const countRow = await db
      .selectFrom('group_students')
      .select(db.fn.countAll<number>().as('cnt'))
      .where('group_id', '=', sql<string>`${id}::uuid`)
      .where('left_at', 'is', null)
      .executeTakeFirst();

    return this.toEntity(row, Number(countRow?.cnt || 0));
  }

  async create(tenantId: string, data: CreateGroupDto): Promise<GroupEntity> {
    const db = this.kysely.getTenantDb(tenantId);
    const row = await db
      .insertInto('groups')
      .values({
        name: data.name,
        subject_grade_id: data.subjectGradeId
          ? sql<string>`${data.subjectGradeId}::uuid`
          : null,
        teacher_id: data.teacherId
          ? sql<string>`${data.teacherId}::uuid`
          : null,
        max_students: data.maxStudents,
        schedule: JSON.stringify(data.schedule) as any,
        is_active: true,
      } as any)
      .returningAll()
      .executeTakeFirstOrThrow();
    return this.toEntity(row, 0);
  }

  async save(tenantId: string, group: GroupEntity): Promise<void> {
    const db = this.kysely.getTenantDb(tenantId);
    await db
      .updateTable('groups')
      .set({
        name: group.name,
        subject_grade_id: group.subjectGradeId
          ? sql<string>`${group.subjectGradeId}::uuid`
          : null,
        teacher_id: group.teacherId
          ? sql<string>`${group.teacherId}::uuid`
          : null,
        max_students: group.maxStudents,
        schedule: JSON.stringify(group.schedule) as any,
        is_active: group.isActive,
        updated_at: new Date(),
        deleted_at: group.deletedAt,
      } as any)
      .where('id', '=', sql<string>`${group.id}::uuid`)
      .execute();
  }

  async findGroupStudents(tenantId: string, groupId: string): Promise<GroupStudentEntity[]> {
    const db = this.kysely.getTenantDb(tenantId);
    const rows = await db
      .selectFrom('group_students as gs')
      .innerJoin('students as s', 's.id', 'gs.student_id')
      .select([
        'gs.id',
        'gs.group_id',
        'gs.student_id',
        'gs.discount',
        'gs.joined_at',
        'gs.left_at',
        's.full_name',
        's.student_code',
        's.parent_phone',
        's.student_phone',
        's.grade',
        's.is_active',
      ])
      .where('gs.group_id', '=', sql<string>`${groupId}::uuid`)
      .where('gs.left_at', 'is', null)
      .where('s.deleted_at', 'is', null)
      .orderBy('s.full_name', 'asc')
      .execute();

    return rows.map(r => ({
      ...new GroupStudentEntity(
        r.id,
        r.group_id,
        r.student_id,
        Number(r.discount),
        r.joined_at,
        r.left_at,
      ),
      fullName: r.full_name,
      studentCode: r.student_code,
      parentPhone: r.parent_phone,
      studentPhone: r.student_phone,
      grade: r.grade,
      isActive: r.is_active,
    })) as any;
  }

  async countGroupStudents(tenantId: string, groupId: string): Promise<number> {
    const db = this.kysely.getTenantDb(tenantId);
    const row = await db
      .selectFrom('group_students')
      .select(db.fn.countAll<number>().as('cnt'))
      .where('group_id', '=', sql<string>`${groupId}::uuid`)
      .where('left_at', 'is', null)
      .executeTakeFirst();
    return Number(row?.cnt || 0);
  }

  async isStudentInGroup(tenantId: string, groupId: string, studentId: string): Promise<boolean> {
    const db = this.kysely.getTenantDb(tenantId);
    const row = await db
      .selectFrom('group_students')
      .select('id')
      .where('group_id', '=', sql<string>`${groupId}::uuid`)
      .where('student_id', '=', sql<string>`${studentId}::uuid`)
      .where('left_at', 'is', null)
      .executeTakeFirst();
    return !!row;
  }

  async addStudent(
    tenantId: string,
    groupId: string,
    studentId: string,
    discount: number,
  ): Promise<GroupStudentEntity> {
    const db = this.kysely.getTenantDb(tenantId);
    const row = await db
      .insertInto('group_students')
      .values({
        group_id: sql<string>`${groupId}::uuid` as any,
        student_id: sql<string>`${studentId}::uuid` as any,
        discount,
      } as any)
      .returningAll()
      .executeTakeFirstOrThrow();
    return new GroupStudentEntity(
      row.id,
      row.group_id,
      row.student_id,
      Number(row.discount),
      row.joined_at,
      row.left_at,
    );
  }

  async updateStudentDiscount(
    tenantId: string,
    groupId: string,
    studentId: string,
    discount: number,
  ): Promise<void> {
    const db = this.kysely.getTenantDb(tenantId);
    await db
      .updateTable('group_students')
      .set({ discount } as any)
      .where('group_id', '=', sql<string>`${groupId}::uuid`)
      .where('student_id', '=', sql<string>`${studentId}::uuid`)
      .where('left_at', 'is', null)
      .execute();
  }

  async removeStudent(tenantId: string, groupId: string, studentId: string): Promise<void> {
    const db = this.kysely.getTenantDb(tenantId);
    await db
      .updateTable('group_students')
      .set({ left_at: new Date() } as any)
      .where('group_id', '=', sql<string>`${groupId}::uuid`)
      .where('student_id', '=', sql<string>`${studentId}::uuid`)
      .where('left_at', 'is', null)
      .execute();
  }

  private toEntity(row: any, studentCount = 0): GroupEntity {
    return new GroupEntity(
      row.id,
      row.name,
      row.subject_grade_id,
      row.teacher_id,
      Number(row.max_students),
      Array.isArray(row.schedule) ? row.schedule : JSON.parse(row.schedule || '[]'),
      row.is_active,
      row.created_at,
      row.updated_at,
      row.deleted_at,
      studentCount,
    );
  }
}
