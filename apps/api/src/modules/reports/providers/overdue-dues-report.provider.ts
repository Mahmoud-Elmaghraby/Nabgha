import { Injectable, OnModuleInit } from '@nestjs/common';
import { sql } from 'kysely';
import { KyselyService } from '../../../shared/infrastructure/database/kysely.service';
import { ReportRegistryService } from '../report-registry.service';
import { ExcelExportService } from '../../../shared/infrastructure/export/excel-export.service';
import { PdfExportService } from '../../../shared/infrastructure/export/pdf-export.service';
import { CompositeReportOptions, ExportColumn } from '../../../shared/infrastructure/export/export.types';
import { compositeToPreviewData } from '../utils/format-preview-rows';
import { ReportPreviewData } from '../report.types';

const STUDENT_SUMMARY_COLUMNS: ExportColumn<any>[] = [
  { key: 'studentCode', header: 'الكود', width: 12 },
  { key: 'fullName', header: 'اسم الطالب', width: 22 },
  { key: 'parentPhone', header: 'هاتف ولي الأمر', width: 16 },
  { key: 'oldestMonth', header: 'أقدم شهر متأخر', width: 14 },
  { key: 'overdueMonthsCount', header: 'عدد الفواتير', width: 12 },
  { key: 'totalRemaining', header: 'إجمالي المتبقي', width: 14 },
];

const AGING_COLUMNS: ExportColumn<any>[] = [
  { key: 'bucket', header: 'مدة التأخر', width: 18 },
  { key: 'invoicesCount', header: 'عدد الفواتير', width: 14 },
  { key: 'totalAmount', header: 'إجمالي المبلغ', width: 14 },
];

const DETAIL_COLUMNS: ExportColumn<any>[] = [
  { key: 'studentCode', header: 'الكود', width: 12 },
  { key: 'fullName', header: 'اسم الطالب', width: 22 },
  { key: 'month', header: 'الشهر', width: 10 },
  { key: 'monthsOverdue', header: 'مدة التأخر (بالشهور)', width: 14 },
  { key: 'subjectName', header: 'المادة', width: 16, format: (v) => v ?? '-' },
  { key: 'gradeName', header: 'الصف', width: 14, format: (v) => v ?? '-' },
  { key: 'remainingAmount', header: 'المتبقي', width: 12 },
  { key: 'status', header: 'الحالة', width: 12 },
];

function monthDiff(fromMonth: string, toMonth: string): number {
  const [fy, fm] = fromMonth.split('-').map(Number);
  const [ty, tm] = toMonth.split('-').map(Number);
  return (ty * 12 + tm) - (fy * 12 + fm);
}

function agingBucket(months: number): string {
  if (months <= 1) return 'شهر واحد';
  if (months <= 3) return 'شهرين - 3 شهور';
  return 'أكثر من 3 شهور';
}

@Injectable()
export class OverdueDuesReportProvider implements OnModuleInit {
  constructor(
    private readonly registry: ReportRegistryService,
    private readonly kysely: KyselyService,
    private readonly excelExport: ExcelExportService,
    private readonly pdfExport: PdfExportService,
  ) {}

