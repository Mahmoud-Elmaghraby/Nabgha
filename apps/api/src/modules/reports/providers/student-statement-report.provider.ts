import { Injectable, OnModuleInit } from '@nestjs/common';
import { ReportRegistryService } from '../report-registry.service';
import { StudentUseCase } from '../../students/application/use-cases/student.usecase';
import { FinanceUseCase } from '../../finance/application/use-cases/finance.usecase';
import { ExcelExportService } from '../../../shared/infrastructure/export/excel-export.service';
import { PdfExportService } from '../../../shared/infrastructure/export/pdf-export.service';
import { AppError } from '../../../core/errors/app.error';
import { CompositeReportOptions, ExportColumn } from '../../../shared/infrastructure/export/export.types';
import { compositeToPreviewData } from '../utils/format-preview-rows';
import { ReportPreviewData } from '../report.types';

const DUES_COLUMNS: ExportColumn<any>[] = [
  { key: 'month', header: 'الشهر', width: 12 },
  { key: 'subjectName', header: 'المادة', width: 18, format: (v) => v ?? '-' },
  { key: 'gradeName', header: 'الصف', width: 15, format: (v) => v ?? '-' },
  { key: 'dueAmount', header: 'المستحق', width: 12 },
  { key: 'discountApplied', header: 'الخصم', width: 12 },
  { key: 'paidAmount', header: 'المدفوع', width: 12 },
  { key: 'remainingAmount', header: 'المتبقي', width: 12 },
  { key: 'status', header: 'الحالة', width: 12 },
];

const PAYMENTS_COLUMNS: ExportColumn<any>[] = [
  { key: 'paidAt', header: 'تاريخ الدفع', width: 15, format: (v) => v ? new Date(v).toLocaleDateString('en-GB') : '-' },
  { key: 'amount', header: 'المبلغ', width: 12 },
  { key: 'paymentMethod', header: 'طريقة الدفع', width: 15 },
  { key: 'treasuryName', header: 'الخزينة', width: 18, format: (v) => v ?? '-' },
  { key: 'receiptNumber', header: 'رقم الإيصال', width: 12 },
  { key: 'status', header: 'الحالة', width: 12 },
];

@Injectable()
export class StudentStatementReportProvider implements OnModuleInit {
  constructor(
    private readonly registry: ReportRegistryService,
    private readonly studentUseCase: StudentUseCase,
    private readonly financeUseCase: FinanceUseCase,
    private readonly excelExport: ExcelExportService,
    private readonly pdfExport: PdfExportService,
  ) {}

  private async buildReportOptions(tenantId: string, params: Record<string, any>): Promise<CompositeReportOptions> {
    if (!params.studentId) {
      throw new AppError('VALIDATION_ERROR', 'رقم الطالب (studentId) مطلوب', 400);
    }

    const student = await this.studentUseCase.getById(tenantId, params.studentId);
    const profile = await this.financeUseCase.getStudentFinancialProfile(tenantId, params.studentId);

    const dueRows = profile.dues.map((d: any) => ({
      month: d.month,
      subjectName: d.subjectName,
      gradeName: d.gradeName,
      dueAmount: d.dueAmount,
      discountApplied: d.discountApplied,
      paidAmount: d.paidAmount,
      remainingAmount: d.remainingAmount,
      status: d.status === 'paid' ? 'مدفوعة' : d.status === 'partial' ? 'مدفوعة جزئياً' : 'غير مدفوعة',
    }));

    const paymentRows = profile.payments.map((p: any) => ({
      paidAt: p.paidAt,
      amount: p.amount,
      paymentMethod: p.paymentMethod,
      treasuryName: p.treasuryName,
      receiptNumber: p.receiptNumber,
      status: p.status === 'paid' ? 'مكتملة' : p.status === 'cancelled' ? 'ملغاة' : p.status === 'refunded' ? 'مسترجعة' : p.status === 'partial_refund' ? 'مسترجعة جزئياً' : p.status,
    }));

    return {
      title: 'كشف حساب طالب',
      subtitle: `${student.fullName} — ${student.studentCode ?? ''}`,
      summary: [
        { label: 'إجمالي المستحق', value: profile.totalDues },
        { label: 'إجمالي المدفوع', value: profile.totalPaid },
        { label: 'المتبقي', value: profile.totalPending },
      ],
      sections: [
        { title: 'الفواتير الشهرية', columns: DUES_COLUMNS, rows: dueRows },
        { title: 'المدفوعات', columns: PAYMENTS_COLUMNS, rows: paymentRows },
      ],
    };
  }

  onModuleInit(): void {
    this.registry.register({
      key: 'student-statement',
      title: 'كشف حساب طالب',
      description: 'بيانات الطالب + كل المستحقات والمدفوعات + الرصيد الحالي',
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
