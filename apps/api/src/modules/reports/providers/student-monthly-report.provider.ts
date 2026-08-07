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
  { key: 'sessionTitle', header: 'عنوان الحصة', width: 22, format: (v) => v ?? '-' },
  { key: 'status', header: 'الحالة', width: 14, format: (v) => STATUS_LABELS[v] ?? v },
];

const GRADES_COLUMNS: ExportColumn<any>[] = [
  { key: 'startDate', header: 'التاريخ', width: 15, format: (v) => v ? new Date(v).toLocaleDateString('en-GB') : '-' },
  { key: 'sessionTitle', header: 'عنوان الامتحان', width: 22, format: (v) => v ?? '-' },
  { key: 'degree', header: 'الدرجة', width: 10 },
  { key: 'outOf', header: 'من', width: 10 },
  { key: 'percentage', header: 'النسبة', width: 12, format: (v) => `${v}%` },
];

function getMonthRange(monthStr: string): { start: Date; end: Date } {
  const [year, month] = monthStr.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);
  return { start, end };
}

function getPreviousMonth(monthStr: string): string {
  const [year, month] = monthStr.split('-').map(Number);
  const d = new Date(year, month - 2, 1); // month-1 هو الشهر الحالي (0-indexed)، فـ month-2 هو السابق
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function average(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 10) / 10;
}

@Injectable()
export class StudentMonthlyReportProvider implements OnModuleInit {
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
    const month: string = params.month || new Date().toISOString().slice(0, 7); // 'YYYY-MM'

    const student = await this.studentUseCase.getById(tenantId, params.studentId);
    const fullHistory = await this.studentUseCase.getAttendance(tenantId, params.studentId);

    const { start, end } = getMonthRange(month);
    const thisMonthHistory = fullHistory.filter((r: any) => {
      const d = new Date(r.startDate);
      return d >= start && d <= end;
    });

    const attendanceRows = thisMonthHistory.map((r: any) => ({
      startDate: r.startDate,
      groupName: r.groupName,
      sessionTitle: r.sessionTitle,
      status: r.status,
    }));

    const gradedThisMonth = thisMonthHistory.filter((r: any) => r.degree !== null && r.outOf > 0);
    const gradeRows = gradedThisMonth.map((r: any) => ({
      startDate: r.startDate,
      sessionTitle: r.sessionTitle,
      degree: r.degree,
      outOf: r.outOf,
      percentage: Math.round((r.degree / r.outOf) * 100),
    }));

    const totalSessions = thisMonthHistory.length;
    const presentCount = thisMonthHistory.filter((r: any) => r.status === 'present').length;
    const absentCount = thisMonthHistory.filter((r: any) => r.status === 'absent').length;
    const excusedCount = thisMonthHistory.filter((r: any) => r.status === 'excused').length;

    const attendanceScore = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : null;
    const thisMonthAvgGrade = average(gradeRows.map(r => r.percentage));

    // مقارنة بالشهر السابق (لو فيه بيانات درجات كافية)
    const prevMonth = getPreviousMonth(month);
    const { start: prevStart, end: prevEnd } = getMonthRange(prevMonth);
    const prevMonthGraded = fullHistory.filter((r: any) => {
      const d = new Date(r.startDate);
      return d >= prevStart && d <= prevEnd && r.degree !== null && r.outOf > 0;
    });
    const prevMonthAvgGrade = average(
      prevMonthGraded.map((r: any) => Math.round((r.degree / r.outOf) * 100))
    );

    let gradeScore: number | null = thisMonthAvgGrade;
    let trendLabel = '';
    if (thisMonthAvgGrade !== null && prevMonthAvgGrade !== null) {
      const diff = thisMonthAvgGrade - prevMonthAvgGrade;
      gradeScore = Math.max(0, Math.min(100, Math.round(50 + diff)));
      trendLabel = diff > 2 ? ' (تحسّن عن الشهر السابق)' : diff < -2 ? ' (تراجع عن الشهر السابق)' : ' (مستقر عن الشهر السابق)';
    }

    const validScores = [attendanceScore, gradeScore].filter((s): s is number => s !== null);
    const overallIndex = validScores.length > 0 ? Math.round(average(validScores)!) : null;

    const monthLabel = new Date(start).toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });

    return {
      title: 'التقرير الشهري',
      subtitle: `${student.fullName} — ${student.studentCode ?? ''} — ${monthLabel}`,
      summary: [
        { label: 'إجمالي الحصص', value: totalSessions },
        { label: 'حاضر', value: presentCount },
        { label: 'غائب', value: absentCount },
        { label: 'غياب بعذر', value: excusedCount },
        { label: 'نسبة الحضور', value: attendanceScore !== null ? `${attendanceScore}%` : '-' },
        { label: 'متوسط الدرجات', value: thisMonthAvgGrade !== null ? `${thisMonthAvgGrade}%` : '-' },
        { label: 'مؤشر الأداء العام (استرشادي)', value: overallIndex !== null ? `${overallIndex}%${trendLabel}` : 'لا توجد بيانات كافية' },
      ],
      sections: [
        { title: 'سجل الحضور هذا الشهر', columns: ATTENDANCE_COLUMNS, rows: attendanceRows },
        { title: 'الدرجات هذا الشهر', columns: GRADES_COLUMNS, rows: gradeRows },
      ],
    };
  }

  onModuleInit(): void {
    this.registry.register({
      key: 'student-monthly-report',
      title: 'التقرير الشهري لولي الأمر',
      description: 'ملخص شامل شهري: حضور، غياب، درجات، ومؤشر أداء عام',
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
