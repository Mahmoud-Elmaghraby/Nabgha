import { Injectable, OnModuleInit } from '@nestjs/common';
import { sql } from 'kysely';
import { ReportRegistryService } from '../report-registry.service';
import { KyselyService } from '../../../shared/infrastructure/database/kysely.service';
import { ExcelExportService } from '../../../shared/infrastructure/export/excel-export.service';
import { PdfExportService } from '../../../shared/infrastructure/export/pdf-export.service';
import { AppError } from '../../../core/errors/app.error';
import { ExportColumn } from '../../../shared/infrastructure/export/export.types';
import { formatRowsForPreview, toPreviewColumns } from '../utils/format-preview-rows';
import { ReportPreviewData } from '../report.types';

const STATUS_LABELS: Record<string, string> = {
  present: 'حاضر',
  absent:  'غائب',
  late:    'متأخر',
  excused: 'معذور',
};

const ATTENDANCE_COLUMNS: ExportColumn<any>[] = [
  { key: 'studentCode', header: 'الكود',              width: 14 },
  { key: 'studentName', header: 'اسم الطالب',         width: 28 },
  { key: 'statusLabel', header: 'الحالة',              width: 12 },
  { key: 'scannedAt',   header: 'وقت الحضور',         width: 16,
    format: (v) => v ? new Date(v).toLocaleTimeString('ar-EG') : '—' },
  { key: 'parentPhone', header: 'هاتف ولي الأمر',     width: 18,
    format: (v) => v ?? '—' },
];

@Injectable()
export class SessionAttendanceReportProvider implements OnModuleInit {
  constructor(
    private readonly registry: ReportRegistryService,
    private readonly kysely: KyselyService,
    private readonly excelExport: ExcelExportService,
    private readonly pdfExport: PdfExportService,
  ) {}

  private async buildRows(tenantId: string, params: Record<string, any>) {
    if (!params.sessionId) {
      throw new AppError('VALIDATION_ERROR', 'معرّف الحصة مطلوب', 400);
    }

    const db = this.kysely.getTenantDb(tenantId);

    // جلب بيانات الحصة لعرضها في عنوان التقرير
    const session = await db.selectFrom('sessions')
      .leftJoin('groups', 'groups.id', 'sessions.group_id')
      .select(['sessions.title', 'sessions.start_date', 'groups.name as group_name'])
      .where('sessions.id', '=', sql<string>`${params.sessionId}::uuid`)
      .where('sessions.deleted_at', 'is', null)
      .executeTakeFirst();

    if (!session) {
      throw new AppError('NOT_FOUND', 'الحصة غير موجودة', 404);
    }

    let query = db.selectFrom('attendance')
      .innerJoin('students', 'students.id', 'attendance.student_id')
      .select([
        'students.student_code',
        'students.full_name',
        'students.parent_phone',
        'attendance.status',
        'attendance.scanned_at',
      ])
      .where('attendance.session_id', '=', sql<string>`${params.sessionId}::uuid`)
      .where('students.deleted_at', 'is', null);

    // فلترة الحالة — لو مفيش status يرجع الكل
    if (params.status && params.status !== 'all') {
      query = query.where('attendance.status', '=', params.status);
    }

    const rows = await query.orderBy('students.full_name', 'asc').execute();

    const reportRows = rows.map((r: any) => ({
      studentCode: r.student_code,
      studentName: r.full_name,
      statusLabel: STATUS_LABELS[r.status] ?? r.status,
      scannedAt:   r.scanned_at,
      parentPhone: r.parent_phone,
    }));

    const date  = session.start_date
      ? new Date(session.start_date).toLocaleDateString('ar-EG')
      : '';
    const group = (session.group_name as string | null) ?? '';
    const title = `كشف حضور — ${session.title}`;
    const subtitle = [group, date].filter(Boolean).join(' — ');

    return { reportRows, title, subtitle };
  }

  onModuleInit(): void {
    this.registry.register({
      key: 'session-attendance',
      title: 'كشف حضور حصة',
      description: 'كشف بأسماء الطلاب وحالة حضورهم في حصة معينة (قابل للفلترة)',
      category: 'sessions',

      getPreviewData: async (tenantId, params): Promise<ReportPreviewData> => {
        const { reportRows, title, subtitle } = await this.buildRows(tenantId, params);
        return {
          title,
          subtitle,
          sections: [{
            title: 'الحضور',
            columns: toPreviewColumns(ATTENDANCE_COLUMNS),
            rows: formatRowsForPreview(reportRows, ATTENDANCE_COLUMNS),
          }],
        };
      },

      generate: async (tenantId, params, format) => {
        const { reportRows, title, subtitle } = await this.buildRows(tenantId, params);
        const options = { title, subtitle };
        return format === 'xlsx'
          ? this.excelExport.generate(reportRows, ATTENDANCE_COLUMNS, options)
          : this.pdfExport.generate(reportRows, ATTENDANCE_COLUMNS, options);
      },
    });
  }
}
