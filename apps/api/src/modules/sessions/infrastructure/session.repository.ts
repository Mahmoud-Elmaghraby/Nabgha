import { Injectable } from '@nestjs/common';
import { KyselyService } from '../../../shared/infrastructure/database/kysely.service';
import { SessionEntity, AttendanceEntity, AttendanceStatus } from '../domain/entities/session.entity';
import { sql } from 'kysely';
import type { CreateSessionDto, ListSessionsDto } from '../application/dtos/session.dto';

@Injectable()
export class SessionRepository {
  constructor(private readonly kysely: KyselyService) {}

  private toSessionEntity(row: any): SessionEntity {
    return new SessionEntity(
      row.id, row.type, row.group_id ?? null, row.grade ?? null, row.subject_id ?? null,
      row.title, row.out_of ? Number(row.out_of) : null,
      row.start_date, row.end_date ?? null, row.start_time ?? null, row.end_time ?? null,
      row.status, row.image_url ?? null, row.notes ?? null, row.created_by ?? null,
      row.created_at, row.updated_at, row.deleted_at ?? null,
      row.group_name, row.subject_name, row.teacher_name,
      row.attendanceCount,
    );
  }

  private toAttendanceEntity(row: any): AttendanceEntity {
    return new AttendanceEntity(
      row.id, row.session_id, row.student_id,
      row.status as AttendanceStatus,
      row.degree ? Number(row.degree) : null,
      row.scanned_at ?? null, row.notes ?? null,
      row.created_at, row.updated_at,
      row.student_name, row.student_code, row.student_phone, row.parent_phone,
    );
  }

  async findAll(tenantId: string, params: ListSessionsDto): Promise<{ data: SessionEntity[]; total: number }> {
    const db = this.kysely.getTenantDb(tenantId);
    const offset = (params.page - 1) * params.limit;

    let query = db.selectFrom('sessions')
      .leftJoin('groups', 'groups.id', 'sessions.group_id')
      .leftJoin('subjects', 'subjects.id', 'sessions.subject_id')
      .leftJoin('teachers', 'teachers.id', 'groups.teacher_id')
      .select([
        'sessions.id', 'sessions.type', 'sessions.group_id', 'sessions.grade',
        'sessions.subject_id', 'sessions.title', 'sessions.out_of',
        'sessions.start_date', 'sessions.end_date', 'sessions.start_time',
        'sessions.end_time', 'sessions.status', 'sessions.image_url',
        'sessions.notes', 'sessions.created_by', 'sessions.created_at',
        'sessions.updated_at', 'sessions.deleted_at',
        'groups.name as group_name',
        'subjects.name as subject_name',
        'teachers.name as teacher_name',
      ])
      .where('sessions.deleted_at', 'is', null);

    if (params.type)    query = query.where('sessions.type', '=', params.type);
    if (params.groupId) query = query.where('sessions.group_id', '=', sql<string>`${params.groupId}::uuid`);
    if (params.grade)   query = query.where('sessions.grade', '=', params.grade);
    if (params.status)  query = query.where('sessions.status', '=', params.status);
    if (params.from)    query = query.where('sessions.start_date', '>=', new Date(params.from) as any);
    if (params.to)      query = query.where('sessions.start_date', '<=', new Date(params.to) as any);

    const countQuery = db.selectFrom('sessions')
      .select(db.fn.countAll<string>().as('count'))
      .where('sessions.deleted_at', 'is', null)
      .$if(!!params.type, q => q.where('sessions.type', '=', params.type!))
      .$if(!!params.groupId, q => q.where('sessions.group_id', '=', sql<string>`${params.groupId}::uuid`))
      .$if(!!params.grade, q => q.where('sessions.grade', '=', params.grade!))
      .$if(!!params.status, q => q.where('sessions.status', '=', params.status!));

    const [rows, countResult] = await Promise.all([
      query.orderBy('sessions.start_date', 'desc').orderBy('sessions.created_at', 'desc')
        .limit(params.limit).offset(offset).execute(),
      countQuery.executeTakeFirst(),
    ]);

    const sessionIds = rows.map(r => r.id);
    const countMap: Record<string, { present: number; absent: number; late: number; total: number }> = {};

    if (sessionIds.length > 0) {
      const counts = await db.selectFrom('attendance')
        .select(['session_id', 'status', db.fn.countAll<string>().as('cnt')])
        .where('session_id', 'in', sessionIds)
        .groupBy(['session_id', 'status'])
        .execute();
      for (const c of counts) {
        const sid = c.session_id as string;
        const st = c.status as AttendanceStatus;
        if (!countMap[sid]) countMap[sid] = { present: 0, absent: 0, late: 0, total: 0 };
        countMap[sid][st] = Number((c as any).cnt);
        countMap[sid].total += Number((c as any).cnt);
      }
    }

    return {
      data: rows.map((r: any) => {
        const entity = this.toSessionEntity(r);
        entity.attendanceCount = countMap[r.id] ?? { present: 0, absent: 0, late: 0, total: 0 };
        return entity;
      }),
      total: Number(countResult?.count ?? 0),
    };
  }

