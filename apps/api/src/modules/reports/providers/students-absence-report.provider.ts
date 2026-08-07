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

const ABSENCE_COLUMNS: ExportColumn<any>[] = [
  { key: 'studentCode', header: 'الكود', width: 15 },
  { key: 'fullName', header: 'اسم الطالب', width: 25 },
  { key: 'parentPhone', header: 'هاتف ولي الأمر', width: 18 },
  { key: 'grade', header: 'الصف', width: 15, format: (v) => v ?? '-' },
  { key: 'absenceCount', header: 'عدد الغيابات', width: 15 },
];

@Injectable()
export class StudentsAbsenceReportProvider implements OnModuleInit {
  constructor(
    private readonly registry: ReportRegistryService,
    private readonly kysely: KyselyService,
    private readonly excelExport: ExcelExportService,
    private readonly pdfExport: PdfExportService,
  ) {}

  private async fetchAbsenceRows(tenantId: string, params: Record<string, any>) {
    if (!params.startDate || !params.endDate) {
      throw new AppError('VALIDATION_ERROR', 'تاريخ البداية والنهاية مطلوبان', 400);
    }
    const minAbsences = params.minAbsences ? Number(params.minAbsences) : 3;

    const db = this.kysely.getTenantDb(tenantId);
    let query = db
      .selectFrom('attendance')
      .innerJoin('sessions', 'sessions.id', 'attendance.session_id')
      .innerJoin('students', 'students.id', 'attendance.student_id')
      .select([
        'students.id as student_id',
        'students.student_code',
        'students.full_name',
        'students.parent_phone',
        'students.grade',
        db.fn.countAll<number>().as('absence_count'),
      ])
      .where('attendance.status', '=', 'absent')
      .where('sessions.start_date', '>=', new Date(params.startDate))
      .where('sessions.start_date', '<=', new Date(params.endDate))
      .where('sessions.deleted_at', 'is', null)
      .where('students.deleted_at', 'is', null);

    if (params.groupId) {
      query = query.where('sessions.group_id', '=', sql<string>`${params.groupId}::uuid`);
    }

    const rows = await query
      .groupBy(['students.id', 'students.student_code', 'students.full_name', 'students.parent_phone', 'students.grade'])
      .orderBy('absence_count', 'desc')
      .execute();

    const reportRows = rows
      .map((r: any) => ({
        studentCode: r.student_code,
        fullName: r.full_name,
        parentPhone: r.parent_phone,
        grade: r.grade,
        absenceCount: Number(r.absence_count),
      }))
      .filter((r) => r.absenceCount >= minAbsences);

    const options = {
      title: 'تقرير الغياب المتكرر',
      subtitle: `من ${params.startDate} إلى ${params.endDate} — حد أدنى ${minAbsences} غيابات`,
    };

    return { reportRows, options };
  }

  onModuleInit(): void {
    this.registry.register({
      key: 'students-repeated-absence',
      title: 'تقرير الغياب المتكرر',
      description: 'الطلاب الذين تجاوز عدد غياباتهم حداً معيناً خلال فترة زمنية',
      category: 'students',

      getPreviewData: async (tenantId, params): Promise<ReportPreviewData> => {
        const { reportRows, options } = await this.fetchAbsenceRows(tenantId, params);
        return {
          title: options.title,
          subtitle: options.subtitle,
          sections: [{
            title: 'الطلاب',
            columns: toPreviewColumns(ABSENCE_COLUMNS),
            rows: formatRowsForPreview(reportRows, ABSENCE_COLUMNS),
          }],
        };
      },

      generate: async (tenantId, params, format) => {
        const { reportRows, options } = await this.fetchAbsenceRows(tenantId, params);
        return format === 'xlsx'
          ? this.excelExport.generate(reportRows, ABSENCE_COLUMNS, options)
          : this.pdfExport.generate(reportRows, ABSENCE_COLUMNS, options);
      },
    });
  }
}
