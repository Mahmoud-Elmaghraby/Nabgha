import { Injectable, OnModuleInit } from '@nestjs/common';
import { sql } from 'kysely';
import { ReportRegistryService } from '../report-registry.service';
import { KyselyService } from '../../../shared/infrastructure/database/kysely.service';
import { ExcelExportService } from '../../../shared/infrastructure/export/excel-export.service';
import { PdfExportService } from '../../../shared/infrastructure/export/pdf-export.service';
import { AppError } from '../../../core/errors/app.error';
import { CompositeReportOptions, ExportColumn } from '../../../shared/infrastructure/export/export.types';
import { compositeToPreviewData } from '../utils/format-preview-rows';
import { ReportPreviewData } from '../report.types';

const RESULT_COLUMNS: ExportColumn<any>[] = [
  { key: 'rank', header: 'الترتيب', width: 10 },
  { key: 'studentCode', header: 'الكود', width: 12 },
  { key: 'fullName', header: 'اسم الطالب', width: 22 },
  { key: 'degree', header: 'الدرجة', width: 10 },
  { key: 'outOf', header: 'من', width: 8 },
  { key: 'percentage', header: 'النسبة', width: 12, format: (v) => `${v}%` },
  { key: 'resultLabel', header: 'النتيجة', width: 12 },
];

@Injectable()
export class ExamResultReportProvider implements OnModuleInit {
  constructor(
    private readonly registry: ReportRegistryService,
    private readonly kysely: KyselyService,
    private readonly excelExport: ExcelExportService,
    private readonly pdfExport: PdfExportService,
  ) {}

  private async buildReportOptions(tenantId: string, params: Record<string, any>): Promise<CompositeReportOptions> {
    if (!params.sessionId) throw new AppError('VALIDATION_ERROR', 'يجب اختيار الامتحان', 400);
    const passThreshold = params.passThreshold ? Number(params.passThreshold) : 50;

    const db = this.kysely.getTenantDb(tenantId);

    const session = await db.selectFrom('sessions')
      .leftJoin('groups', 'groups.id', 'sessions.group_id')
      .select(['sessions.id', 'sessions.title', 'sessions.start_date', 'sessions.out_of', 'groups.name as group_name'])
      .where('sessions.id', '=', sql<string>`${params.sessionId}::uuid`)
      .executeTakeFirst();

    if (!session) throw new AppError('NOT_FOUND', 'الامتحان غير موجود', 404);

    const outOf = Number(session.out_of ?? 0);

    const rows = await db.selectFrom('attendance')
      .innerJoin('students', 'students.id', 'attendance.student_id')
      .select(['students.student_code', 'students.full_name', 'attendance.degree'])
      .where('attendance.session_id', '=', sql<string>`${params.sessionId}::uuid`)
      .where('attendance.degree', 'is not', null)
      .execute();

    const ranked = rows
      .map((r) => ({
        studentCode: r.student_code,
        fullName: r.full_name,
        degree: Number(r.degree),
        outOf,
        percentage: outOf > 0 ? Math.round((Number(r.degree) / outOf) * 100) : 0,
      }))
      .sort((a, b) => b.degree - a.degree)
      .map((r, i) => ({
        ...r,
        rank: i + 1,
        resultLabel: r.percentage >= passThreshold ? 'ناجح' : 'راسب',
      }));

    const totalStudents = ranked.length;
    const average = totalStudents > 0 ? Math.round(ranked.reduce((s, r) => s + r.percentage, 0) / totalStudents) : 0;
    const highest = totalStudents > 0 ? ranked[0].percentage : 0;
    const lowest = totalStudents > 0 ? ranked[totalStudents - 1].percentage : 0;
    const passCount = ranked.filter((r) => r.resultLabel === 'ناجح').length;
    const failCount = totalStudents - passCount;
    const dateLabel = new Date(session.start_date as any).toLocaleDateString('ar-EG');

    return {
      title: 'نتيجة امتحان',
      subtitle: `${session.title} — ${session.group_name ?? ''} — ${dateLabel}`,
      summary: [
        { label: 'عدد الطلاب', value: totalStudents },
        { label: 'المتوسط', value: `${average}%` },
        { label: 'أعلى نسبة', value: `${highest}%` },
        { label: 'أقل نسبة', value: `${lowest}%` },
        { label: 'ناجح', value: passCount },
        { label: 'راسب', value: failCount },
      ],
      sections: [{ title: 'النتائج مرتّبة', columns: RESULT_COLUMNS, rows: ranked }],
    };
  }

  onModuleInit(): void {
    this.registry.register({
      key: 'exam-result',
      title: 'نتيجة امتحان',
      description: 'ترتيب الطلاب في امتحان معيّن مع إحصائيات النجاح والرسوب',
      category: 'exams',
      getPreviewData: async (tenantId, params): Promise<ReportPreviewData> => {
        const reportOptions = await this.buildReportOptions(tenantId, params);
        return compositeToPreviewData(reportOptions);
      },
      generate: async (tenantId, params, format) => {
        const reportOptions = await this.buildReportOptions(tenantId, params);
        return format === 'xlsx'
          ? this.excelExport.generateReport(reportOptions)
          : this.pdfExport.generateReport(reportOptions);
      },
    });
  }
}
