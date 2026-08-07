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
import { TenantCapabilitiesService } from '../../../shared/infrastructure/tenant-capabilities/tenant-capabilities.service';

const TYPE_LABELS: Record<string, string> = {
  lesson: 'حصة عادية',
  lesson_revision: 'حصة + تسميع',
  lesson_exam: 'حصة + امتحان',
  exam: 'امتحان',
  grade_exam: 'امتحان مرحلة',
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'مجدولة',
  ongoing: 'جارية',
  completed: 'مكتملة',
  cancelled: 'ملغاة',
};

const SESSIONS_LIST_COLUMNS: ExportColumn<any>[] = [
  { key: 'startDate', header: 'التاريخ', width: 14, format: (v) => v ? new Date(v).toLocaleDateString('en-GB') : '-' },
  { key: 'title', header: 'العنوان', width: 22 },
  { key: 'typeLabel', header: 'النوع', width: 15 },
  { key: 'groupOrGrade', header: 'المجموعة/المرحلة', width: 20 },
  { key: 'subjectName', header: 'المادة', width: 16, format: (v) => v ?? '-' },
  { key: 'teacherName', header: 'المدرس', width: 16, format: (v) => v ?? '-' },
  { key: 'statusLabel', header: 'الحالة', width: 12 },
  { key: 'presentCount', header: 'حاضر', width: 8 },
  { key: 'absentCount', header: 'غائب', width: 8 },
  { key: 'lateCount', header: 'متأخر', width: 8 },
];

@Injectable()
export class SessionsListReportProvider implements OnModuleInit {
  constructor(
    private readonly registry: ReportRegistryService,
    private readonly kysely: KyselyService,
    private readonly excelExport: ExcelExportService,
    private readonly pdfExport: PdfExportService,
    private readonly capabilities: TenantCapabilitiesService,
  ) {}

  /** الأعمدة الظاهرة في المعاينة الحية بس — بتخفي المادة/المدرس لو مفيش تنوع فعلي يستاهل عرضه */
  private async getPreviewColumns(tenantId: string): Promise<ExportColumn<any>[]> {
    const caps = await this.capabilities.getCapabilities(tenantId);
    return SESSIONS_LIST_COLUMNS.filter((col) => {
      if (col.key === 'subjectName' && !caps.hasMultipleSubjects) return false;
      if (col.key === 'teacherName' && !caps.hasMultipleTeachers) return false;
      return true;
    });
  }

  private async buildRows(tenantId: string, params: Record<string, any>) {
    if (!params.startDate || !params.endDate) {
      throw new AppError('VALIDATION_ERROR', 'تاريخ البداية والنهاية مطلوبان', 400);
    }

    const db = this.kysely.getTenantDb(tenantId);

    let query = db.selectFrom('sessions')
      .leftJoin('groups', 'groups.id', 'sessions.group_id')
      .leftJoin('subject_grades', 'subject_grades.id', 'groups.subject_grade_id')
      .leftJoin('subjects as group_subjects', 'group_subjects.id', 'subject_grades.subject_id')
      .leftJoin('subjects as direct_subjects', 'direct_subjects.id', 'sessions.subject_id')
      .leftJoin('teachers', 'teachers.id', 'groups.teacher_id')
      .select([
        'sessions.id', 'sessions.type', 'sessions.title', 'sessions.grade',
        'sessions.status', 'sessions.start_date',
        'groups.name as group_name',
        'direct_subjects.name as direct_subject_name',
        'group_subjects.name as group_subject_name',
        'teachers.name as teacher_name',
      ])
      .where('sessions.deleted_at', 'is', null)
      .where('sessions.start_date', '>=', new Date(params.startDate))
      .where('sessions.start_date', '<=', new Date(params.endDate));

    if (params.groupId) {
      query = query.where('sessions.group_id', '=', sql<string>`${params.groupId}::uuid`);
    }
    if (params.type) {
      query = query.where('sessions.type', '=', params.type);
    }
    if (params.status) {
      query = query.where('sessions.status', '=', params.status);
    }

    const sessions = await query.orderBy('sessions.start_date', 'desc').execute();

    const sessionIds = sessions.map((s) => s.id as string);
    const countsMap = new Map<string, { present: number; absent: number; late: number }>();

    if (sessionIds.length > 0) {
      const countRows = await db.selectFrom('attendance')
        .select(['session_id', 'status', db.fn.countAll<number>().as('cnt')])
        .where('session_id', 'in', sessionIds as any)
        .groupBy(['session_id', 'status'])
        .execute();

      for (const row of countRows) {
        const sid = row.session_id as string;
        if (!countsMap.has(sid)) countsMap.set(sid, { present: 0, absent: 0, late: 0 });
        const entry = countsMap.get(sid)!;
        const status = row.status as string;
        const cnt = Number(row.cnt);
        if (status === 'present') entry.present = cnt;
        else if (status === 'absent') entry.absent = cnt;
        else if (status === 'late') entry.late = cnt;
      }
    }

    return sessions.map((s) => {
      const counts = countsMap.get(s.id as string) ?? { present: 0, absent: 0, late: 0 };
      return {
        startDate: s.start_date,
        title: s.title,
        typeLabel: TYPE_LABELS[s.type as string] ?? s.type,
        groupOrGrade: (s.group_name as string) ?? (s.grade as string) ?? '-',
        subjectName: (s.direct_subject_name as string | null) ?? (s.group_subject_name as string | null),
        teacherName: s.teacher_name,
        statusLabel: STATUS_LABELS[s.status as string] ?? s.status,
        presentCount: counts.present,
        absentCount: counts.absent,
        lateCount: counts.late,
      };
    });
  }

  onModuleInit(): void {
    this.registry.register({
      key: 'sessions-list',
      title: 'قائمة الحصص',
      description: 'كل الحصص والامتحانات في فترة معينة، مع ملخص الحضور لكل حصة',
      category: 'sessions',

      getPreviewData: async (tenantId, params): Promise<ReportPreviewData> => {
        const rows = await this.buildRows(tenantId, params);
        const previewColumns = await this.getPreviewColumns(tenantId);
        return {
          title: 'قائمة الحصص',
          sections: [{
            title: 'الحصص',
            columns: toPreviewColumns(previewColumns),
            rows: formatRowsForPreview(rows, previewColumns),
          }],
        };
      },

      generate: async (tenantId, params, format) => {
        const rows = await this.buildRows(tenantId, params);
        const options = { title: 'قائمة الحصص' };
        return format === 'xlsx'
          ? this.excelExport.generate(rows, SESSIONS_LIST_COLUMNS, options)
          : this.pdfExport.generate(rows, SESSIONS_LIST_COLUMNS, options);
      },
    });
  }
}