  async findById(tenantId: string, id: string): Promise<SessionEntity | null> {
    const db = this.kysely.getTenantDb(tenantId);
    const row = await db.selectFrom('sessions')
      .leftJoin('groups', 'groups.id', 'sessions.group_id')
      .leftJoin('subjects', 'subjects.id', 'sessions.subject_id')
      .leftJoin('teachers', 'teachers.id', 'groups.teacher_id')
      .select([
        'sessions.id', 'sessions.type', 'sessions.group_id', 'sessions.grade',
        'sessions.subject_id', 'sessions.title', 'sessions.out_of',
        'sessions.start_date', 'sessions.end_date', 'sessions.start_time',
        'sessions.end_time', 'sessions.status', 'sessions.image_url',
        'sessions.notes', 'sessions.created_by', 'sessions.created_at',
        'sessions.updated_at', 'sessions.deleted_at',
        'groups.name as group_name',
        'subjects.name as subject_name',
        'teachers.name as teacher_name',
      ])
      .where('sessions.id', '=', sql<string>`${id}::uuid`)
      .where('sessions.deleted_at', 'is', null)
      .executeTakeFirst();
    return row ? this.toSessionEntity(row) : null;
  }

  async create(tenantId: string, data: CreateSessionDto, userId: string): Promise<SessionEntity> {
    const db = this.kysely.getTenantDb(tenantId);
    const row = await db.insertInto('sessions').values({
      type: data.type,
      group_id: data.groupId ? sql<string>`${data.groupId}::uuid` : null,
      grade: data.grade ?? null,
      subject_id: data.subjectId ? sql<string>`${data.subjectId}::uuid` : null,
      title: data.title,
      out_of: data.outOf ?? null,
      start_date: new Date(data.startDate) as any,
      end_date: data.endDate ? new Date(data.endDate) as any : null,
      start_time: data.startTime ?? null,
      end_time: data.endTime ?? null,
      notes: data.notes ?? null,
      created_by: sql<string>`${userId}::uuid`,
    } as any).returningAll().executeTakeFirstOrThrow();
    return this.toSessionEntity(row);
  }

  async save(tenantId: string, session: SessionEntity): Promise<void> {
    const db = this.kysely.getTenantDb(tenantId);
    await db.updateTable('sessions').set({
      title: session.title,
      out_of: session.outOf,
      start_date: session.startDate as any,
      end_date: session.endDate as any,
      start_time: session.startTime,
      end_time: session.endTime,
      status: session.status,
      image_url: session.imageUrl,
      notes: session.notes,
      updated_at: new Date() as any,
      deleted_at: session.deletedAt as any,
    } as any).where('id', '=', sql<string>`${session.id}::uuid`).execute();
  }

  async initAttendance(tenantId: string, sessionId: string, studentIds: string[]): Promise<void> {
    if (studentIds.length === 0) return;
    const db = this.kysely.getTenantDb(tenantId);
    const values = studentIds.map(sid => ({
      session_id: sql<string>`${sessionId}::uuid`,
      student_id: sql<string>`${sid}::uuid`,
      status: 'absent' as const,
    }));
    await db.insertInto('attendance').values(values as any)
      .onConflict((oc: any) => oc.columns(['session_id', 'student_id']).doNothing())
      .execute();
  }

