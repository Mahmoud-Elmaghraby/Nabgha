import { Injectable, OnModuleInit } from '@nestjs/common';
import { sql } from 'kysely';
import { ReportRegistryService } from '../report-registry.service';
import { KyselyService } from '../../../shared/infrastructure/database/kysely.service';
import { PdfExportService, HonorBoardEntry } from '../../../shared/infrastructure/export/pdf-export.service';
import { AppError } from '../../../core/errors/app.error';

const GRADED_TYPES = ['lesson_revision', 'lesson_exam', 'exam'];

@Injectable()
export class HonorBoardReportProvider implements OnModuleInit {
  constructor(
    private readonly registry: ReportRegistryService,
    private readonly kysely: KyselyService,
    private readonly pdfExport: PdfExportService,
  ) {}

  private async buildEntries(tenantId: string, params: Record<string, any>): Promise<{ entries: HonorBoardEntry[]; subtitle: string }> {
    const mode = params.mode === 'period' ? 'period' : 'exam';
    const topCount = params.topCount ? Math.max(1, Number(params.topCount)) : 3;
    const db = this.kysely.getTenantDb(tenantId);

    if (mode === 'exam') {
      if (!params.sessionId) throw new AppError('VALIDATION_ERROR', 'يجب اختيار الامتحان', 400);

      const session = await db.selectFrom('sessions')
        .select(['title', 'start_date', 'out_of'])
        .where('id', '=', sql<string>`${params.sessionId}::uuid`)
        .executeTakeFirst();
      if (!session) throw new AppError('NOT_FOUND', 'الامتحان غير موجود', 404);

      const outOf = Number(session.out_of ?? 0);
      const rows = await db.selectFrom('attendance')
        .innerJoin('students', 'students.id', 'attendance.student_id')
        .select(['students.full_name', 'students.student_code', 'attendance.degree'])
        .where('attendance.session_id', '=', sql<string>`${params.sessionId}::uuid`)
        .where('attendance.degree', 'is not', null)
        .execute();

      const sorted = rows
        .map((r) => ({ studentName: r.full_name as string, studentCode: r.student_code as string, degree: Number(r.degree) }))
        .sort((a, b) => b.degree - a.degree)
        .slice(0, topCount);

      const entries: HonorBoardEntry[] = sorted.map((r, i) => ({
        rank: i + 1,
        studentName: r.studentName,
        studentCode: r.studentCode,
        scoreLabel: `${r.degree}/${outOf}`,
      }));

      const dateLabel = new Date(session.start_date as any).toLocaleDateString('ar-EG');
      return { entries, subtitle: `${session.title} — ${dateLabel}` };
    }

    // ─── mode === 'period': متوسط الأداء عبر عدة امتحانات ───
    if (!params.startDate || !params.endDate) throw new AppError('VALIDATION_ERROR', 'تاريخ البداية والنهاية مطلوبان', 400);

    let sessionsQuery = db.selectFrom('sessions')
      .select(['id', 'out_of'])
      .where('type', 'in', GRADED_TYPES as any)
      .where('start_date', '>=', new Date(params.startDate))
      .where('start_date', '<=', new Date(params.endDate))
      .where('deleted_at', 'is', null);

    if (params.groupId) sessionsQuery = sessionsQuery.where('group_id', '=', sql<string>`${params.groupId}::uuid`);
    if (params.grade) sessionsQuery = sessionsQuery.where('grade', '=', params.grade);
    if (params.subjectId) sessionsQuery = sessionsQuery.where('subject_id', '=', sql<string>`${params.subjectId}::uuid`);

    const sessions = await sessionsQuery.execute();
    const sessionIds = sessions.map((s) => s.id as string);
    const outOfMap = new Map<string, number>(sessions.map((s) => [s.id as string, Number(s.out_of ?? 0)]));

    if (sessionIds.length === 0) return { entries: [], subtitle: 'لا توجد امتحانات في الفترة المحددة' };

    const rows = await db.selectFrom('attendance')
      .innerJoin('students', 'students.id', 'attendance.student_id')
      .select(['students.id as student_id', 'students.full_name', 'students.student_code', 'attendance.session_id', 'attendance.degree'])
      .where('attendance.session_id', 'in', sessionIds as any)
      .where('attendance.degree', 'is not', null)
      .execute();

    const byStudent = new Map<string, { fullName: string; studentCode: string; sumPercentage: number; count: number }>();
    for (const r of rows) {
      const sid = r.student_id as string;
      const outOf = outOfMap.get(r.session_id as string) ?? 0;
      if (outOf <= 0) continue;
      const percentage = (Number(r.degree) / outOf) * 100;
      if (!byStudent.has(sid)) {
        byStudent.set(sid, { fullName: r.full_name as string, studentCode: r.student_code as string, sumPercentage: 0, count: 0 });
      }
      const entry = byStudent.get(sid)!;
      entry.sumPercentage += percentage;
      entry.count += 1;
    }

    const sorted = Array.from(byStudent.values())
      .map((s) => ({ ...s, average: Math.round(s.sumPercentage / s.count) }))
      .sort((a, b) => b.average - a.average)
      .slice(0, topCount);

    const entries: HonorBoardEntry[] = sorted.map((s, i) => ({
      rank: i + 1,
      studentName: s.fullName,
      studentCode: s.studentCode,
      scoreLabel: `${s.average}%`,
    }));

    return { entries, subtitle: `متوسط الأداء من ${params.startDate} إلى ${params.endDate}` };
  }

  onModuleInit(): void {
    this.registry.register({
      key: 'honor-board',
      title: 'لوحة الشرف',
      description: 'أفضل الطلاب في امتحان معيّن، أو بمتوسط الأداء عبر فترة معينة',
      category: 'exams',

      getPreviewData: async (tenantId, params) => {
        const { entries, subtitle } = await this.buildEntries(tenantId, params);
        return {
          title: 'لوحة الشرف',
          subtitle,
          sections: [{
            title: 'الأوائل',
            columns: [
              { key: 'rank', header: 'الترتيب' },
              { key: 'studentName', header: 'اسم الطالب' },
              { key: 'studentCode', header: 'الكود' },
              { key: 'scoreLabel', header: 'النتيجة' },
            ],
            rows: entries,
          }],
        };
      },

      generate: async (tenantId, params, format) => {
        if (format !== 'pdf') throw new AppError('VALIDATION_ERROR', 'لوحة الشرف متاحة كـ PDF فقط', 400);
        const { entries, subtitle } = await this.buildEntries(tenantId, params);
        return this.pdfExport.generateHonorBoard({ title: 'لوحة الشرف 🏆', subtitle, entries });
      },
    });
  }
}
