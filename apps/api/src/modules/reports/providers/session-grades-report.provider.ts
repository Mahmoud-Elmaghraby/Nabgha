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

const GRADES_COLUMNS: ExportColumn<any>[] = [
  { key: 'studentCode', header: 'الكود',        width: 14 },
  { key: 'studentName', header: 'اسم الطالب',   width: 28 },
  { key: 'degree',      header: 'الدرجة',        width: 14 },
];

@Injectable()
export class SessionGradesReportProvider implements OnModuleInit {
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

    // جلب بيانات الحصة (بما فيها "من كام درجة") لعرضها في عنوان التقرير وتنسيق عمود الدرجة
    const session = await db.selectFrom('sessions')
      .leftJoin('groups', 'groups.id', 'sessions.group_id')
      .select(['sessions.title', 'sessions.start_date', 'sessions.out_of', 'groups.name as group_name'])
      .where('sessions.id', '=', sql<string>`${params.sessionId}::uuid`)
      .where('sessions.deleted_at', 'is', null)
      .executeTakeFirst();

    if (!session) {
      throw new AppError('NOT_FOUND', 'الحصة غير موجودة', 404);
    }

    const outOf = Number(session.out_of ?? 0);

    let query = db.selectFrom('attendance')
      .innerJoin('students', 'students.id', 'attendance.student_id')
      .select([
        'students.student_code',
        'students.full_name',
        'attendance.degree',
      ])
      .where('attendance.session_id', '=', sql<string>`${params.sessionId}::uuid`)
      .where('students.deleted_at', 'is', null);

    // فلترة الحالة — لو مفيش status يرجع الكل (نفس منطق كشف الحضور)
    if (params.status && params.status !== 'all') {
      query = query.where('attendance.status', '=', params.status);
    }

    const rows = await query.orderBy('students.full_name', 'asc').execute();

    // الترتيب حسب الدرجة — الأعلى درجة أولاً، واللي لسه من غير درجة (null) في الآخر
    // بمقارنة صريحة (null مقابل null) عشان مانحسبش الدرجة الفاضية كأنها صفر
    const sorted = [...rows].sort((a: any, b: any) => {
      const da = a.degree !== null ? Number(a.degree) : null;
      const dbv = b.degree !== null ? Number(b.degree) : null;
      if (da !== null && dbv === null) return -1;
      if (da === null && dbv !== null) return 1;
      if (da !== null && dbv !== null) return dbv - da;
      return 0;
    });

    const reportRows = sorted.map((r: any) => ({
      studentCode: r.student_code,
      studentName: r.full_name,
      degree: r.degree !== null
        ? `${Number(r.degree)}${outOf ? ` / ${outOf}` : ''}`
        : '—',
    }));

    const date  = session.start_date
      ? new Date(session.start_date).toLocaleDateString('ar-EG')
      : '';
    const group = (session.group_name as string | null) ?? '';
    const title = `كشف درجات — ${session.title}`;
    const subtitle = [group, date].filter(Boolean).join(' — ');

    return { reportRows, title, subtitle };
  }

  onModuleInit(): void {
    this.registry.register({
      key: 'session-grades',
      title: 'كشف درجات حصة',
      description: 'كشف بأسماء الطلاب ودرجاتهم في حصة معينة (قابل للفلترة)',
      category: 'sessions',

      getPreviewData: async (tenantId, params): Promise<ReportPreviewData> => {
        const { reportRows, title, subtitle } = await this.buildRows(tenantId, params);
        return {
          title,
          subtitle,
          sections: [{
            title: 'الدرجات',
            columns: toPreviewColumns(GRADES_COLUMNS),
            rows: formatRowsForPreview(reportRows, GRADES_COLUMNS),
          }],
        };
      },

      generate: async (tenantId, params, format) => {
        const { reportRows, title, subtitle } = await this.buildRows(tenantId, params);
        const options = { title, subtitle };
        return format === 'xlsx'
          ? this.excelExport.generate(reportRows, GRADES_COLUMNS, options)
          : this.pdfExport.generate(reportRows, GRADES_COLUMNS, options);
      },
    });
  }
}
