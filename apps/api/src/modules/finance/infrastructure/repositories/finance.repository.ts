import { Injectable } from '@nestjs/common';
import { KyselyService } from '../../../../shared/infrastructure/database/kysely.service';
import { sql, type Kysely } from 'kysely';
import type { TenantDatabase } from '@nabgha/db';
import {
  TreasuryEntity, TreasuryType,
  MonthlyDueEntity, DueStatus,
  PaymentEntity, PaymentMethod, PaymentStatus,
  PaymentTransactionEntity, TransactionType,
  ExpenseEntity, ExpenseCategory,
} from '../../domain/entities/finance.entity';
import type { IFinanceRepository } from '../../domain/repositories/finance.repository.interface';
import type { CreateTreasuryDto, ListDuesDto, ListPaymentsDto, ListExpensesDto } from '../../application/dtos/finance.dto';

@Injectable()
export class FinanceRepository implements IFinanceRepository {
  constructor(private readonly kysely: KyselyService) {}

  // ─── Mappers ──────────────────────────────────────────────
  private toTreasury(r: any): TreasuryEntity {
    return new TreasuryEntity(
      r.id, r.name, r.type, Number(r.balance),
      r.is_active, r.notes ?? null,
      r.created_at, r.updated_at, r.deleted_at ?? null,
    );
  }

  private toMonthlyDue(r: any): MonthlyDueEntity {
    return new MonthlyDueEntity(
      r.id, r.student_id, r.subject_grade_id, r.month,
      Number(r.due_amount), Number(r.discount_applied), Number(r.paid_amount),
      r.status as DueStatus, r.notes ?? null, r.created_by ?? null,
      r.created_at, r.updated_at,
      r.student_name, r.student_code, r.subject_name, r.grade_name,
    );
  }

  private toPayment(r: any): PaymentEntity {
    return new PaymentEntity(
      r.id, r.student_id, r.monthly_due_id, r.treasury_id,
      Number(r.amount), r.payment_method as PaymentMethod,
      Number(r.receipt_number), r.status as PaymentStatus,
      r.cancel_reason ?? null,
      r.refund_amount ? Number(r.refund_amount) : null,
      r.notes ?? null, r.created_by ?? null,
      r.paid_at, r.created_at, r.updated_at,
      r.student_name, r.student_code, r.subject_name, r.month, r.treasury_name,
      r.discount_applied != null ? Number(r.discount_applied) : undefined,
    );
  }

  private toTransaction(r: any): PaymentTransactionEntity {
    return new PaymentTransactionEntity(
      r.id, r.payment_id ?? null, r.treasury_id,
      r.type as TransactionType, Number(r.amount),
      Number(r.balance_before), Number(r.balance_after),
      r.notes ?? null, r.created_by ?? null, r.created_at,
      r.related_treasury_id ?? null,
      r.treasury_name ?? undefined, r.related_treasury_name ?? undefined,
    );
  }

  private toExpense(r: any): ExpenseEntity {
    return new ExpenseEntity(
      r.id, r.treasury_id, r.category as ExpenseCategory,
      r.title, Number(r.amount), r.expense_date,
      r.notes ?? null, r.created_by ?? null,
      r.created_at, r.updated_at, r.deleted_at ?? null, r.treasury_name,
    );
  }

  // ─── Payment Select Helper ────────────────────────────────
  private paymentSelect() {
    return [
      'payments.id', 'payments.student_id', 'payments.monthly_due_id', 'payments.treasury_id',
      'payments.amount', 'payments.payment_method', 'payments.receipt_number', 'payments.status',
      'payments.cancel_reason', 'payments.refund_amount', 'payments.notes',
      'payments.created_by', 'payments.paid_at', 'payments.created_at', 'payments.updated_at',
      'students.full_name as student_name', 'students.student_code',
      'subjects.name as subject_name', 'monthly_dues.month',
      'monthly_dues.discount_applied',
      'treasuries.name as treasury_name',
    ] as any[];
  }

  private dueSelect() {
    return [
      'monthly_dues.id', 'monthly_dues.student_id', 'monthly_dues.subject_grade_id',
      'monthly_dues.month', 'monthly_dues.due_amount', 'monthly_dues.discount_applied',
      'monthly_dues.paid_amount', 'monthly_dues.status', 'monthly_dues.notes',
      'monthly_dues.created_by', 'monthly_dues.created_at', 'monthly_dues.updated_at',
      'students.full_name as student_name', 'students.student_code',
      'subjects.name as subject_name', 'subject_grades.grade as grade_name',
    ] as any[];
  }

