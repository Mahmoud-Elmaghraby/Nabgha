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

const STATUS_SYMBOLS: Record<string, string> = {
  present: 'ح',
  absent: 'غ',
  late: 'ت',
  excused: 'ع',
};

const SUMMARY_COLUMNS: ExportColumn<any>[] = [
  { key: 'studentCode', header: 'الكود', width: 12 },
  { key: 'fullName', header: 'اسم الطالب', width: 22 },
  { key: 'presentCount', header: 'حاضر', width: 10 },
  { key: 'absentCount', header: 'غائب', width: 10 },
  { key: 'lateCount', header: 'متأخر', width: 10 },
  { key: 'excusedCount', header: 'معذور', width: 10 },
  { key: 'attendanceRate', header: 'نسبة الحضور', width: 14, format: (v) => v === null ? '-' : `${v}%` },
];

@Injectable()
export class GroupAttendanceReportProvider implements OnModuleInit {
  constructor(
    private readonly registry: ReportRegistryService,
    private readonly kysely: KyselyService,
    private readonly excelExport: ExcelExportService,
    private readonly pdfExport: PdfExportService,
  ) {}

  private async buildReportOptions(tenantId: string, params: Record<string, any>): Promise<CompositeReportOptions> {
    if (!params.groupId) {
      throw new AppError('VALIDATION_ERROR', 'يجب اختيار مجموعة', 400);
    }
    if (!params.startDate || !params.endDate) {
      throw new AppError('VALIDATION_ERROR', 'تاريخ البداية والنهاية مطلوبان', 400);
    }

    const db = this.kysely.getTenantDb(tenantId);

    const groupRow = await db.selectFrom('groups')
      .select('name')
      .where('id', '=', sql<string>`${params.groupId}::uuid`)
      .executeTakeFirst();

    const sessions = await db.selectFrom('sessions')
      .select(['id', 'title', 'start_date'])
      .where('group_id', '=', sql<string>`${params.groupId}::uuid`)
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
        .select(['session_id', 'student_id', 'status'])
        .where('session_id', 'in', sessionIds as any)
        .execute();
    }

    const attMap = new Map<string, Map<string, string>>();
    for (const r of attendanceRows) {
      const sid = r.student_id as string;
      if (!attMap.has(sid)) attMap.set(sid, new Map());
      attMap.get(sid)!.set(r.session_id as string, r.status as string);
    }

    // ─── قسم 1: ملخص لكل طالب (صف واحد، بغض النظر عن عدد الحصص) ───
    const summaryRows = students.map((st) => {
      const studentRecords = attMap.get(st.id as string);
      let present = 0, absent = 0, late = 0, excused = 0;
      if (studentRecords) {
        for (const status of studentRecords.values()) {
          if (status === 'present') present++;
          else if (status === 'absent') absent++;
          else if (status === 'late') late++;
          else if (status === 'excused') excused++;
        }
      }
      const recordedCount = present + absent + late + excused;
      const attendanceRate = recordedCount > 0 ? Math.round((present / recordedCount) * 100) : null;

      return {
        studentCode: st.student_code,
        fullName: st.full_name,
        presentCount: present,
        absentCount: absent,
        lateCount: late,
        excusedCount: excused,
        attendanceRate,
      };
    });

    // ─── قسم 2: المصفوفة التفصيلية (طالب × حصة) ───
    const matrixColumns: ExportColumn<any>[] = [
      { key: 'studentCode', header: 'الكود', width: 12 },
      { key: 'fullName', header: 'اسم الطالب', width: 22 },
      ...sessions.map((s) => ({
        key: `s_${s.id}`,
        header: new Date(s.start_date as any).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }),
        width: 8,
      })),
    ];

    const matrixRows = students.map((st) => {
      const row: Record<string, any> = {
        studentCode: st.student_code,
        fullName: st.full_name,
      };
      for (const s of sessions) {
        const status = attMap.get(st.id as string)?.get(s.id as string);
        row[`s_${s.id}`] = status ? (STATUS_SYMBOLS[status] ?? status) : '-';
      }
      return row;
    });

    return {
      title: 'تقرير حضور مجموعة',
      subtitle: `${groupRow?.name ?? ''} — عدد الحصص: ${sessions.length} — عدد الطلاب: ${students.length}`,
      sections: [
        { title: 'ملخص الحضور', columns: SUMMARY_COLUMNS, rows: summaryRows },
        { title: 'التفاصيل اليومية', columns: matrixColumns, rows: matrixRows },
      ],
    };
  }

  onModuleInit(): void {
    this.registry.register({
      key: 'group-attendance-matrix',
      title: 'تقرير حضور مجموعة',
      description: 'ملخص سريع لكل طالب (حاضر/غائب/نسبة الحضور)، مع تفاصيل يومية كاملة لكل حصة',
      category: 'sessions',

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