  private async buildReportOptions(tenantId: string, params: Record<string, any>): Promise<CompositeReportOptions> {
    const toMonth: string = params.toMonth || new Date().toISOString().slice(0, 7);
    const db = this.kysely.getTenantDb(tenantId);

    let query = db.selectFrom('monthly_dues')
      .innerJoin('students', 'students.id', 'monthly_dues.student_id')
      .leftJoin('subject_grades', 'subject_grades.id', 'monthly_dues.subject_grade_id')
      .leftJoin('subjects', 'subjects.id', 'subject_grades.subject_id')
      .select([
        'students.id as student_id', 'students.full_name', 'students.student_code', 'students.parent_phone',
        'monthly_dues.month', 'monthly_dues.due_amount', 'monthly_dues.discount_applied',
        'monthly_dues.paid_amount', 'monthly_dues.status',
        'subjects.name as subject_name', 'subject_grades.grade as grade_name',
      ])
      .where('monthly_dues.status', 'in', ['unpaid', 'partial'])
      .where('monthly_dues.month', '<', toMonth)
      .where('students.deleted_at', 'is', null);

    if (params.fromMonth) {
      query = query.where('monthly_dues.month', '>=', params.fromMonth);
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

    const rows = await query
      .orderBy('monthly_dues.month', 'asc')
      .orderBy('students.full_name', 'asc')
      .execute();

    const detailRows = rows.map((r) => {
      const remaining = Math.max(0, Number(r.due_amount) - Number(r.discount_applied) - Number(r.paid_amount));
      const months = monthDiff(r.month as string, toMonth);
      return {
        studentId: r.student_id as string,
        studentCode: r.student_code ?? '',
        fullName: r.full_name,
        parentPhone: r.parent_phone ?? '',
        month: r.month,
        monthsOverdue: months,
        subjectName: r.subject_name,
        gradeName: r.grade_name,
        remainingAmount: remaining,
        status: r.status === 'partial' ? 'مدفوعة جزئياً' : 'غير مدفوعة',
      };
    });

    // ─── ملخص حسب الطالب (مرتّب من الأكتر مديونية للأقل) ───
    const byStudent = new Map<string, {
      studentCode: string; fullName: string; parentPhone: string;
      count: number; total: number; oldestMonth: string;
    }>();
    for (const row of detailRows) {
      if (!byStudent.has(row.studentId)) {
        byStudent.set(row.studentId, {
          studentCode: row.studentCode, fullName: row.fullName, parentPhone: row.parentPhone,
          count: 0, total: 0, oldestMonth: row.month,
        });
      }
      const entry = byStudent.get(row.studentId)!;
      entry.count += 1;
      entry.total += row.remainingAmount;
      if (row.month < entry.oldestMonth) entry.oldestMonth = row.month;
    }

    const summaryRows = Array.from(byStudent.values())
      .map((s) => ({
        studentCode: s.studentCode,
        fullName: s.fullName,
        parentPhone: s.parentPhone,
        oldestMonth: s.oldestMonth,
        overdueMonthsCount: s.count,
        totalRemaining: s.total,
      }))
      .sort((a, b) => b.totalRemaining - a.totalRemaining);

    // ─── توزيع حسب مدة التأخر (Aging Buckets) ───
    const bucketMap = new Map<string, { count: number; total: number }>();
    for (const row of detailRows) {
      const bucket = agingBucket(row.monthsOverdue);
      if (!bucketMap.has(bucket)) bucketMap.set(bucket, { count: 0, total: 0 });
      const entry = bucketMap.get(bucket)!;
      entry.count += 1;
      entry.total += row.remainingAmount;
    }
    const bucketOrder = ['شهر واحد', 'شهرين - 3 شهور', 'أكثر من 3 شهور'];
    const agingRows = bucketOrder
      .filter((b) => bucketMap.has(b))
      .map((b) => ({
        bucket: b,
        invoicesCount: bucketMap.get(b)!.count,
        totalAmount: bucketMap.get(b)!.total,
      }));

    const grandTotal = summaryRows.reduce((sum, s) => sum + s.totalRemaining, 0);
    const avgMonthsOverdue = detailRows.length > 0
      ? Math.round((detailRows.reduce((sum, r) => sum + r.monthsOverdue, 0) / detailRows.length) * 10) / 10
      : 0;

    return {
      title: 'تقرير المستحقات المتأخرة',
      subtitle: `حتى شهر ${toMonth}${params.fromMonth ? ` — من شهر ${params.fromMonth}` : ''} — عدد الطلاب المتأخرين: ${summaryRows.length}`,
      summary: [
        { label: 'عدد الطلاب المتأخرين', value: summaryRows.length },
        { label: 'إجمالي المبلغ المتأخر', value: grandTotal },
        { label: 'متوسط مدة التأخر (شهور)', value: avgMonthsOverdue },
      ],
      sections: [
        { title: 'توزيع حسب مدة التأخر', columns: AGING_COLUMNS, rows: agingRows },
        { title: 'ملخص حسب الطالب (مرتّب حسب الأعلى مديونية)', columns: STUDENT_SUMMARY_COLUMNS, rows: summaryRows },
        { title: 'تفاصيل الفواتير المتأخرة', columns: DETAIL_COLUMNS, rows: detailRows },
      ],
    };
  }

  onModuleInit(): void {
    this.registry.register({
      key: 'overdue-dues',
      title: 'المستحقات المتأخرة',
      description: 'تحليل الفواتير المتأخرة مع توزيع حسب مدة التأخر (Aging Report)',
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
