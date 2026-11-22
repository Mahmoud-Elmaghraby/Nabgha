import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { KyselyService } from '../../../../shared/infrastructure/database/kysely.service';
import type { ResolveAudienceDto } from '../dtos/wa.dto';

export interface AudienceStudent {
  studentId: string;
  studentName: string;
  studentCode: string;
  parentPhone: string | null;
  studentPhone: string | null;
}

@Injectable()
export class ResolveAudienceUseCase {
  constructor(private readonly kysely: KyselyService) {}

  async execute(tenantId: string, params: ResolveAudienceDto): Promise<{ data: AudienceStudent[]; total: number }> {
    const db = this.kysely.getTenantDb(tenantId);

    let studentIdFilter: string[] | null = null;

    if (params.type === 'group') {
      const rows = await db.selectFrom('group_students')
        .select('student_id')
        .where('group_id', '=', sql<string>`${params.groupId}::uuid`)
        .where('left_at', 'is', null)
        .execute();
      studentIdFilter = rows.map(r => r.student_id as string);
    } else if (params.type === 'subjectGrade') {
      const rows = await db.selectFrom('group_students')
        .innerJoin('groups', 'groups.id', 'group_students.group_id')
        .select('group_students.student_id')
        .where('groups.subject_grade_id', '=', sql<string>`${params.subjectGradeId}::uuid`)
        .where('group_students.left_at', 'is', null)
        .where('groups.deleted_at', 'is', null)
        .execute();
      studentIdFilter = [...new Set(rows.map(r => r.student_id as string))];
    } else if (params.type === 'teacher') {
      const rows = await db.selectFrom('group_students')
        .innerJoin('groups', 'groups.id', 'group_students.group_id')
        .select('group_students.student_id')
        .where('groups.teacher_id', '=', sql<string>`${params.teacherId}::uuid`)
        .where('group_students.left_at', 'is', null)
        .where('groups.deleted_at', 'is', null)
        .execute();
      studentIdFilter = [...new Set(rows.map(r => r.student_id as string))];
    } else if (params.type === 'students') {
      // قائمة معرفات صريحة (إرسال فردي لطالب واحد أو مجموعة محددة بالـ ID
      // مباشرة) — بدون أي استعلام إضافي، الفلترة النهائية (deleted_at/is_active)
      // بتتطبق تحت زي أي نوع تاني.
      studentIdFilter = params.studentIds ?? [];
    }

    // لو الفلتر رجّع مجموعة فاضية (مفيش طلاب في المجموعة/المادة/المدرس دي أصلاً)
    if (studentIdFilter !== null && studentIdFilter.length === 0) {
      return { data: [], total: 0 };
    }

    let query = db.selectFrom('students')
      .select(['id', 'full_name', 'student_code', 'parent_phone', 'student_phone'])
      .where('deleted_at', 'is', null)
      .where('is_active', '=', true);

    if (params.type === 'grade') {
      query = query.where('grade', '=', params.grade!);
    }
    if (studentIdFilter !== null) {
      query = query.where('id', 'in', studentIdFilter);
    }

    const rows = await query.execute();
    const data: AudienceStudent[] = rows.map(r => ({
      studentId: r.id as string,
      studentName: r.full_name as string,
      studentCode: r.student_code as string,
      parentPhone: (r.parent_phone as string) ?? null,
      studentPhone: (r.student_phone as string) ?? null,
    }));

    return { data, total: data.length };
  }
}
