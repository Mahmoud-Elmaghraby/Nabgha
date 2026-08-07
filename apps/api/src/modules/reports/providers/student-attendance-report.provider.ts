import { Injectable, OnModuleInit } from '@nestjs/common';
import { ReportRegistryService } from '../report-registry.service';
import { StudentUseCase } from '../../students/application/use-cases/student.usecase';
import { ExcelExportService } from '../../../shared/infrastructure/export/excel-export.service';
import { PdfExportService } from '../../../shared/infrastructure/export/pdf-export.service';
import { AppError } from '../../../core/errors/app.error';
import { CompositeReportOptions, ExportColumn } from '../../../shared/infrastructure/export/export.types';
import { compositeToPreviewData } from '../utils/format-preview-rows';
import { ReportPreviewData } from '../report.types';

const STATUS_LABELS: Record<string, string> = {
  present: 'حاضر',
  absent: 'غائب',
  excused: 'غياب بعذر',
};

const ATTENDANCE_COLUMNS: ExportColumn<any>[] = [
  { key: 'startDate', header: 'التاريخ', width: 15, format: (v) => v ? new Date(v).toLocaleDateString('en-GB') : '-' },
  { key: 'groupName', header: 'المجموعة', width: 20, format: (v) => v ?? '-' },
  { key: 'subjectName', header: 'المادة', width: 18, format: (v) => v ?? '-' },
  { key: 'sessionTitle', header: 'عنوان الحصة', width: 22, format: (v) => v ?? '-' },
  { key: 'status', header: 'الحالة', width: 14, format: (v) => STATUS_LABELS[v] ?? v },
];

@Injectable()
export class StudentAttendanceReportProvider implements OnModuleInit {
  constructor(
    private readonly registry: ReportRegistryService,
    private readonly studentUseCase: StudentUseCase,
    private readonly excelExport: ExcelExportService,
    private readonly pdfExport: PdfExportService,
  ) {}

  private async buildReportOptions(tenantId: string, params: Record<string, any>): Promise<CompositeReportOptions> {
    if (!params.studentId) {
      throw new AppError('VALIDATION_ERROR', 'رقم الطالب (studentId) مطلوب', 400);
    }

    const student = await this.studentUseCase.getById(tenantId, params.studentId);
    const history = await this.studentUseCase.getAttendance(tenantId, params.studentId);

    const rows = history.map((r: any) => ({
      startDate: r.startDate,
      groupName: r.groupName,
      subjectName: r.subjectName,
      sessionTitle: r.sessionTitle,
      status: r.status,
    }));

    const totalSessions = history.length;
    const presentCount = history.filter((r: any) => r.status === 'present').length;
    const absentCount = history.filter((r: any) => r.status === 'absent').length;
    const excusedCount = history.filter((r: any) => r.status === 'excused').length;

    return {
      title: 'كشف حضور طالب',
      subtitle: `${student.fullName} — ${student.studentCode ?? ''}`,
      summary: [
        { label: 'إجمالي الحصص', value: totalSessions },
        { label: 'حاضر', value: presentCount },
        { label: 'غائب', value: absentCount },
        { label: 'غياب بعذر', value: excusedCount },
      ],
      sections: [
        { title: 'سجل الحضور', columns: ATTENDANCE_COLUMNS, rows },
      ],
    };
  }

  onModuleInit(): void {
    this.registry.register({
      key: 'student-attendance',
      title: 'كشف حضور طالب',
      description: 'سجل الحضور والغياب الكامل لطالب معيّن',
      category: 'students',

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
