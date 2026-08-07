import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { KyselyService } from '../../shared/infrastructure/database/kysely.service';

export interface ParentOtpRow {
  id: string;
  phone: string;
  code_hash: string;
  attempts: number;
  consumed_at: Date | null;
  expires_at: Date;
  created_at: Date;
}

export interface ParentStudentRow {
  id: string;
  full_name: string;
  grade: string | null;
  student_code: string | null;
}

@Injectable()
export class ParentPortalRepository {
  constructor(private readonly kysely: KyselyService) {}

  /** الطلاب المرتبطين برقم هاتف ولي الأمر (بعد التوحيد) داخل مستأجر معيّن */
  async findStudentsByParentPhone(tenantId: string, normalizedPhone: string): Promise<ParentStudentRow[]> {
    const db = this.kysely.getTenantDb(tenantId);
    const rows = await db
      .selectFrom('students')
      .select(['id', 'full_name', 'grade', 'student_code'])
      .where('parent_phone', '=', normalizedPhone)
      .where('is_active', '=', true)
      .where('deleted_at', 'is', null)
      .execute();
    return rows as ParentStudentRow[];
  }

  /** الطلاب حسب مجموعة IDs (مستخدمة بعد التحقق من الـ JWT، مش بالرقم مباشرة) */
  async findStudentsByIds(tenantId: string, studentIds: string[]): Promise<ParentStudentRow[]> {
    if (studentIds.length === 0) return [];
    const db = this.kysely.getTenantDb(tenantId);
    const rows = await db
      .selectFrom('students')
      .select(['id', 'full_name', 'grade', 'student_code'])
      .where('id', 'in', studentIds)
      .where('deleted_at', 'is', null)
      .execute();
    return rows as ParentStudentRow[];
  }

  /** آخر كود OTP لرقم هاتف معيّن (لأغراض الـ cooldown والتحقق) */
  async findLatestOtp(tenantId: string, normalizedPhone: string): Promise<ParentOtpRow | undefined> {
    const db = this.kysely.getTenantDb(tenantId);
    const row = await db
      .selectFrom('parent_otp_codes')
      .selectAll()
      .where('phone', '=', normalizedPhone)
      .orderBy('created_at', 'desc')
      .limit(1)
      .executeTakeFirst();
    return row as ParentOtpRow | undefined;
  }

  async createOtp(
    tenantId: string,
    normalizedPhone: string,
    codeHash: string,
    expiresAt: Date,
  ): Promise<ParentOtpRow> {
    const db = this.kysely.getTenantDb(tenantId);
    const row = await db
      .insertInto('parent_otp_codes')
      .values({
        phone: normalizedPhone,
        code_hash: codeHash,
        expires_at: expiresAt,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as ParentOtpRow;
  }

  /** الحصص القادمة (مجدولة/جارية) للمجموعات اللي الطالب مقيّد فيها فعليًا (left_at is null) */
  async findUpcomingSessionsForStudent(tenantId: string, studentId: string, limit = 15) {
    const db = this.kysely.getTenantDb(tenantId);
    const rows = await db
      .selectFrom('sessions')
      .innerJoin('group_students', 'group_students.group_id', 'sessions.group_id')
      .leftJoin('groups', 'groups.id', 'sessions.group_id')
      .leftJoin('subjects', 'subjects.id', 'sessions.subject_id')
      .select([
        'sessions.id',
        'sessions.title',
        'sessions.type',
        'sessions.start_date',
        'sessions.start_time',
        'sessions.end_time',
        'sessions.status',
        'groups.name as group_name',
        'subjects.name as subject_name',
      ])
      .where('group_students.student_id', '=', studentId)
      .where('group_students.left_at', 'is', null)
      .where('sessions.deleted_at', 'is', null)
      .where('sessions.status', 'in', ['scheduled', 'ongoing'])
      .orderBy('sessions.start_date', 'asc')
      .limit(limit)
      .execute();
    return rows;
  }

  async incrementAttempts(tenantId: string, otpId: string): Promise<void> {
    const db = this.kysely.getTenantDb(tenantId);
    await db
      .updateTable('parent_otp_codes')
      .set({ attempts: sql`attempts + 1` })
      .where('id', '=', otpId)
      .execute();
  }

  async consumeOtp(tenantId: string, otpId: string): Promise<void> {
    const db = this.kysely.getTenantDb(tenantId);
    await db
      .updateTable('parent_otp_codes')
      .set({ consumed_at: new Date() })
      .where('id', '=', otpId)
      .execute();
  }
}
