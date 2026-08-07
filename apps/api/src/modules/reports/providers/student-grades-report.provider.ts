import { Injectable, OnModuleInit } from '@nestjs/common';
import { ReportRegistryService } from '../report-registry.service';
import { StudentUseCase } from '../../students/application/use-cases/student.usecase';
import { ExcelExportService } from '../../../shared/infrastructure/export/excel-export.service';
import { PdfExportService } from '../../../shared/infrastructure/export/pdf-export.service';
import { AppError } from '../../../core/errors/app.error';
import { CompositeReportOptions, ExportColumn } from '../../../shared/infrastructure/export/export.types';
import { compositeToPreviewData } from '../utils/format-preview-rows';
import { ReportPreviewData } from '../report.types';

const GRADES_COLUMNS: ExportColumn<any>[] = [
  { key: 'startDate', header: 'التاريخ', width: 15, format: (v) => v ? new Date(v).toLocaleDateString('en-GB') : '-' },
  { key: 'groupName', header: 'المجموعة', width: 20, format: (v) => v ?? '-' },
  { key: 'subjectName', header: 'المادة', width: 18, format: (v) => v ?? '-' },
  { key: 'sessionTitle', header: 'عنوان الامتحان', width: 22, format: (v) => v ?? '-' },
  { key: 'degree', header: 'الدرجة', width: 12 },
  { key: 'outOf', header: 'من', width: 10 },
  { key: 'percentage', header: 'النسبة', width: 12, format: (v) => `${v}%` },
];

@Injectable()
export class StudentGradesReportProvider implements OnModuleInit {
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

    // بس الحصص اللي فيها درجة مسجّلة فعلياً — بغض النظر عن نوع الحصة نفسه
    const gradedHistory = history.filter((r: any) => r.degree !== null && r.outOf !== null && r.outOf > 0);

    const rows = gradedHistory.map((r: any) => ({
      startDate: r.startDate,
      groupName: r.groupName,
      subjectName: r.subjectName,
      sessionTitle: r.sessionTitle,
      degree: r.degree,
      outOf: r.outOf,
      percentage: Math.round((r.degree / r.outOf) * 100),
    }));

    const totalExams = rows.length;
    const avgPercentage = totalExams > 0
      ? Math.round(rows.reduce((sum, r) => sum + r.percentage, 0) / totalExams)
      : 0;

    return {
      title: 'كشف درجات طالب',
      subtitle: `${student.fullName} — ${student.studentCode ?? ''}`,
      summary: [
        { label: 'عدد الامتحانات', value: totalExams },
        { label: 'متوسط النسبة', value: `${avgPercentage}%` },
      ],
      sections: [
        { title: 'الدرجات', columns: GRADES_COLUMNS, rows },
      ],
    };
  }

  onModuleInit(): void {
    this.registry.register({
      key: 'student-grades',
      title: 'كشف درجات طالب',
      description: 'نتائج الامتحانات والتسميع المسجّلة لطالب معيّن',
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
