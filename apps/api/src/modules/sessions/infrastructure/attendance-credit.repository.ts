import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { TenantDatabase } from '@nabgha/db';
import { KyselyService } from '../../../shared/infrastructure/database/kysely.service';

export interface CreditRow {
  id: string;
  studentId: string;
  subjectGradeId: string;
  weekStart: string;
  status: 'available' | 'consumed' | 'revoked';
  sourceAttendanceId: string;
  consumedAttendanceId: string | null;
}

/**
 * كل عمليات رصيد التعويض على قاعدة البيانات.
 * أي عملية "صرف" رصيد على غياب بتحصل في transaction واحدة وبشكل ذرّي
 * (UPDATE ... WHERE status = 'available' / 'absent') عشان لو حصتين اتقفلوا في نفس
 * اللحظة مايتصرفش نفس الرصيد مرتين، وماينفعش غياب ياخد رصيدين.
 */
@Injectable()
export class AttendanceCreditRepository {
  constructor(private readonly kysely: KyselyService) {}

  private db(tenantId: string) {
    return this.kysely.getTenantDb(tenantId);
  }

  /**
   * transaction على schema المركز — لازم لأي SQL خام هنا (UPDATE ... RETURNING،
   * FOR UPDATE SKIP LOCKED) لإن الـ SQL الخام مابياخدش الـ schema تلقائي زي الـ query builder.
   */
  private inTenantTrx<T>(tenantId: string, fn: (trx: Kysely<TenantDatabase>) => Promise<T>): Promise<T> {
    const schema = this.kysely.getTenantSchema(tenantId);
    return this.db(tenantId).transaction().execute(async (trx) => {
      await sql`SET LOCAL search_path TO ${sql.id(schema)}`.execute(trx);
      return fn(trx);
    });
  }

  private toRow(r: any): CreditRow {
    const ws = r.week_start instanceof Date
      ? `${r.week_start.getFullYear()}-${String(r.week_start.getMonth() + 1).padStart(2, '0')}-${String(r.week_start.getDate()).padStart(2, '0')}`
      : String(r.week_start).slice(0, 10);
    return {
      id: r.id,
      studentId: r.student_id,
      subjectGradeId: r.subject_grade_id,
      weekStart: ws,
      status: r.status,
      sourceAttendanceId: r.source_attendance_id,
      consumedAttendanceId: r.consumed_attendance_id ?? null,
    };
  }

  // ─── قراءة ────────────────────────────────────────────────

  async findBySource(tenantId: string, sourceAttendanceId: string): Promise<CreditRow | null> {
    const row = await this.db(tenantId).selectFrom('attendance_credits').selectAll()
      .where('source_attendance_id', '=', sql<string>`${sourceAttendanceId}::uuid`)
      .executeTakeFirst();
    return row ? this.toRow(row) : null;
  }

  async isExternal(tenantId: string, attendanceId: string): Promise<boolean> {
    const credit = await this.findBySource(tenantId, attendanceId);
    return !!credit && credit.status !== 'revoked';
  }

  /** كل الأرصدة المرتبطة بحصة: اللي اتولدت من حضور بديل فيها، واللي اتصرفت على غياب فيها */
  async findForSession(tenantId: string, sessionId: string): Promise<{ sourced: CreditRow[]; consumedHere: CreditRow[] }> {
    const db = this.db(tenantId);
    const attendanceIds = db.selectFrom('attendance').select('id')
      .where('session_id', '=', sql<string>`${sessionId}::uuid`);
    const [sourced, consumedHere] = await Promise.all([
      db.selectFrom('attendance_credits').selectAll()
        .where('source_attendance_id', 'in', attendanceIds as any)
        .where('status', '!=', 'revoked' as any)
        .execute(),
      db.selectFrom('attendance_credits').selectAll()
        .where('consumed_attendance_id', 'in', attendanceIds as any)
        .where('status', '=', 'consumed' as any)
        .execute(),
    ]);
    return { sourced: sourced.map(r => this.toRow(r)), consumedHere: consumedHere.map(r => this.toRow(r)) };
  }

  /** أرصدة متاحة لسه ما اتصرفتش، من آخر كام أسبوع (للمطابقة اليومية) */
  async findAvailableSince(tenantId: string, sinceWeekStart: string): Promise<CreditRow[]> {
    const rows = await this.db(tenantId).selectFrom('attendance_credits').selectAll()
      .where('status', '=', 'available' as any)
      .where('week_start', '>=', sinceWeekStart as any)
      .orderBy('created_at', 'asc')
      .execute();
    return rows.map(r => this.toRow(r));
  }