  // ─── Treasuries ───────────────────────────────────────────
  async findAllTreasuries(tenantId: string): Promise<TreasuryEntity[]> {
    const db = this.kysely.getTenantDb(tenantId);
    const rows = await db.selectFrom('treasuries').selectAll()
      .where('deleted_at', 'is', null)
      .orderBy('created_at', 'asc').execute();
    return rows.map(r => this.toTreasury(r));
  }

  async findTreasuryById(
    tenantId: string, id: string,
    opts?: { trx?: Kysely<TenantDatabase>; forUpdate?: boolean },
  ): Promise<TreasuryEntity | null> {
    const db = opts?.trx ?? this.kysely.getTenantDb(tenantId);
    let query = db.selectFrom('treasuries').selectAll()
      .where('id', '=', sql<string>`${id}::uuid`)
      .where('deleted_at', 'is', null);
    if (opts?.forUpdate) query = query.forUpdate();
    const row = await query.executeTakeFirst();
    return row ? this.toTreasury(row) : null;
  }

  async createTreasury(tenantId: string, data: CreateTreasuryDto): Promise<TreasuryEntity> {
    const db = this.kysely.getTenantDb(tenantId);
    const row = await db.insertInto('treasuries').values({
      name: data.name, type: data.type, notes: data.notes ?? null,
    } as any).returningAll().executeTakeFirstOrThrow();
    return this.toTreasury(row);
  }

  async saveTreasury(tenantId: string, treasury: TreasuryEntity, trx?: Kysely<TenantDatabase>): Promise<void> {
    const db = trx ?? this.kysely.getTenantDb(tenantId);
    await db.updateTable('treasuries').set({
      name: treasury.name, type: treasury.type,
      balance: treasury.balance, is_active: treasury.isActive,
      notes: treasury.notes, updated_at: new Date() as any,
      deleted_at: treasury.deletedAt as any,
    } as any).where('id', '=', sql<string>`${treasury.id}::uuid`).execute();
  }

  // ─── Monthly Dues ─────────────────────────────────────────
  async findDues(tenantId: string, params: ListDuesDto): Promise<{
    data: MonthlyDueEntity[]; total: number;
    totalDueAmount: number; totalDiscountApplied: number; totalPaidAmount: number;
  }> {
    const db = this.kysely.getTenantDb(tenantId);
    const offset = (params.page - 1) * params.limit;

    const applyFilters = <Q extends { where: any }>(q: Q): Q => {
      let result = q;
      if (params.month)          result = result.where('monthly_dues.month', '=', params.month);
      if (params.from)           result = result.where('monthly_dues.created_at', '>=', new Date(params.from) as any);
      if (params.to)             result = result.where('monthly_dues.created_at', '<=', new Date(`${params.to}T23:59:59.999Z`) as any);
      if (params.studentId)      result = result.where('monthly_dues.student_id', '=', sql<string>`${params.studentId}::uuid`);
      if (params.subjectGradeId) result = result.where('monthly_dues.subject_grade_id', '=', sql<string>`${params.subjectGradeId}::uuid`);
      if (params.status) {
        result = result.where('monthly_dues.status', '=', params.status);
      } else {
        // إخفاء الفواتير الملغاة تلقائياً ما لم يُطلب فيلتر status صريح
        // (الفواتير المعفاة بتفضل ظاهرة في القائمة — بس مبلغها مش محسوب في "المتبقي"، راجع aggQuery تحت)
        result = result.where('monthly_dues.status', '!=', 'cancelled' as any);
      }
      if (params.search) {
        result = result.where((eb: any) => eb.or([
          eb('students.full_name', 'ilike', `%${params.search}%`),
          eb('students.student_code', 'ilike', `%${params.search}%`),
          eb('subjects.name', 'ilike', `%${params.search}%`),
        ]));
      }
      return result;
    };

    let query = db.selectFrom('monthly_dues')
      .leftJoin('students', 'students.id', 'monthly_dues.student_id')
      .leftJoin('subject_grades', 'subject_grades.id', 'monthly_dues.subject_grade_id')
      .leftJoin('subjects', 'subjects.id', 'subject_grades.subject_id')
      .select(this.dueSelect());
    query = applyFilters(query);

    let aggQuery = db.selectFrom('monthly_dues')
      .leftJoin('students', 'students.id', 'monthly_dues.student_id')
      .leftJoin('subject_grades', 'subject_grades.id', 'monthly_dues.subject_grade_id')
      .leftJoin('subjects', 'subjects.id', 'subject_grades.subject_id')
      .select([
        db.fn.countAll<string>().as('count'),
        // الفاتورة المعفاة (waived) مالهاش قيمة "متبقية" حقيقية — لو دخلت في due_amount/discount
        // بتضخّم رقم "المتبقي" بمبالغ اتسامح فيها فعلياً ومش هتتحصل أبداً.
        // المبلغ المحصّل فعلاً (paid_amount) بيفضل محسوب حتى لو الفاتورة اتعفت بعدين — الفلوس دي اتحصلت فعلياً.
        sql<string>`COALESCE(SUM(CASE WHEN monthly_dues.status != 'waived' THEN monthly_dues.due_amount ELSE 0 END), 0)`.as('total_due_amount'),
        sql<string>`COALESCE(SUM(CASE WHEN monthly_dues.status != 'waived' THEN monthly_dues.discount_applied ELSE 0 END), 0)`.as('total_discount_applied'),
        sql<string>`COALESCE(SUM(monthly_dues.paid_amount), 0)`.as('total_paid_amount'),
      ]);
    aggQuery = applyFilters(aggQuery);

    const [rows, aggResult] = await Promise.all([
      query.orderBy('monthly_dues.month', 'desc')
        .orderBy('students.full_name', 'asc')
        .limit(params.limit).offset(offset).execute(),
      aggQuery.executeTakeFirst(),
    ]);

    return {
      data: rows.map(r => this.toMonthlyDue(r)),
      total: Number(aggResult?.count ?? 0),
      totalDueAmount: Number(aggResult?.total_due_amount ?? 0),
      totalDiscountApplied: Number(aggResult?.total_discount_applied ?? 0),
      totalPaidAmount: Number(aggResult?.total_paid_amount ?? 0),
    };
  }

