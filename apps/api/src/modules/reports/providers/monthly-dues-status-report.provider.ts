import { Injectable, OnModuleInit } from '@nestjs/common';
import { sql } from 'kysely';
import { KyselyService } from '../../../shared/infrastructure/database/kysely.service';
import { ReportRegistryService } from '../report-registry.service';
import { ExcelExportService } from '../../../shared/infrastructure/export/excel-export.service';
import { PdfExportService } from '../../../shared/infrastructure/export/pdf-export.service';
import { CompositeReportOptions, ExportColumn } from '../../../shared/infrastructure/export/export.types';
import { compositeToPreviewData } from '../utils/format-preview-rows';
import { ReportPreviewData } from '../report.types';

// تقرير مبسّط: 3 حالات بس. المعفى بيتحسب "دفع" تلقائيًا (مفيش داعي نميّزه)،
// والملغاة (طالب منسحب/مجموعة اتلغت) مستبعدة دايمًا من التقرير من غير أي خيار إظهار.
const STATUS_LABELS: Record<string, string> = {
  paid: 'دفع',
  partial: 'دفع جزئي',
  unpaid: 'لم يدفع',
};

// ترتيب العرض: اللي لسه محتاج متابعة (لم يدفع/جزئي) يظهر الأول، بعدين اللي دفعوا
const STATUS_ORDER: Record<string, number> = {
  unpaid: 0,
  partial: 1,
  paid: 2,
};

const STATUS_BREAKDOWN_COLUMNS: ExportColumn<any>[] = [
  { key: 'statusLabel', header: 'الحالة', width: 16 },
  { key: 'count', header: 'عدد الطلاب', width: 12 },
  { key: 'totalDue', header: 'إجمالي المستحق', width: 14 },
  { key: 'totalRemaining', header: 'إجمالي المتبقي', width: 14 },
];

const DETAIL_COLUMNS: ExportColumn<any>[] = [
  { key: 'studentCode', header: 'الكود', width: 12 },
  { key: 'fullName', header: 'اسم الطالب', width: 22 },
  { key: 'parentPhone', header: 'هاتف ولي الأمر', width: 16 },
  { key: 'subjectName', header: 'المادة', width: 16, format: (v) => v ?? '-' },
  { key: 'gradeName', header: 'الصف', width: 14, format: (v) => v ?? '-' },
  { key: 'dueAmount', header: 'المستحق', width: 12 },
  { key: 'discountApplied', header: 'الخصم', width: 10 },
  { key: 'paidAmount', header: 'المدفوع', width: 12 },
  { key: 'remainingAmount', header: 'المتبقي', width: 12 },
  { key: 'status', header: 'الحالة', width: 14 },
  { key: 'lastPaidAt', header: 'تاريخ آخر دفعة', width: 14, format: (v) => v ? new Date(v).toLocaleDateString('en-GB') : '-' },
  { key: 'receiptNumber', header: 'رقم الإيصال', width: 12, format: (v) => v ?? '-' },
];

@Injectable()
export class MonthlyDuesStatusReportProvider implements OnModuleInit {
  constructor(
    private readonly registry: ReportRegistryService,
    private readonly kysely: KyselyService,
    private readonly excelExport: ExcelExportService,
    private readonly pdfExport: PdfExportService,
  ) {}