  /**
   * أقدم غياب "حقيقي" للطالب في نفس المادة/الصف ونفس الأسبوع، في حصة حصلت فعلاً:
   * - الحصة منتهية، أو
   * - يومها عدّى والمدرّس أخد فيها حضور (فيه طالب واحد على الأقل مش غايب) —
   *   عشان لو المدرّس مابيدوسش "إنهاء" الغياب يتحسب برضو.
   * الحصص المجدولة لسه/الملغية مستبعدة: الغياب فيها افتراضي ومالوش معنى.
   */
  async findEligibleAbsence(
    tenantId: string, studentId: string, subjectGradeId: string, weekStart: string, weekEnd: string,
  ): Promise<{ attendanceId: string; sessionId: string } | null> {
    const row = await this.db(tenantId).selectFrom('attendance')
      .innerJoin('sessions', 'sessions.id', 'attendance.session_id')
      .innerJoin('groups', 'groups.id', 'sessions.group_id')
      .select(['attendance.id as attendance_id', 'sessions.id as session_id'])
      .where('attendance.student_id', '=', sql<string>`${studentId}::uuid`)
      .where('attendance.status', '=', 'absent')
      .where('groups.subject_grade_id', '=', sql<string>`${subjectGradeId}::uuid`)
      .where('sessions.start_date', '>=', weekStart as any)
      .where('sessions.start_date', '<=', weekEnd as any)
      .where('sessions.deleted_at', 'is', null)
      .where('sessions.status', '!=', 'cancelled' as any)
      .where(({ or, and, eb, exists, selectFrom }) => or([
        eb('sessions.status', '=', 'completed'),
        and([
          eb('sessions.start_date', '<', sql<Date>`CURRENT_DATE`),
          exists(selectFrom('attendance as a2').select('a2.id')
            .whereRef('a2.session_id', '=', 'sessions.id')
            .where('a2.status', '<>', 'absent')),
        ]),
      ]))
      // الحضور البديل نفسه مايتحسبش غياب أصلي
      .where(({ not, exists, selectFrom }) => not(exists(
        selectFrom('attendance_credits as c').select('c.id')
          .whereRef('c.source_attendance_id', '=', 'attendance.id'),
      )))
      .orderBy('sessions.start_date', 'asc')
      .orderBy('sessions.start_time', 'asc')
      .limit(1)
      .executeTakeFirst();
    return row ? { attendanceId: row.attendance_id as string, sessionId: row.session_id as string } : null;
  }

  // ─── كتابة ────────────────────────────────────────────────

  /** رصيد جديد لحضور بديل — ولو كان فيه رصيد ملغي لنفس السجل (اتشال ورجع) بيرجع متاح */
  async createForExternal(tenantId: string, data: {
    studentId: string; subjectGradeId: string; sourceSessionId: string;
    sourceAttendanceId: string; weekStart: string; weekEnd: string;
  }): Promise<CreditRow> {
    const row = await this.db(tenantId).insertInto('attendance_credits').values({
      student_id: sql<string>`${data.studentId}::uuid`,
      subject_grade_id: sql<string>`${data.subjectGradeId}::uuid`,
      source_session_id: sql<string>`${data.sourceSessionId}::uuid`,
      source_attendance_id: sql<string>`${data.sourceAttendanceId}::uuid`,
      week_start: data.weekStart as any,
      week_end: data.weekEnd as any,
      status: 'available',
    } as any)
      .onConflict((oc) => oc.column('source_attendance_id').doUpdateSet({
        status: 'available', consumed_attendance_id: null, consumed_at: null, updated_at: new Date(),
      } as any))
      .returningAll()
      .executeTakeFirstOrThrow();
    return this.toRow(row);
  }