  async findDueById(
    tenantId: string, id: string,
    opts?: { trx?: Kysely<TenantDatabase>; forUpdate?: boolean },
  ): Promise<MonthlyDueEntity | null> {
    const db = opts?.trx ?? this.kysely.getTenantDb(tenantId);
    let query = db.selectFrom('monthly_dues')
      .leftJoin('students', 'students.id', 'monthly_dues.student_id')
      .leftJoin('subject_grades', 'subject_grades.id', 'monthly_dues.subject_grade_id')
      .leftJoin('subjects', 'subjects.id', 'subject_grades.subject_id')
      .select(this.dueSelect())
      .where('monthly_dues.id', '=', sql<string>`${id}::uuid`);
    // forUpdate(of) بيقفل monthly_dues بس (الجدول اللي بنعدله فعلياً) — من غير ما يحاول
    // يقفل صفوف الـ LEFT JOIN (students/subjects) اللي مش محتاجين نقفلها
    if (opts?.forUpdate) query = query.forUpdate('monthly_dues');
    const row = await query.executeTakeFirst();
    return row ? this.toMonthlyDue(row) : null;
  }

  async findDueByStudentSubjectGradeMonth(
    tenantId: string, studentId: string, subjectGradeId: string, month: string,
  ): Promise<MonthlyDueEntity | null> {
    const db = this.kysely.getTenantDb(tenantId);
    const row = await db.selectFrom('monthly_dues')
      .leftJoin('students', 'students.id', 'monthly_dues.student_id')
      .leftJoin('subject_grades', 'subject_grades.id', 'monthly_dues.subject_grade_id')
      .leftJoin('subjects', 'subjects.id', 'subject_grades.subject_id')
      .select(this.dueSelect())
      .where('monthly_dues.student_id', '=', sql<string>`${studentId}::uuid`)
      .where('monthly_dues.subject_grade_id', '=', sql<string>`${subjectGradeId}::uuid`)
      .where('monthly_dues.month', '=', month)
      .executeTakeFirst();
    return row ? this.toMonthlyDue(row) : null;
  }

  async createDue(tenantId: string, data: {
    studentId: string; subjectGradeId: string; month: string;
    dueAmount: number; discountApplied: number; notes?: string; createdBy?: string;
  }): Promise<MonthlyDueEntity> {
    const db = this.kysely.getTenantDb(tenantId);
    const row = await db.insertInto('monthly_dues').values({
      student_id: sql<string>`${data.studentId}::uuid`,
      subject_grade_id: sql<string>`${data.subjectGradeId}::uuid`,
      month: data.month, due_amount: data.dueAmount,
      discount_applied: data.discountApplied,
      notes: data.notes ?? null,
      created_by: data.createdBy ? sql<string>`${data.createdBy}::uuid` : null,
    } as any).returningAll().executeTakeFirstOrThrow();
    return this.toMonthlyDue(row);
  }

