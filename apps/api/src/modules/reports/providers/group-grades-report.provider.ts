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

const GRADED_TYPES = ['lesson_revision', 'lesson_exam', 'exam'];

const SUMMARY_COLUMNS: ExportColumn<any>[] = [
  { key: 'studentCode', header: 'الكود', width: 12 },
  { key: 'fullName', header: 'اسم الطالب', width: 22 },
  { key: 'examsCount', header: 'عدد الامتحانات', width: 14 },
  { key: 'averagePercentage', header: 'متوسط النسبة', width: 14, format: (v) => v === null ? '-' : `${v}%` },
];

@Injectable()
export class GroupGradesReportProvider implements OnModuleInit {
  constructor(
    private readonly registry: ReportRegistryService,
    private readonly kysely: KyselyService,
    private readonly excelExport: ExcelExportService,
    private readonly pdfExport: PdfExportService,
  ) {}

  private async buildReportOptions(tenantId: string, params: Record<string, any>): Promise<CompositeReportOptions> {
    if (!params.groupId) throw new AppError('VALIDATION_ERROR', 'يجب اختيار مجموعة', 400);
    if (!params.startDate || !params.endDate) throw new AppError('VALIDATION_ERROR', 'تاريخ البداية والنهاية مطلوبان', 400);

    const db = this.kysely.getTenantDb(tenantId);

    const groupRow = await db.selectFrom('groups')
      .select('name')
      .where('id', '=', sql<string>`${params.groupId}::uuid`)
      .executeTakeFirst();

    const sessions = await db.selectFrom('sessions')
      .select(['id', 'title', 'start_date', 'out_of'])
      .where('group_id', '=', sql<string>`${params.groupId}::uuid`)
      .where('type', 'in', GRADED_TYPES as any)
      .where('start_date', '>=', new Date(params.startDate))
      .where('start_date', '<=', new Date(params.endDate))
      .where('deleted_at', 'is', null)
      .orderBy('start_date', 'asc')
      .execute();

    const students = await db.selectFrom('group_students as gs')
      .innerJoin('students as s', 's.id', 'gs.student_id')
      .select(['s.id', 's.full_name', 's.student_code'])
      .where('gs.group_id', '=', sql<string>`${params.groupId}::uuid`)
      .where('gs.left_at', 'is', null)
      .where('s.deleted_at', 'is', null)
      .orderBy('s.full_name', 'asc')
      .execute();

    const sessionIds = sessions.map((s) => s.id as string);
    let attendanceRows: any[] = [];
    if (sessionIds.length > 0) {
      attendanceRows = await db.selectFrom('attendance')
        .select(['session_id', 'student_id', 'degree'])
        .where('session_id', 'in', sessionIds as any)
        .execute();
    }

    const gradeMap = new Map<string, Map<string, number | null>>();
    for (const r of attendanceRows) {
      const sid = r.student_id as string;
      if (!gradeMap.has(sid)) gradeMap.set(sid, new Map());
      gradeMap.get(sid)!.set(r.session_id as string, r.degree !== null ? Number(r.degree) : null);
    }
    const outOfMap = new Map<string, number>();
    for (const s of sessions) outOfMap.set(s.id as string, Number(s.out_of ?? 0));

    const summaryRows = students.map((st) => {
      const studentGrades = gradeMap.get(st.id as string);
      let sumPercentage = 0, count = 0;
      if (studentGrades) {
        for (const [sid, degree] of studentGrades.entries()) {
          const outOf = outOfMap.get(sid) ?? 0;
          if (degree !== null && outOf > 0) { sumPercentage += (degree / outOf) * 100; count++; }
        }
      }
      return {
        studentCode: st.student_code, fullName: st.full_name,
        examsCount: count,
        averagePercentage: count > 0 ? Math.round(sumPercentage / count) : null,
      };
    });

    const matrixColumns: ExportColumn<any>[] = [
      { key: 'studentCode', header: 'الكود', width: 12 },
      { key: 'fullName', header: 'اسم الطالب', width: 22 },
      ...sessions.map((s) => ({
        key: `s_${s.id}`,
        header: new Date(s.start_date as any).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }),
        width: 10,
      })),
    ];

    const matrixRows = students.map((st) => {
      const row: Record<string, any> = { studentCode: st.student_code, fullName: st.full_name };
      const studentGrades = gradeMap.get(st.id as string);
      for (const s of sessions) {
        const degree = studentGrades?.get(s.id as string);
        const outOf = outOfMap.get(s.id as string) ?? 0;
        row[`s_${s.id}`] = (degree !== null && degree !== undefined) ? `${degree}/${outOf}` : '-';
      }
      return row;
    });

    return {
      title: 'تقرير درجات مجموعة',
      subtitle: `${groupRow?.name ?? ''} — عدد الامتحانات: ${sessions.length} — عدد الطلاب: ${students.length}`,
      sections: [
        { title: 'ملخص الدرجات', columns: SUMMARY_COLUMNS, rows: summaryRows },
        { title: 'التفاصيل لكل امتحان', columns: matrixColumns, rows: matrixRows },
      ],
    };
  }

  onModuleInit(): void {
    this.registry.register({
      key: 'group-grades',
      title: 'درجات مجموعة',
      description: 'ملخص أداء كل طالب في الامتحانات والتسميعات، مع تفاصيل كل امتحان على حدة',
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