  async findAttendance(tenantId: string, sessionId: string): Promise<AttendanceEntity[]> {
    const db = this.kysely.getTenantDb(tenantId);
    const rows = await db.selectFrom('attendance')
      .innerJoin('students', 'students.id', 'attendance.student_id')
      .select([
        'attendance.id', 'attendance.session_id', 'attendance.student_id',
        'attendance.status', 'attendance.degree', 'attendance.scanned_at',
        'attendance.notes', 'attendance.created_at', 'attendance.updated_at',
        'students.full_name as student_name', 'students.student_code',
        'students.student_phone', 'students.parent_phone',
      ])
      .where('attendance.session_id', '=', sql<string>`${sessionId}::uuid`)
      .orderBy('students.full_name', 'asc')
      .execute();
    return rows.map(r => this.toAttendanceEntity(r));
  }

  async findAttendanceRecord(tenantId: string, sessionId: string, studentId: string): Promise<AttendanceEntity | null> {
    const db = this.kysely.getTenantDb(tenantId);
    const row = await db.selectFrom('attendance')
      .innerJoin('students', 'students.id', 'attendance.student_id')
      .select([
        'attendance.id', 'attendance.session_id', 'attendance.student_id',
        'attendance.status', 'attendance.degree', 'attendance.scanned_at',
        'attendance.notes', 'attendance.created_at', 'attendance.updated_at',
        'students.full_name as student_name', 'students.student_code',
        'students.student_phone', 'students.parent_phone',
      ])
      .where('attendance.session_id', '=', sql<string>`${sessionId}::uuid`)
      .where('attendance.student_id', '=', sql<string>`${studentId}::uuid`)
      .executeTakeFirst();
    return row ? this.toAttendanceEntity(row) : null;
  }

  async findAttendanceByQr(tenantId: string, sessionId: string, qrCode: string): Promise<AttendanceEntity | null> {
    const db = this.kysely.getTenantDb(tenantId);
    const row = await db.selectFrom('attendance')
      .innerJoin('students', 'students.id', 'attendance.student_id')
      .select([
        'attendance.id', 'attendance.session_id', 'attendance.student_id',
        'attendance.status', 'attendance.degree', 'attendance.scanned_at',
        'attendance.notes', 'attendance.created_at', 'attendance.updated_at',
        'students.full_name as student_name', 'students.student_code',
        'students.student_phone', 'students.parent_phone',
      ])
      .where('attendance.session_id', '=', sql<string>`${sessionId}::uuid`)
      .where('students.student_code', '=', qrCode)
      .executeTakeFirst();
    return row ? this.toAttendanceEntity(row) : null;
  }

  async saveAttendance(tenantId: string, record: AttendanceEntity): Promise<void> {
    const db = this.kysely.getTenantDb(tenantId);
    await db.updateTable('attendance').set({
      status: record.status,
      degree: record.degree,
      scanned_at: record.scannedAt as any,
      notes: record.notes,
      updated_at: new Date() as any,
    } as any).where('id', '=', sql<string>`${record.id}::uuid`).execute();
  }

  async getPreviousAbsentStudents(tenantId: string, sessionId: string, groupId: string): Promise<string[]> {
    const db = this.kysely.getTenantDb(tenantId);
    // جيب الحصة السابقة لنفس المجموعة
    const prevSession = await db.selectFrom('sessions')
      .select(['id'])
      .where('group_id', '=', sql<string>`${groupId}::uuid`)
      .where('id', '!=', sql<string>`${sessionId}::uuid`)
      .where('deleted_at', 'is', null)
      .where('status', '=', 'completed')
      .orderBy('start_date', 'desc')
      .limit(1)
      .executeTakeFirst();
    if (!prevSession) return [];
    const rows = await db.selectFrom('attendance')
      .select('student_id')
      .where('session_id', '=', sql<string>`${prevSession.id}::uuid`)
      .where('status', '=', 'absent')
      .execute();
    return rows.map(r => r.student_id as string);
  }

  async getStudentsByGroup(tenantId: string, groupId: string): Promise<string[]> {
    const db = this.kysely.getTenantDb(tenantId);
    const rows = await db.selectFrom('group_students')
      .select('student_id')
      .where('group_id', '=', sql<string>`${groupId}::uuid`)
      .where('left_at', 'is', null)
      .execute();
    return rows.map(r => r.student_id);
  }

  async getStudentsByGrade(tenantId: string, grade: string): Promise<string[]> {
    const db = this.kysely.getTenantDb(tenantId);
    const rows = await db.selectFrom('students')
      .select('id')
      .where('grade', '=', grade)
      .where('is_active', '=', true)
      .where('deleted_at', 'is', null)
      .execute();
    return rows.map(r => r.id);
  }
}