  async saveDue(tenantId: string, due: MonthlyDueEntity, trx?: Kysely<TenantDatabase>): Promise<void> {
    const db = trx ?? this.kysely.getTenantDb(tenantId);
    await db.updateTable('monthly_dues').set({
      due_amount: due.dueAmount, discount_applied: due.discountApplied,
      paid_amount: due.paidAmount, status: due.status,
      notes: due.notes, updated_at: new Date() as any,
    } as any).where('id', '=', sql<string>`${due.id}::uuid`).execute();
  }

  async deleteDue(tenantId: string, id: string): Promise<void> {
    const db = this.kysely.getTenantDb(tenantId);
    // soft delete — بنحوّل الـ status لـ cancelled ومبنمسحش السجل فعلياً من DB
    await db.updateTable('monthly_dues').set({
      status: 'cancelled',
      updated_at: new Date() as any,
    } as any).where('id', '=', sql<string>`${id}::uuid`).execute();
  }

  async dueExists(tenantId: string, studentId: string, subjectGradeId: string, month: string): Promise<boolean> {
    const db = this.kysely.getTenantDb(tenantId);
    const row = await db.selectFrom('monthly_dues').select('id')
      .where('student_id', '=', sql<string>`${studentId}::uuid`)
      .where('subject_grade_id', '=', sql<string>`${subjectGradeId}::uuid`)
      .where('month', '=', month)
      .where('status', '!=', 'cancelled' as any)  // الملغاة مش موجودة — يسمح بإعادة الإنشاء
      .executeTakeFirst();
    return !!row;
  }

  async getActiveEnrollments(tenantId: string): Promise<{
    studentId: string; subjectGradeId: string; fee: number; discount: number;
  }[]> {
    const db = this.kysely.getTenantDb(tenantId);
    const rows = await db.selectFrom('group_students')
      .innerJoin('groups', 'groups.id', 'group_students.group_id')
      .innerJoin('subject_grades', 'subject_grades.id', 'groups.subject_grade_id')
      .innerJoin('students', 'students.id', 'group_students.student_id')
      .select([
        'group_students.student_id',
        'groups.subject_grade_id',
        'subject_grades.fee',
        'group_students.discount',
      ])
      .where('group_students.left_at', 'is', null)
      .where('students.is_active', '=', true)
      .where('students.deleted_at', 'is', null)
      .where('groups.deleted_at', 'is', null)
      // لو المادة (subject_grade) اتحذفت أو اتقفلت، منولّدش فاتورة بسعرها القديم —
      // حتى لو مجموعة قديمة لسه مرتبطة بيها وطلابها لسه "نشطين" فيها
      .where('subject_grades.deleted_at', 'is', null)
      .where('subject_grades.is_active', '=', true)
      .execute();
    return rows.map(r => ({
      studentId: r.student_id as string,
      subjectGradeId: r.subject_grade_id as string,
      fee: Number(r.fee),
      discount: Number(r.discount),
    }));
  }

  // ─── Payments ─────────────────────────────────────────────
  async findPayments(tenantId: string, params: ListPaymentsDto): Promise<{ data: PaymentEntity[]; total: number }> {
    const db = this.kysely.getTenantDb(tenantId);
    const offset = (params.page - 1) * params.limit;

    let query = db.selectFrom('payments')
      .leftJoin('students', 'students.id', 'payments.student_id')
      .leftJoin('monthly_dues', 'monthly_dues.id', 'payments.monthly_due_id')
      .leftJoin('subject_grades', 'subject_grades.id', 'monthly_dues.subject_grade_id')
      .leftJoin('subjects', 'subjects.id', 'subject_grades.subject_id')
      .leftJoin('treasuries', 'treasuries.id', 'payments.treasury_id')
      .select(this.paymentSelect());

    if (params.studentId)  query = query.where('payments.student_id', '=', sql<string>`${params.studentId}::uuid`);
    if (params.treasuryId) query = query.where('payments.treasury_id', '=', sql<string>`${params.treasuryId}::uuid`);
    if (params.status)     query = query.where('payments.status', '=', params.status);
    if (params.from)       query = query.where('payments.paid_at', '>=', new Date(params.from) as any);
    if (params.to)         query = query.where('payments.paid_at', '<=', new Date(`${params.to}T23:59:59.999Z`) as any);

    let countQuery = db.selectFrom('payments').select(db.fn.countAll<string>().as('count'));
    if (params.studentId) countQuery = countQuery.where('student_id', '=', sql<string>`${params.studentId}::uuid`);
    if (params.status)    countQuery = countQuery.where('status', '=', params.status);

    const [rows, countResult] = await Promise.all([
      query.orderBy('payments.paid_at', 'desc').limit(params.limit).offset(offset).execute(),
      countQuery.executeTakeFirst(),
    ]);

    return { data: rows.map(r => this.toPayment(r)), total: Number(countResult?.count ?? 0) };
  }

