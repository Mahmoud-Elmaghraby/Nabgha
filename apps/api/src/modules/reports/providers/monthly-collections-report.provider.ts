import { Injectable, OnModuleInit } from '@nestjs/common';
import { sql } from 'kysely';
import { KyselyService } from '../../../shared/infrastructure/database/kysely.service';
import { ReportRegistryService } from '../report-registry.service';
import { ExcelExportService } from '../../../shared/infrastructure/export/excel-export.service';
import { PdfExportService } from '../../../shared/infrastructure/export/pdf-export.service';
import { CompositeReportOptions, ExportColumn } from '../../../shared/infrastructure/export/export.types';
import { compositeToPreviewData } from '../utils/format-preview-rows';
import { ReportPreviewData } from '../report.types';

const METHOD_LABELS: Record<string, string> = {
  cash: 'نقدي',
  visa: 'فيزا',
  instapay: 'إنستاباي',
  vodafone: 'فودافون كاش',
  bank: 'تحويل بنكي',
  other: 'أخرى',
};

const METHOD_BREAKDOWN_COLUMNS: ExportColumn<any>[] = [
  { key: 'methodLabel', header: 'طريقة الدفع', width: 18 },
  { key: 'count', header: 'عدد الإيصالات', width: 14 },
  { key: 'total', header: 'إجمالي المبلغ', width: 14 },
];

const DETAIL_COLUMNS: ExportColumn<any>[] = [
  { key: 'paidAt', header: 'التاريخ', width: 14, format: (v) => v ? new Date(v).toLocaleDateString('en-GB') : '-' },
  { key: 'receiptNumber', header: 'رقم الإيصال', width: 12 },
  { key: 'studentCode', header: 'الكود', width: 12 },
  { key: 'fullName', header: 'اسم الطالب', width: 22 },
  { key: 'amount', header: 'المبلغ', width: 12 },
  { key: 'methodLabel', header: 'طريقة الدفع', width: 14 },
  { key: 'treasuryName', header: 'الخزينة', width: 16, format: (v) => v ?? '-' },
];

@Injectable()
export class MonthlyCollectionsReportProvider implements OnModuleInit {
  constructor(
    private readonly registry: ReportRegistryService,
    private readonly kysely: KyselyService,
    private readonly excelExport: ExcelExportService,
    private readonly pdfExport: PdfExportService,
  ) {}

  private async buildReportOptions(tenantId: string, params: Record<string, any>): Promise<CompositeReportOptions> {
    const db = this.kysely.getTenantDb(tenantId);

    let query = db.selectFrom('payments')
      .innerJoin('students', 'students.id', 'payments.student_id')
      .leftJoin('monthly_dues', 'monthly_dues.id', 'payments.monthly_due_id')
      .leftJoin('subject_grades', 'subject_grades.id', 'monthly_dues.subject_grade_id')
      .leftJoin('treasuries', 'treasuries.id', 'payments.treasury_id')
      .select([
        'payments.id', 'payments.receipt_number', 'payments.amount', 'payments.payment_method',
        'payments.paid_at', 'students.full_name', 'students.student_code',
        'treasuries.name as treasury_name', 'monthly_dues.subject_grade_id',
        'students.id as student_id',
      ])
      .where('payments.status', '=', 'completed');

    if (params.from) {
      query = query.where('payments.paid_at', '>=', new Date(params.from));
    }
    if (params.to) {
      query = query.where('payments.paid_at', '<=', new Date(`${params.to}T23:59:59.999Z`));
    }
    if (params.subjectId) {
      query = query.where('subject_grades.subject_id', '=', sql<string>`${params.subjectId}::uuid`);
    }
    if (params.groupId) {
      const group = await db.selectFrom('groups')
        .select('subject_grade_id')
        .where('id', '=', sql<string>`${params.groupId}::uuid`)
        .executeTakeFirst();
      if (group?.subject_grade_id) {
        query = query
          .where('monthly_dues.subject_grade_id', '=', group.subject_grade_id as any)
          .where(({ exists, selectFrom }) => exists(
            selectFrom('group_students')
              .select('id')
              .whereRef('group_students.student_id', '=', 'students.id')
              .where('group_students.group_id', '=', sql<string>`${params.groupId}::uuid`)
              .where('group_students.left_at', 'is', null),
          ));
      }
    }

    const rows = await query.orderBy('payments.paid_at', 'desc').execute();

    const detailRows = rows.map((r) => ({
      paidAt: r.paid_at,
      receiptNumber: r.receipt_number,
      studentCode: r.student_code,
      fullName: r.full_name,
      amount: Number(r.amount),
      methodLabel: METHOD_LABELS[r.payment_method as string] ?? r.payment_method,
      treasuryName: r.treasury_name,
    }));

    // ─── توزيع حسب طريقة الدفع ───
    const methodMap = new Map<string, { count: number; total: number }>();
    for (const row of detailRows) {
      if (!methodMap.has(row.methodLabel)) methodMap.set(row.methodLabel, { count: 0, total: 0 });
      const entry = methodMap.get(row.methodLabel)!;
      entry.count += 1;
      entry.total += row.amount;
    }
    const methodBreakdownRows = Array.from(methodMap.entries())
      .map(([methodLabel, v]) => ({ methodLabel, count: v.count, total: v.total }))
      .sort((a, b) => b.total - a.total);

    const grandTotal = detailRows.reduce((sum, r) => sum + r.amount, 0);
    const avgReceipt = detailRows.length > 0 ? Math.round(grandTotal / detailRows.length) : 0;

    const periodLabel = params.from && params.to
      ? `من ${params.from} إلى ${params.to}`
      : params.to ? `حتى ${params.to}` : 'كل الفترات';

    return {
      title: 'تقرير التحصيل',
      subtitle: `${periodLabel} — عدد الإيصالات: ${detailRows.length}`,
      summary: [
        { label: 'إجمالي المحصّل', value: grandTotal },
        { label: 'عدد الإيصالات', value: detailRows.length },
        { label: 'متوسط قيمة الإيصال', value: avgReceipt },
      ],
      sections: [
        { title: 'توزيع حسب طريقة الدفع', columns: METHOD_BREAKDOWN_COLUMNS, rows: methodBreakdownRows },
        { title: 'تفاصيل الإيصالات', columns: DETAIL_COLUMNS, rows: detailRows },
      ],
    };
  }

  onModuleInit(): void {
    this.registry.register({
      key: 'monthly-collections',
      title: 'تقرير التحصيل',
      description: 'كل المدفوعات المحصّلة فعلياً خلال فترة معينة، مع توزيع حسب طريقة الدفع',
      category: 'finance',

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