  private async buildReportOptions(tenantId: string, params: Record<string, any>): Promise<CompositeReportOptions> {
    const month: string = params.month || new Date().toISOString().slice(0, 7);
    const db = this.kysely.getTenantDb(tenantId);

    // الملغاة مستبعدة دايمًا. نجيب 'waived' من قاعدة البيانات زي ما هي وبعدين نحوّلها
    // لـ 'paid' وقت العرض (المعفى بيتحسب دافع) — تبسيط مقصود بناءً على طلب المستخدم.
    const statuses = ['unpaid', 'partial', 'paid', 'waived'];

    let query = db.selectFrom('monthly_dues')
      .innerJoin('students', 'students.id', 'monthly_dues.student_id')
      .leftJoin('subject_grades', 'subject_grades.id', 'monthly_dues.subject_grade_id')
      .leftJoin('subjects', 'subjects.id', 'subject_grades.subject_id')
      .select([
        'monthly_dues.id as due_id',
        'students.id as student_id', 'students.full_name', 'students.student_code', 'students.parent_phone',
        'monthly_dues.due_amount', 'monthly_dues.discount_applied', 'monthly_dues.paid_amount', 'monthly_dues.status',
        'subjects.name as subject_name', 'subject_grades.grade as grade_name',
      ])
      .where('monthly_dues.month', '=', month)
      .where('monthly_dues.status', 'in', statuses)
      .where('students.deleted_at', 'is', null);

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
      .orderBy('students.full_name', 'asc')
      .execute();

    // ─── آخر دفعة فعلية مسجّلة لكل مستحق (لو اتدفع) — نجيبها بالمرة عشان نعرض تاريخها ورقم إيصالها ───
    const dueIds = rows.map((r) => r.due_id as string);
    const lastPayments = dueIds.length > 0
      ? await db.selectFrom('payments')
          .select(['monthly_due_id', 'paid_at', 'receipt_number'])
          .where('status', '=', 'paid')
          .where('monthly_due_id', 'in', dueIds)
          .distinctOn('monthly_due_id')
          .orderBy('monthly_due_id')
          .orderBy('paid_at', 'desc')
          .execute()
      : [];
    const lastPaymentMap = new Map(lastPayments.map((p) => [p.monthly_due_id as string, p]));

    const detailRows = rows
      .map((r) => {
        const remaining = Math.max(0, Number(r.due_amount) - Number(r.discount_applied) - Number(r.paid_amount));
        const lastPayment = lastPaymentMap.get(r.due_id as string);
        // المعفى (waived) بيتحسب "دفع" في التقرير المبسّط ده
        const effectiveStatus = r.status === 'waived' ? 'paid' : (r.status as string);
        return {
          studentId: r.student_id as string,
          studentCode: r.student_code ?? '',
          fullName: r.full_name,
          parentPhone: r.parent_phone ?? '',
          subjectName: r.subject_name,
          gradeName: r.grade_name,
          dueAmount: Number(r.due_amount),
          discountApplied: Number(r.discount_applied),
          paidAmount: Number(r.paid_amount),
          remainingAmount: remaining,
          status: STATUS_LABELS[effectiveStatus] ?? effectiveStatus,
          statusKey: effectiveStatus,
          lastPaidAt: lastPayment?.paid_at ?? null,
          receiptNumber: lastPayment?.receipt_number ?? null,
        };
      })
      .sort((a, b) =>
        (STATUS_ORDER[a.statusKey] ?? 99) - (STATUS_ORDER[b.statusKey] ?? 99) ||
        a.fullName.localeCompare(b.fullName, 'ar'));

    // ─── توزيع حسب الحالة ───
    const statusMap = new Map<string, { count: number; totalDue: number; totalRemaining: number }>();
    for (const row of detailRows) {
      if (!statusMap.has(row.statusKey)) statusMap.set(row.statusKey, { count: 0, totalDue: 0, totalRemaining: 0 });
      const entry = statusMap.get(row.statusKey)!;
      entry.count += 1;
      entry.totalDue += row.dueAmount;
      entry.totalRemaining += row.remainingAmount;
    }
    const statusBreakdownRows = ['unpaid', 'partial', 'paid']
      .filter((k) => statusMap.has(k))
      .map((k) => ({
        statusLabel: STATUS_LABELS[k],
        count: statusMap.get(k)!.count,
        totalDue: statusMap.get(k)!.totalDue,
        totalRemaining: statusMap.get(k)!.totalRemaining,
      }));

    const totalStudents = detailRows.length;
    const paidCount = statusMap.get('paid')?.count ?? 0;
    const partialCount = statusMap.get('partial')?.count ?? 0;
    const unpaidCount = statusMap.get('unpaid')?.count ?? 0;
    const totalRemaining = detailRows.reduce((sum, r) => sum + r.remainingAmount, 0);

    return {
      title: 'تقرير مستحقات الشهر',
      subtitle: `شهر ${month} — عدد الطلاب: ${totalStudents} (دفعوا: ${paidCount}، جزئي: ${partialCount}، لم يدفعوا: ${unpaidCount})`,
      summary: [
        { label: 'إجمالي الطلاب', value: totalStudents },
        { label: 'دفعوا', value: paidCount },
        { label: 'دفعوا جزء', value: partialCount },
        { label: 'لم يدفعوا', value: unpaidCount },
        { label: 'إجمالي المتبقي', value: totalRemaining },
      ],
      sections: [
        { title: 'توزيع حسب الحالة', columns: STATUS_BREAKDOWN_COLUMNS, rows: statusBreakdownRows },
        { title: 'تفاصيل الطلاب', columns: DETAIL_COLUMNS, rows: detailRows },
      ],
    };
  }

  onModuleInit(): void {
    this.registry.register({
      key: 'monthly-dues-status',
      title: 'مستحقات الشهر',
      description: 'حالة سداد كل الطلاب لشهر مستحق محدد — مين دفع، مين دفع جزء، ومين لسه ما دفعش',
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