  async findPaymentById(tenantId: string, id: string, trx?: Kysely<TenantDatabase>): Promise<PaymentEntity | null> {
    const db = trx ?? this.kysely.getTenantDb(tenantId);
    const row = await db.selectFrom('payments')
      .leftJoin('students', 'students.id', 'payments.student_id')
      .leftJoin('monthly_dues', 'monthly_dues.id', 'payments.monthly_due_id')
      .leftJoin('subject_grades', 'subject_grades.id', 'monthly_dues.subject_grade_id')
      .leftJoin('subjects', 'subjects.id', 'subject_grades.subject_id')
      .leftJoin('treasuries', 'treasuries.id', 'payments.treasury_id')
      .select(this.paymentSelect())
      .where('payments.id', '=', sql<string>`${id}::uuid`)
      .executeTakeFirst();
    return row ? this.toPayment(row) : null;
  }

  async findPaymentsByStudent(tenantId: string, studentId: string): Promise<PaymentEntity[]> {
    const db = this.kysely.getTenantDb(tenantId);
    const rows = await db.selectFrom('payments')
      .leftJoin('students', 'students.id', 'payments.student_id')
      .leftJoin('monthly_dues', 'monthly_dues.id', 'payments.monthly_due_id')
      .leftJoin('subject_grades', 'subject_grades.id', 'monthly_dues.subject_grade_id')
      .leftJoin('subjects', 'subjects.id', 'subject_grades.subject_id')
      .leftJoin('treasuries', 'treasuries.id', 'payments.treasury_id')
      .select(this.paymentSelect())
      .where('payments.student_id', '=', sql<string>`${studentId}::uuid`)
      .orderBy('payments.paid_at', 'desc')
      .execute();
    return rows.map(r => this.toPayment(r));
  }

  async createPayment(tenantId: string, data: {
    studentId: string; monthlyDueId: string; treasuryId: string;
    amount: number; paymentMethod: string; notes?: string; createdBy?: string;
  }, trx?: Kysely<TenantDatabase>): Promise<PaymentEntity> {
    const db = trx ?? this.kysely.getTenantDb(tenantId);
    const row = await db.insertInto('payments').values({
      student_id: sql<string>`${data.studentId}::uuid`,
      monthly_due_id: sql<string>`${data.monthlyDueId}::uuid`,
      treasury_id: sql<string>`${data.treasuryId}::uuid`,
      amount: data.amount, payment_method: data.paymentMethod,
      notes: data.notes ?? null,
      created_by: data.createdBy ? sql<string>`${data.createdBy}::uuid` : null,
    } as any).returningAll().executeTakeFirstOrThrow();
    return this.toPayment(row);
  }

  async savePayment(tenantId: string, payment: PaymentEntity, trx?: Kysely<TenantDatabase>): Promise<void> {
    const db = trx ?? this.kysely.getTenantDb(tenantId);
    await db.updateTable('payments').set({
      status: payment.status, cancel_reason: payment.cancelReason,
      refund_amount: payment.refundAmount, notes: payment.notes,
      updated_at: new Date() as any,
    } as any).where('id', '=', sql<string>`${payment.id}::uuid`).execute();
  }

  // ─── Transactions ─────────────────────────────────────────
  async createTransaction(tenantId: string, data: {
    paymentId?: string; treasuryId: string; type: TransactionType;
    amount: number; balanceBefore: number; balanceAfter: number;
    notes?: string; createdBy?: string; relatedTreasuryId?: string;
  }, trx?: Kysely<TenantDatabase>): Promise<void> {
    const db = trx ?? this.kysely.getTenantDb(tenantId);
    await db.insertInto('payment_transactions').values({
      payment_id: data.paymentId ? sql<string>`${data.paymentId}::uuid` : null,
      treasury_id: sql<string>`${data.treasuryId}::uuid`,
      type: data.type, amount: data.amount,
      balance_before: data.balanceBefore, balance_after: data.balanceAfter,
      notes: data.notes ?? null,
      created_by: data.createdBy ? sql<string>`${data.createdBy}::uuid` : null,
      related_treasury_id: data.relatedTreasuryId ? sql<string>`${data.relatedTreasuryId}::uuid` : null,
    } as any).execute();
  }

