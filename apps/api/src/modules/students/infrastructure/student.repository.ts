import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { KyselyService } from '../../../shared/infrastructure/database/kysely.service';
import { StudentEntity } from '../domain/entities/student.entity';
import type { CreateStudentDto, ListStudentsDto } from '../application/dtos/student.dto';

@Injectable()
export class StudentRepository {
  constructor(private readonly kysely: KyselyService) {}

  async findAll(
    tenantId: string,
    params: ListStudentsDto,
  ): Promise<{ data: StudentEntity[]; total: number; page: number; limit: number }> {
    const db = this.kysely.getTenantDb(tenantId);
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    let base = db.selectFrom('students').where('deleted_at', 'is', null);

    if (params.search) {
      base = base.where(eb => eb.or([
        eb('full_name', 'ilike', `%${params.search}%`),
        eb('parent_phone', 'ilike', `%${params.search}%`),
        eb('student_phone', 'ilike', `%${params.search}%`),
      ]));
    }
    if (params.grade) base = base.where('grade', '=', params.grade);
    if (params.isActive !== undefined) base = base.where('is_active', '=', params.isActive);

    const countResult = await base
      .select(db.fn.countAll<number>().as('count'))
      .executeTakeFirst();
    const total = Number(countResult?.count || 0);

    const rows = await base
      .selectAll()
      .orderBy('full_name', 'asc')
      .limit(limit)
      .offset(offset)
      .execute();

    return { data: rows.map(r => this.toEntity(r)), total, page, limit };
  }

  async findById(tenantId: string, id: string): Promise<StudentEntity | null> {
    const db = this.kysely.getTenantDb(tenantId);
    const row = await db
      .selectFrom('students')
      .selectAll()
      .where('id', '=', sql<string>`${id}::uuid`)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    return row ? this.toEntity(row) : null;
  }

  async create(tenantId: string, data: CreateStudentDto & { qrCode: string; studentCode: string }): Promise<StudentEntity> {
    const db = this.kysely.getTenantDb(tenantId);
    const row = await db
      .insertInto('students')
      .values({
        full_name: data.fullName,
        parent_phone: data.parentPhone,
        student_phone: data.studentPhone,
        date_of_birth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        grade: data.grade,
        address: data.address ?? null,
        school: data.school ?? null,
        parent_occupation: data.parentOccupation ?? null,
        notes: data.notes ?? null,
        qr_code: data.qrCode,
        student_code: data.studentCode,
        is_active: true,
      } as any)
      .returningAll()
      .executeTakeFirstOrThrow();
    return this.toEntity(row);
  }

  async save(tenantId: string, student: StudentEntity): Promise<void> {
    const db = this.kysely.getTenantDb(tenantId);
    await db
      .updateTable('students')
      .set({
        full_name: student.fullName,
        parent_phone: student.parentPhone,
        student_phone: student.studentPhone,
        date_of_birth: student.dateOfBirth,
        grade: student.grade,
        address: student.address,
        school: student.school,
        parent_occupation: student.parentOccupation,
        notes: student.notes,
        is_active: student.isActive,
        updated_at: new Date(),
        deleted_at: student.deletedAt,
      } as any)
      .where('id', '=', sql<string>`${student.id}::uuid`)
      .execute();
  }

  async generateStudentCode(tenantId: string): Promise<string> {
    const schemaName = `tenant_${tenantId.replace(/-/g, '_')}`;
    const db = this.kysely.getTenantDb(tenantId);
    const seqName = `${schemaName}.student_code_seq`;
    const row = await sql<{ code: string }>`
      SELECT 'STU-' || LPAD(nextval(${sql.lit(seqName)})::text, 5, '0') as code
    `.execute(db);
    return row.rows[0]?.code ?? `STU-${Date.now()}`;
  }

  async hasRelatedData(tenantId: string, studentId: string): Promise<{
    hasData: boolean;
    details: Record<string, number>;
  }> {
    const db = this.kysely.getTenantDb(tenantId);
    const [groups, payments, attendance] = await Promise.all([
      db.selectFrom('group_students')
        .select(db.fn.countAll<number>().as('count'))
        .where('student_id', '=', sql<string>`${studentId}::uuid`)
        .executeTakeFirst(),
      db.selectFrom('payments')
        .select(db.fn.countAll<number>().as('count'))
        .where('student_id', '=', sql<string>`${studentId}::uuid`)
        .executeTakeFirst(),
      db.selectFrom('attendance')
        .select(db.fn.countAll<number>().as('count'))
        .where('student_id', '=', sql<string>`${studentId}::uuid`)
        .executeTakeFirst(),
    ]);

    const details = {
      groups: Number(groups?.count || 0),
      payments: Number(payments?.count || 0),
      attendance: Number(attendance?.count || 0),
    };

    return { hasData: Object.values(details).some(v => v > 0), details };
  }

  async findGroups(tenantId: string, studentId: string): Promise<any[]> {
    const db = this.kysely.getTenantDb(tenantId);
    return db
      .selectFrom('group_students as gs')
      .innerJoin('groups as g', 'g.id', 'gs.group_id')
      .select([
        'gs.id as enrollment_id',
        'gs.discount',
        'gs.joined_at',
        'g.id as group_id',
        'g.name as group_name',
        'g.subject_grade_id',
        'g.teacher_id',
        'g.max_students',
        'g.schedule',
        'g.is_active',
      ])
      .where('gs.student_id', '=', sql<string>`${studentId}::uuid`)
      .where('gs.left_at', 'is', null)
      .where('g.deleted_at', 'is', null)
      .orderBy('g.name', 'asc')
      .execute()
      .then(rows => rows.map(r => ({ ...r, discount: Number(r.discount) })));
  }

  private toEntity(row: any): StudentEntity {
    return new StudentEntity({
      id: row.id,
      fullName: row.full_name,
      parentPhone: row.parent_phone,
      studentPhone: row.student_phone,
      dateOfBirth: row.date_of_birth,
      grade: row.grade,
      address: row.address,
      school: row.school,
      parentOccupation: row.parent_occupation,
      notes: row.notes,
      qrCode: row.qr_code,
      studentCode: row.student_code ?? null,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    });
  }
}