  /**
   * يصرف رصيد على غياب ويحوّل الغياب لـ "معذور" — الاتنين مع بعض أو ولا واحد.
   * creditId محدد = نصرف الرصيد ده بالذات، من غيره = أقدم رصيد متاح للطالب في الأسبوع.
   * بيرجع رقم الرصيد اللي اتصرف، أو null لو مفيش رصيد متاح أو الغياب اتغيّر في النص.
   */
  async consumeOnAbsence(tenantId: string, args: {
    absenceAttendanceId: string;
    note: string;
    creditId?: string;
    studentId?: string; subjectGradeId?: string; weekStart?: string;
  }): Promise<string | null> {
    return this.inTenantTrx(tenantId, async (trx) => {
      const pick = args.creditId
        ? sql`SELECT id FROM attendance_credits WHERE id = ${args.creditId}::uuid AND status = 'available' FOR UPDATE SKIP LOCKED`
        : sql`SELECT id FROM attendance_credits
              WHERE student_id = ${args.studentId}::uuid
                AND subject_grade_id = ${args.subjectGradeId}::uuid
                AND week_start = ${args.weekStart}::date
                AND status = 'available'
              ORDER BY created_at ASC
              LIMIT 1
              FOR UPDATE SKIP LOCKED`;

      const consumed = await sql<{ id: string }>`
        UPDATE attendance_credits
           SET status = 'consumed',
               consumed_attendance_id = ${args.absenceAttendanceId}::uuid,
               consumed_at = NOW(),
               updated_at = NOW()
         WHERE id = (${pick})
        RETURNING id`.execute(trx);
      const creditId = consumed.rows[0]?.id;
      if (!creditId) return null;

      const excused = await sql<{ id: string }>`
        UPDATE attendance
           SET status = 'excused', notes = ${args.note}, updated_at = NOW()
         WHERE id = ${args.absenceAttendanceId}::uuid AND status = 'absent'
        RETURNING id`.execute(trx);
      if (!excused.rows[0]) {
        // الغياب اتغيّر (اتسجل حضور مثلاً) قبل ما نوصله — نرجّع كل حاجة
        throw new CreditConsumeAborted();
      }
      return creditId;
    }).catch((err) => {
      if (err instanceof CreditConsumeAborted) return null;
      throw err;
    });
  }

  /** يرجّع الرصيد اللي كان مصروف على غياب معيّن لـ "متاح" — بيرجع الرصيد عشان نحاول نصرفه على غياب تاني */
  async releaseConsumedBy(tenantId: string, absenceAttendanceId: string): Promise<CreditRow | null> {
    return this.inTenantTrx(tenantId, async (trx) => {
      const res = await sql<any>`
        UPDATE attendance_credits
           SET status = 'available', consumed_attendance_id = NULL, consumed_at = NULL, updated_at = NOW()
         WHERE consumed_attendance_id = ${absenceAttendanceId}::uuid AND status = 'consumed'
        RETURNING *`.execute(trx);
      return res.rows[0] ? this.toRow(res.rows[0]) : null;
    });
  }

  /** يلغي رصيد (الحضور البديل اتشال) — ولو كان مصروف على غياب، الغياب يرجع "غايب" */
  async revoke(tenantId: string, creditId: string): Promise<{ revertedAbsenceId: string | null }> {
    return this.inTenantTrx(tenantId, async (trx) => {
      const cur = await sql<{ status: string; consumed_attendance_id: string | null }>`
        SELECT status, consumed_attendance_id FROM attendance_credits
         WHERE id = ${creditId}::uuid FOR UPDATE`.execute(trx);
      const prev = cur.rows[0];
      if (!prev || prev.status === 'revoked') return { revertedAbsenceId: null };

      await sql`
        UPDATE attendance_credits SET status = 'revoked', updated_at = NOW()
         WHERE id = ${creditId}::uuid`.execute(trx);

      if (prev.status !== 'consumed' || !prev.consumed_attendance_id) {
        return { revertedAbsenceId: null };
      }
      await sql`
        UPDATE attendance SET status = 'absent', notes = NULL, updated_at = NOW()
         WHERE id = ${prev.consumed_attendance_id}::uuid AND status = 'excused'`.execute(trx);
      return { revertedAbsenceId: prev.consumed_attendance_id };
    });
  }

  async deleteAttendanceRow(tenantId: string, attendanceId: string): Promise<void> {
    await this.db(tenantId).deleteFrom('attendance')
      .where('id', '=', sql<string>`${attendanceId}::uuid`)
      .execute();
  }

  /** بيانات الغياب + حصته — للإشعار بعد ما يتعذر */
  async findAbsenceContext(tenantId: string, attendanceId: string): Promise<{
    studentId: string; studentName: string; parentPhone: string | null; sessionId: string;
  } | null> {
    const row = await this.db(tenantId).selectFrom('attendance')
      .innerJoin('students', 'students.id', 'attendance.student_id')
      .select(['attendance.student_id', 'attendance.session_id', 'students.full_name', 'students.parent_phone'])
      .where('attendance.id', '=', sql<string>`${attendanceId}::uuid`)
      .executeTakeFirst();
    if (!row) return null;
    return {
      studentId: row.student_id as string,
      studentName: (row as any).full_name,
      parentPhone: (row as any).parent_phone ?? null,
      sessionId: row.session_id as string,
    };
  }
}

class CreditConsumeAborted extends Error {}