  async findTransactionsByTreasury(tenantId: string, treasuryId: string): Promise<PaymentTransactionEntity[]> {
    const db = this.kysely.getTenantDb(tenantId);
    const rows = await db.selectFrom('payment_transactions as pt')
      .leftJoin('treasuries as t', 't.id', 'pt.treasury_id')
      .leftJoin('treasuries as rt', 'rt.id', 'pt.related_treasury_id')
      .select([
        'pt.id', 'pt.payment_id', 'pt.treasury_id', 'pt.type', 'pt.amount',
        'pt.balance_before', 'pt.balance_after', 'pt.notes', 'pt.created_by',
        'pt.related_treasury_id', 'pt.created_at',
        't.name as treasury_name', 'rt.name as related_treasury_name',
      ] as any[])
      .where('pt.treasury_id', '=', sql<string>`${treasuryId}::uuid`)
      .orderBy('pt.created_at', 'desc')
      .execute();
    return rows.map(r => this.toTransaction(r));
  }

  async getTreasurySummary(tenantId: string, treasuryId: string): Promise<{
    totalIncome: number; totalExpenses: number; totalTransfersIn: number; totalTransfersOut: number;
    totalCancellations: number; totalRefunds: number;
  }> {
    const db = this.kysely.getTenantDb(tenantId);
    // لازم نجيب كل أنواع الحركات اللي بتأثر على الرصيد (زي ما هي مسجلة فعلياً في debit()/credit())
    // — الإلغاء والاسترجاع كانوا مستبعدين قبل كده، فالملخص ده كان بيديلك أرقام
    // (إيرادات - مصروفات - تحويلات خارجة + تحويلات داخلة) ميساويش رصيد الخزينة الفعلي
    // بمجرد ما يحصل أي إلغاء أو استرجاع.
    const rows = await db.selectFrom('payment_transactions')
      .select(['type', sql<string>`COALESCE(SUM(amount), 0)`.as('total')])
      .where('treasury_id', '=', sql<string>`${treasuryId}::uuid`)
      .where('type', 'in', ['income', 'expense', 'transfer_in', 'transfer_out', 'cancellation', 'refund'])
      .groupBy('type')
      .execute();

    const totals: Record<string, number> = {};
    for (const r of rows) totals[r.type as string] = Number((r as any).total);

    return {
      totalIncome: totals['income'] ?? 0,
      totalExpenses: totals['expense'] ?? 0,
      totalTransfersIn: totals['transfer_in'] ?? 0,
      totalTransfersOut: totals['transfer_out'] ?? 0,
      totalCancellations: totals['cancellation'] ?? 0,
      totalRefunds: totals['refund'] ?? 0,
    };
  }

  // ─── Expenses ─────────────────────────────────────────────
  async findExpenses(tenantId: string, params: ListExpensesDto): Promise<{ data: ExpenseEntity[]; total: number }> {
    const db = this.kysely.getTenantDb(tenantId);
    const offset = (params.page - 1) * params.limit;

    let query = db.selectFrom('expenses')
      .leftJoin('treasuries', 'treasuries.id', 'expenses.treasury_id')
      .select([
        'expenses.id', 'expenses.treasury_id', 'expenses.category', 'expenses.title',
        'expenses.amount', 'expenses.expense_date', 'expenses.notes',
        'expenses.created_by', 'expenses.created_at', 'expenses.updated_at', 'expenses.deleted_at',
        'treasuries.name as treasury_name',
      ] as any[])
      .where('expenses.deleted_at', 'is', null);

    if (params.treasuryId) query = query.where('expenses.treasury_id', '=', sql<string>`${params.treasuryId}::uuid`);
    if (params.category)   query = query.where('expenses.category', '=', params.category);
    if (params.from)       query = query.where('expenses.expense_date', '>=', new Date(params.from) as any);
    if (params.to)         query = query.where('expenses.expense_date', '<=', new Date(params.to) as any);

    let countQuery = db.selectFrom('expenses')
      .select(db.fn.countAll<string>().as('count'))
      .where('deleted_at', 'is', null);
    if (params.treasuryId) countQuery = countQuery.where('treasury_id', '=', sql<string>`${params.treasuryId}::uuid`);
    if (params.category)   countQuery = countQuery.where('category', '=', params.category);

    const [rows, countResult] = await Promise.all([
      query.orderBy('expenses.expense_date', 'desc').limit(params.limit).offset(offset).execute(),
      countQuery.executeTakeFirst(),
    ]);

    return { data: rows.map(r => this.toExpense(r)), total: Number(countResult?.count ?? 0) };
  }

