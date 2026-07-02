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
    const countMap: Record<string, { present: number; absent: number; late: number; excused: number; total: number }> = {};

    if (sessionIds.length > 0) {
      const counts = await db.selectFrom('attendance')
        .select(['session_id', 'status', db.fn.countAll<string>().as('cnt')])
        .where('session_id', 'in', sessionIds)
        .groupBy(['session_id', 'status'])
        .execute();
      for (const c of counts) {
        const sid = c.session_id as string;
        const st = c.status as AttendanceStatus;
        if (!countMap[sid]) countMap[sid] = { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
        countMap[sid][st] = Number((c as any).cnt);
        countMap[sid].total += Number((c as any).cnt);
      }
    }

    return {
      data: rows.map((r: any) => {
        const entity = this.toSessionEntity(r);
        entity.attendanceCount = countMap[r.id] ?? { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
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

  // ─── إنذار عدم السداد (الشهر الحالي بنفس مادة المجموعة) ───
  async getUnpaidStudentIds(tenantId: string, groupId: string): Promise<string[]> {
    const db = this.kysely.getTenantDb(tenantId);
    const group = await db.selectFrom('groups')
      .select('subject_grade_id')
      .where('id', '=', sql<string>`${groupId}::uuid`)
      .executeTakeFirst();
    if (!group?.subject_grade_id) return [];

    const currentMonth = new Date().toISOString().slice(0, 7);
    const rows = await db.selectFrom('monthly_dues')
      .select('student_id')
      .where('subject_grade_id', '=', sql<string>`${group.subject_grade_id}::uuid`)
      .where('month', '=', currentMonth)
      .where('status', 'in', ['unpaid', 'partial'])
      .execute();
    return rows.map(r => r.student_id as string);
  }

  // ─── تقرير غياب حصة معينة (اسم + تليفون + معدل غياب الطالب في المجموعة) ───
  async getAbsenceReport(tenantId: string, sessionId: string): Promise<{
    studentId: string; studentName: string; studentCode: string; parentPhone: string | null;
    absentCount: number; totalSessions: number;
  }[]> {
    const db = this.kysely.getTenantDb(tenantId);

    const session = await db.selectFrom('sessions')
      .select('group_id')
      .where('id', '=', sql<string>`${sessionId}::uuid`)
      .executeTakeFirst();
    if (!session?.group_id) return [];

    const absentStudents = await db.selectFrom('attendance')
      .innerJoin('students', 'students.id', 'attendance.student_id')
      .select(['students.id', 'students.full_name', 'students.student_code', 'students.parent_phone'])
      .where('attendance.session_id', '=', sql<string>`${sessionId}::uuid`)
      .where('attendance.status', '=', 'absent')
      .execute();

    if (absentStudents.length === 0) return [];

    const studentIds = absentStudents.map(s => s.id as string);
    const stats = await db.selectFrom('attendance')
      .innerJoin('sessions', 'sessions.id', 'attendance.session_id')
      .select([
        'attendance.student_id',
        db.fn.count('attendance.id').as('total'),
        sql<string>`COUNT(*) FILTER (WHERE attendance.status = 'absent')`.as('absent'),
      ])
      .where('sessions.group_id', '=', sql<string>`${session.group_id}::uuid`)
      .where('attendance.student_id', 'in', studentIds)
      .where('sessions.deleted_at', 'is', null)
      .groupBy('attendance.student_id')
      .execute();

    const statsMap = new Map(stats.map(s => [s.student_id as string, {
      total: Number(s.total), absent: Number((s as any).absent),
    }]));

    return absentStudents.map(s => {
      const stat = statsMap.get(s.id as string) ?? { total: 0, absent: 0 };
      return {
        studentId: s.id as string,
        studentName: s.full_name as string,
        studentCode: s.student_code as string,
        parentPhone: s.parent_phone as string | null,
        absentCount: stat.absent,
        totalSessions: stat.total,
      };
    });
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

  // ─── نظام رصيد التعويض (حضور بديل في مجموعة تانية بنفس المادة) ─────

  async getGroupSubjectGradeId(tenantId: string, groupId: string): Promise<string | null> {
    const db = this.kysely.getTenantDb(tenantId);
    const row = await db.selectFrom('groups')
      .select('subject_grade_id')
      .where('id', '=', sql<string>`${groupId}::uuid`)
      .executeTakeFirst();
    return row?.subject_grade_id ?? null;
  }

  async resolveStudentIdByCode(tenantId: string, studentCode: string): Promise<string | null> {
    const db = this.kysely.getTenantDb(tenantId);
    const row = await db.selectFrom('students')
      .select('id')
      .where('student_code', '=', studentCode)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    return row ? (row.id as string) : null;
  }

  async isStudentInAttendance(tenantId: string, sessionId: string, studentId: string): Promise<boolean> {
    const db = this.kysely.getTenantDb(tenantId);
    const row = await db.selectFrom('attendance')
      .select('id')
      .where('session_id', '=', sql<string>`${sessionId}::uuid`)
      .where('student_id', '=', sql<string>`${studentId}::uuid`)
      .executeTakeFirst();
    return !!row;
  }

  async addExternalAttendance(tenantId: string, sessionId: string, studentId: string): Promise<AttendanceEntity> {
    const db = this.kysely.getTenantDb(tenantId);
    const inserted = await db.insertInto('attendance').values({
      session_id: sql<string>`${sessionId}::uuid`,
      student_id: sql<string>`${studentId}::uuid`,
      status: 'present',
      scanned_at: new Date(),
    } as any).returningAll().executeTakeFirstOrThrow();

    const full = await db.selectFrom('attendance')
      .innerJoin('students', 'students.id', 'attendance.student_id')
      .select([
        'attendance.id', 'attendance.session_id', 'attendance.student_id',
        'attendance.status', 'attendance.degree', 'attendance.scanned_at',
        'attendance.notes', 'attendance.created_at', 'attendance.updated_at',
        'students.full_name as student_name', 'students.student_code',
        'students.student_phone', 'students.parent_phone',
      ])
      .where('attendance.id', '=', sql<string>`${inserted.id}::uuid`)
      .executeTakeFirstOrThrow();
    return this.toAttendanceEntity(full);
  }

  async findPendingAbsenceForSubject(
    tenantId: string, studentId: string, subjectGradeId: string,
    weekStart: Date, weekEnd: Date,
  ): Promise<AttendanceEntity | null> {
    const db = this.kysely.getTenantDb(tenantId);
    const row = await db.selectFrom('attendance')
      .innerJoin('sessions', 'sessions.id', 'attendance.session_id')
      .innerJoin('groups', 'groups.id', 'sessions.group_id')
      .innerJoin('students', 'students.id', 'attendance.student_id')
      .select([
        'attendance.id', 'attendance.session_id', 'attendance.student_id',
        'attendance.status', 'attendance.degree', 'attendance.scanned_at',
        'attendance.notes', 'attendance.created_at', 'attendance.updated_at',
        'students.full_name as student_name', 'students.student_code',
        'students.student_phone', 'students.parent_phone',
      ])
      .where('attendance.student_id', '=', sql<string>`${studentId}::uuid`)
      .where('attendance.status', '=', 'absent')
      .where('groups.subject_grade_id', '=', sql<string>`${subjectGradeId}::uuid`)
      .where('sessions.start_date', '>=', weekStart as any)
      .where('sessions.start_date', '<=', weekEnd as any)
      .where('sessions.deleted_at', 'is', null)
      .orderBy('sessions.start_date', 'asc')
      .limit(1)
      .executeTakeFirst();
    return row ? this.toAttendanceEntity(row) : null;
  }

  async createAttendanceCredit(tenantId: string, data: {
    studentId: string; subjectGradeId: string; sourceSessionId: string;
    sourceAttendanceId: string; weekStart: Date; weekEnd: Date;
  }): Promise<void> {
    const db = this.kysely.getTenantDb(tenantId);
    await db.insertInto('attendance_credits').values({
      student_id: sql<string>`${data.studentId}::uuid`,
      subject_grade_id: sql<string>`${data.subjectGradeId}::uuid`,
      source_session_id: sql<string>`${data.sourceSessionId}::uuid`,
      source_attendance_id: sql<string>`${data.sourceAttendanceId}::uuid`,
      week_start: data.weekStart as any,
      week_end: data.weekEnd as any,
      status: 'available',
    } as any).execute();
  }

  async findAvailableCredit(
    tenantId: string, studentId: string, subjectGradeId: string,
    weekStart: Date, weekEnd: Date,
  ): Promise<{ id: string } | null> {
    const db = this.kysely.getTenantDb(tenantId);
    const row = await db.selectFrom('attendance_credits')
      .select('id')
      .where('student_id', '=', sql<string>`${studentId}::uuid`)
      .where('subject_grade_id', '=', sql<string>`${subjectGradeId}::uuid`)
      .where('status', '=', 'available')
      .where('week_start', '=', weekStart as any)
      .where('week_end', '=', weekEnd as any)
      .orderBy('created_at', 'asc')
      .limit(1)
      .executeTakeFirst();
    return row ? { id: row.id as string } : null;
  }

  async consumeCredit(tenantId: string, creditId: string, consumedAttendanceId: string): Promise<void> {
    const db = this.kysely.getTenantDb(tenantId);
    await db.updateTable('attendance_credits').set({
      status: 'consumed',
      consumed_attendance_id: sql<string>`${consumedAttendanceId}::uuid`,
      consumed_at: new Date(),
      updated_at: new Date(),
    } as any)
    .where('id', '=', sql<string>`${creditId}::uuid`)
    .execute();
  }

  async findAbsentAttendanceForSession(tenantId: string, sessionId: string): Promise<AttendanceEntity[]> {
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
      .where('attendance.status', '=', 'absent')
      .execute();
    return rows.map(r => this.toAttendanceEntity(r));
  }
}