  async findExpenseById(tenantId: string, id: string): Promise<ExpenseEntity | null> {
    const db = this.kysely.getTenantDb(tenantId);
    const row = await db.selectFrom('expenses')
      .leftJoin('treasuries', 'treasuries.id', 'expenses.treasury_id')
      .select([
        'expenses.id', 'expenses.treasury_id', 'expenses.category', 'expenses.title',
        'expenses.amount', 'expenses.expense_date', 'expenses.notes',
        'expenses.created_by', 'expenses.created_at', 'expenses.updated_at', 'expenses.deleted_at',
        'treasuries.name as treasury_name',
      ] as any[])
      .where('expenses.id', '=', sql<string>`${id}::uuid`)
      .where('expenses.deleted_at', 'is', null)
      .executeTakeFirst();
    return row ? this.toExpense(row) : null;
  }

  async createExpense(tenantId: string, data: {
    treasuryId: string; category: string; title: string;
    amount: number; expenseDate: Date; notes?: string; createdBy?: string;
  }, trx?: Kysely<TenantDatabase>): Promise<ExpenseEntity> {
    const db = trx ?? this.kysely.getTenantDb(tenantId);
    const row = await db.insertInto('expenses').values({
      treasury_id: sql<string>`${data.treasuryId}::uuid`,
      category: data.category, title: data.title, amount: data.amount,
      expense_date: data.expenseDate as any, notes: data.notes ?? null,
      created_by: data.createdBy ? sql<string>`${data.createdBy}::uuid` : null,
    } as any).returningAll().executeTakeFirstOrThrow();
    return this.toExpense(row);
  }

  async saveExpense(tenantId: string, expense: ExpenseEntity): Promise<void> {
    const db = this.kysely.getTenantDb(tenantId);
    await db.updateTable('expenses').set({
      category: expense.category, title: expense.title, amount: expense.amount,
      expense_date: expense.expenseDate as any, notes: expense.notes,
      updated_at: new Date() as any, deleted_at: expense.deletedAt as any,
    } as any).where('id', '=', sql<string>`${expense.id}::uuid`).execute();
  }

  // ─── Stats ────────────────────────────────────────────────
  async getStats(tenantId: string, month: string): Promise<{
    totalDues: number; totalCollected: number; totalPending: number;
    totalExpenses: number; duesCount: number; paidCount: number; unpaidCount: number;
  }> {
    const db = this.kysely.getTenantDb(tenantId);
    // آخر يوم فعلي في الشهر — بدل الرقم الثابت 31 اللي كان بيلف تلقائياً لأول الشهر
    // التالي في الشهور الأقل من 31 يوم (فبراير، أبريل، يونيو...) ويسرّب مصروفات الشهر الجاي
    const [year, monthNum] = month.split('-').map(Number);
    const lastDayOfMonth = new Date(year, monthNum, 0).getDate();
    const monthEnd = `${month}-${String(lastDayOfMonth).padStart(2, '0')}`;

    const [dues, expenses, paidCount] = await Promise.all([
      db.selectFrom('monthly_dues')
        .select([
          // استبعاد الفواتير المعفاة (waived) من "إجمالي المستحق" — مالهاش قيمة متبقية حقيقية
          sql<string>`SUM(CASE WHEN status != 'waived' THEN GREATEST(due_amount - discount_applied, 0) ELSE 0 END)`.as('total_dues'),
          db.fn.sum<string>('paid_amount').as('total_collected'),
          db.fn.countAll<string>().as('dues_count'),
        ])
        .where('month', '=', month)
        .executeTakeFirst(),
      db.selectFrom('expenses')
        .select(db.fn.sum<string>('amount').as('total_expenses'))
        .where('expense_date', '>=', new Date(`${month}-01`) as any)
        .where('expense_date', '<=', new Date(`${monthEnd}T23:59:59.999Z`) as any)
        .where('deleted_at', 'is', null)
        .executeTakeFirst(),
      db.selectFrom('monthly_dues')
        .select(db.fn.countAll<string>().as('count'))
        .where('month', '=', month)
        .where('status', '=', 'paid')
        .executeTakeFirst(),
    ]);

    const totalDues = Number(dues?.total_dues ?? 0);
    const totalCollected = Number(dues?.total_collected ?? 0);
    const duesCount = Number(dues?.dues_count ?? 0);
    const paid = Number(paidCount?.count ?? 0);

    return {
      totalDues, totalCollected,
      totalPending: totalDues - totalCollected,
      totalExpenses: Number(expenses?.total_expenses ?? 0),
      duesCount, paidCount: paid, unpaidCount: duesCount - paid,
    };
  }

  // ─── Search Students for Collection ──────────────────────
  async searchStudentsForCollection(tenantId: string, query: string): Promise<{
    studentId: string; studentName: string; studentCode: string;
  }[]> {
    const db = this.kysely.getTenantDb(tenantId);
    const rows = await db.selectFrom('students')
      .select(['id', 'full_name', 'student_code'])
      .where('deleted_at', 'is', null)
      .where('is_active', '=', true)
      .where((eb) => eb.or([
        eb('full_name', 'like', `%${query}%`),
        eb('student_code', 'like', `%${query}%`),
      ]))
      .limit(10)
      .execute();
    return rows.map(r => ({
      studentId: r.id as string,
      studentName: r.full_name as string,
      studentCode: r.student_code as string,
    }));
  }

  // ─── Student Open Dues ────────────────────────────────────
  async findOpenDuesByStudentId(tenantId: string, studentId: string): Promise<{
    studentId: string; studentName: string; studentCode: string;
    dues: MonthlyDueEntity[];
  } | null> {
    const db = this.kysely.getTenantDb(tenantId);
    const student = await db.selectFrom('students').selectAll()
      .where('id', '=', sql<string>`${studentId}::uuid`)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    if (!student) return null;

    const rows = await db.selectFrom('monthly_dues')
      .leftJoin('students', 'students.id', 'monthly_dues.student_id')
      .leftJoin('subject_grades', 'subject_grades.id', 'monthly_dues.subject_grade_id')
      .leftJoin('subjects', 'subjects.id', 'subject_grades.subject_id')
      .select(this.dueSelect())
      .where('monthly_dues.student_id', '=', sql<string>`${studentId}::uuid`)
      .where('monthly_dues.status', 'in', ['unpaid', 'partial'])
      .orderBy('monthly_dues.month', 'asc')
      .execute();

    return {
      studentId: student.id as string,
      studentName: student.full_name as string,
      studentCode: student.student_code as string,
      dues: rows.map(r => this.toMonthlyDue(r)),
    };
  }

  // ─── Student Financial Profile ────────────────────────────
  async getStudentFinancialProfile(tenantId: string, studentId: string) {
    const db = this.kysely.getTenantDb(tenantId);
    const [dues, payments] = await Promise.all([
      db.selectFrom('monthly_dues')
        .leftJoin('subject_grades', 'subject_grades.id', 'monthly_dues.subject_grade_id')
        .leftJoin('subjects', 'subjects.id', 'subject_grades.subject_id')
        .select([
          'monthly_dues.id', 'monthly_dues.student_id', 'monthly_dues.subject_grade_id',
          'monthly_dues.month', 'monthly_dues.due_amount', 'monthly_dues.discount_applied',
          'monthly_dues.paid_amount', 'monthly_dues.status', 'monthly_dues.notes',
          'monthly_dues.created_by', 'monthly_dues.created_at', 'monthly_dues.updated_at',
          'subjects.name as subject_name', 'subject_grades.grade as grade_name',
        ] as any[])
        .where('monthly_dues.student_id', '=', sql<string>`${studentId}::uuid`)
        // إخفاء الفواتير الملغاة — نفس الاتفاقية المستخدمة في findDues، عشان
        // الفواتير اللي اتلغت متفضلش ظاهرة في بروفايل الطالب وبتضخّم الإجمالي
        // (كانت بتظهر من غير فلتر status أصلاً، والـ DueStatus في الفرونت مكنش
        // فيه حتى 'cancelled' فكانت بتظهر ببادج فاضي بلا تسمية)
        .where('monthly_dues.status', '!=', 'cancelled' as any)
        .orderBy('monthly_dues.month', 'desc')
        .execute(),
      this.findPaymentsByStudent(tenantId, studentId),
    ]);

    const dueEntities = dues.map(r => this.toMonthlyDue(r));
    const totalDues = dueEntities.reduce((sum, d) => sum + d.netDueAmount, 0);
    const totalPaid = dueEntities.reduce((sum, d) => sum + d.paidAmount, 0);
    // متبقي حقيقي: الفواتير المعفاة (waived) متضافش للمتبقي حتى لو مش مدفوعة بالكامل
    const totalPending = dueEntities.reduce(
      (sum, d) => sum + (d.status === 'waived' ? 0 : Math.max(0, d.netDueAmount - d.paidAmount)),
      0,
    );

    return {
      dues: dueEntities,
      payments,
      totalDues,
      totalPaid,
      totalPending,
    };
  }
}
