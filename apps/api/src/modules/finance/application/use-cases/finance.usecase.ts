import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Inject } from '@nestjs/common';
import type { Kysely } from 'kysely';
import type { TenantDatabase } from '@nabgha/db';
import { IFinanceRepository, FINANCE_REPOSITORY } from '../../domain/repositories/finance.repository.interface';
import { AppError } from '../../../../core/errors/app.error';
import { SendNotificationUseCase } from '../../../whatsapp/application/use-cases/send-notification.usecase';
import { KyselyService } from "../../../../shared/infrastructure/database/kysely.service";
import { PrismaService } from "../../../../shared/infrastructure/database/prisma.service";
import type { PaymentEntity } from '../../domain/entities/finance.entity';
import type {
  CreateTreasuryDto, UpdateTreasuryDto, GenerateDuesDto, UpdateDueDto,
  CreatePaymentDto, CancelPaymentDto, RefundPaymentDto, CreateManualDueDto,
  ListDuesDto, ListPaymentsDto, CreateExpenseDto, UpdateExpenseDto, ListExpensesDto,
  TransferBetweenTreasuriesDto,
} from '../dtos/finance.dto';

@Injectable()
export class FinanceUseCase {
  private readonly logger = new Logger(FinanceUseCase.name);

  constructor(
    @Inject(FINANCE_REPOSITORY)
    private readonly repo: IFinanceRepository,
    private readonly sendNotification: SendNotificationUseCase,
    private readonly kysely: KyselyService,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Transaction Helpers ────────────────────────────────────
  // كل عملية مالية مركّبة (تحصيل/إلغاء/استرجاع/تحويل/مصروف) لازم تتلف في transaction
  // واحدة — لو أي خطوة فشلت في النص (قطع كهرباء، تقفيلة مفاجئة للجهاز، مشكلة اتصال
  // لحظية)، كل الخطوات بترجع (rollback) بدل ما يفضل رصيد خزينة اتحدّث من غير سجل
  // حركة يوضحه، أو فاتورة اتسجلت مدفوعة من غير ما رصيد الخزينة يتحدث فعلياً.
  private async runInTransaction<T>(
    tenantId: string,
    fn: (trx: Kysely<TenantDatabase>) => Promise<T>,
  ): Promise<T> {
    const db = this.kysely.getTenantDb(tenantId);
    return db.transaction().execute(fn);
  }

  // نسخ "مقفولة" (SELECT ... FOR UPDATE) من getTreasury/getDue — تُستخدم فقط جوه
  // transaction فعلية، عشان تمنع اتنين يحصّلوا/يلغوا في نفس اللحظة بالظبط على نفس
  // الفاتورة أو الخزينة (lost update / race condition)
  private async getTreasuryLocked(tenantId: string, id: string, trx: Kysely<TenantDatabase>) {
    const treasury = await this.repo.findTreasuryById(tenantId, id, { trx, forUpdate: true });
    if (!treasury) throw new AppError('NOT_FOUND', 'الخزينة غير موجودة', 404);
    return treasury;
  }

  private async getDueLocked(tenantId: string, id: string, trx: Kysely<TenantDatabase>) {
    const due = await this.repo.findDueById(tenantId, id, { trx, forUpdate: true });
    if (!due) throw new AppError('NOT_FOUND', 'الفاتورة غير موجودة', 404);
    return due;
  }

  private async getPaymentInTx(tenantId: string, id: string, trx: Kysely<TenantDatabase>) {
    const payment = await this.repo.findPaymentById(tenantId, id, trx);
    if (!payment) throw new AppError('NOT_FOUND', 'الإيصال غير موجود', 404);
    return payment;
  }

  // ─── Treasuries ───────────────────────────────────────────
  async listTreasuries(tenantId: string) {
    return this.repo.findAllTreasuries(tenantId);
  }

  async getTreasury(tenantId: string, id: string) {
    const treasury = await this.repo.findTreasuryById(tenantId, id);
    if (!treasury) throw new AppError('NOT_FOUND', 'الخزينة غير موجودة', 404);
    return treasury;
  }

  async createTreasury(tenantId: string, data: CreateTreasuryDto) {
    return this.repo.createTreasury(tenantId, data);
  }

  async updateTreasury(tenantId: string, id: string, data: UpdateTreasuryDto) {
    const treasury = await this.getTreasury(tenantId, id);
    treasury.update(data as any);
    await this.repo.saveTreasury(tenantId, treasury);
    return treasury;
  }

  async deleteTreasury(tenantId: string, id: string) {
    const treasury = await this.getTreasury(tenantId, id);
    if (treasury.balance > 0) throw new AppError('TREASURY_NOT_EMPTY', 'لا يمكن حذف خزينة بها رصيد', 400);
    treasury.softDelete();
    await this.repo.saveTreasury(tenantId, treasury);
  }

  async getTreasuryDetail(tenantId: string, id: string) {
    const treasury = await this.getTreasury(tenantId, id);
    const [transactions, summary] = await Promise.all([
      this.repo.findTransactionsByTreasury(tenantId, id),
      this.repo.getTreasurySummary(tenantId, id),
    ]);
    return { treasury, transactions, summary };
  }

  async transferBetweenTreasuries(tenantId: string, data: TransferBetweenTreasuriesDto, userId: string) {
    return this.runInTransaction(tenantId, async (trx) => {
      // نقفل الخزينتين بترتيب ثابت (حسب الـ id) مش بترتيب from/to — عشان لو
      // حصل تحويلين متزامنين بالعكس (A→B و B→A) في نفس اللحظة، الاتنين يحاولوا
      // يقفلوا بنفس الترتيب فمايحصلش deadlock بينهم
      const [firstId, secondId] = [data.fromTreasuryId, data.toTreasuryId].sort();
      const first = await this.getTreasuryLocked(tenantId, firstId, trx);
      const second = await this.getTreasuryLocked(tenantId, secondId, trx);
      const fromTreasury = first.id === data.fromTreasuryId ? first : second;
      const toTreasury = first.id === data.fromTreasuryId ? second : first;

      if (!fromTreasury.isActive || !toTreasury.isActive) {
        throw new AppError('TREASURY_INACTIVE', 'لا يمكن التحويل من/إلى خزينة متوقفة', 400);
      }
      if (data.amount > fromTreasury.balance) {
        throw new AppError('INSUFFICIENT_BALANCE', `رصيد الخزينة الحالي (${fromTreasury.balance} جنيه) أقل من مبلغ التحويل`, 400);
      }

      const fromBalanceBefore = fromTreasury.balance;
      fromTreasury.debit(data.amount);
      const toBalanceBefore = toTreasury.balance;
      toTreasury.credit(data.amount);

      await this.repo.saveTreasury(tenantId, fromTreasury, trx);
      await this.repo.saveTreasury(tenantId, toTreasury, trx);
      await this.repo.createTransaction(tenantId, {
        treasuryId: fromTreasury.id,
        type: 'transfer_out',
        amount: data.amount,
        balanceBefore: fromBalanceBefore,
        balanceAfter: fromTreasury.balance,
        notes: data.notes,
        createdBy: userId,
        relatedTreasuryId: toTreasury.id,
      }, trx);
      await this.repo.createTransaction(tenantId, {
        treasuryId: toTreasury.id,
        type: 'transfer_in',
        amount: data.amount,
        balanceBefore: toBalanceBefore,
        balanceAfter: toTreasury.balance,
        notes: data.notes,
        createdBy: userId,
        relatedTreasuryId: fromTreasury.id,
      }, trx);

      this.logger.log(`Transfer: ${data.amount} from treasury ${fromTreasury.id} to ${toTreasury.id}`);

      return { fromTreasury, toTreasury };
    });
  }

  // ─── Monthly Dues ─────────────────────────────────────────
  async listDues(tenantId: string, params: ListDuesDto) {
    return this.repo.findDues(tenantId, params);
  }

  async getDue(tenantId: string, id: string) {
    const due = await this.repo.findDueById(tenantId, id);
    if (!due) throw new AppError('NOT_FOUND', 'الفاتورة غير موجودة', 404);
    return due;
  }

  async generateDues(tenantId: string, data: GenerateDuesDto, userId?: string): Promise<{ created: number; skipped: number }> {
    const enrollments = await this.repo.getActiveEnrollments(tenantId);
    let created = 0;
    let skipped = 0;

    const seen = new Set<string>();

    for (const enrollment of enrollments) {
      const key = `${enrollment.studentId}_${enrollment.subjectGradeId}_${data.month}`;
      if (seen.has(key)) { skipped++; continue; }
      seen.add(key);

      const exists = await this.repo.dueExists(tenantId, enrollment.studentId, enrollment.subjectGradeId, data.month);
      if (exists) { skipped++; continue; }

      await this.repo.createDue(tenantId, {
        studentId: enrollment.studentId,
        subjectGradeId: enrollment.subjectGradeId,
        month: data.month,
        dueAmount: enrollment.fee,
        discountApplied: enrollment.discount,
        createdBy: userId,
      });
      created++;
    }

    this.logger.log(`Generated dues for ${data.month}: ${created} created, ${skipped} skipped`);
    return { created, skipped };
  }

  // بيتنادى لما الخصم يتغير في group_students عشان يعكس على فاتورة الشهر الحالي
  // لو موجودة بالفعل — عشان "متبقي الشهر" يعكس الخصم فورًا من غير ما نستنى شهر جديد
  async syncDiscountForCurrentMonth(
    tenantId: string, studentId: string, subjectGradeId: string, discount: number,
  ): Promise<void> {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const due = await this.repo.findDueByStudentSubjectGradeMonth(tenantId, studentId, subjectGradeId, month);
    if (!due || due.status === 'paid' || due.status === 'waived') return;
    due.updateAmount(due.dueAmount, discount);
    await this.repo.saveDue(tenantId, due);
  }

  async updateDue(tenantId: string, id: string, data: UpdateDueDto) {
    const due = await this.getDue(tenantId, id);
    if (due.status === 'paid') throw new AppError('INVALID_STATUS', 'لا يمكن تعديل فاتورة مدفوعة', 400);
    if (data.dueAmount !== undefined || data.discountApplied !== undefined) {
      due.updateAmount(
        data.dueAmount ?? due.dueAmount,
        data.discountApplied ?? due.discountApplied,
      );
    }
    if (data.notes !== undefined) due.notes = data.notes;
    await this.repo.saveDue(tenantId, due);
    return due;
  }

  // فاتورة يدوية — للدفع المقدم لشهر لسه ما اتولدش، أو تسجيل اشتراك طالب جديد
  // انضم في نص الشهر (يوم 20 مثلاً) ومحتاج فاتورة بمبلغ مختلف عن السعر الكامل
  async createManualDue(tenantId: string, data: CreateManualDueDto, userId: string) {
    const exists = await this.repo.dueExists(tenantId, data.studentId, data.subjectGradeId, data.month);
    if (exists) {
      throw new AppError('ALREADY_EXISTS', 'يوجد بالفعل فاتورة لنفس الطالب والمادة في هذا الشهر', 409);
    }
    const due = await this.repo.createDue(tenantId, {
      studentId: data.studentId,
      subjectGradeId: data.subjectGradeId,
      month: data.month,
      dueAmount: data.dueAmount,
      discountApplied: data.discountApplied ?? 0,
      notes: data.notes,
      createdBy: userId,
    });
    this.logger.log(`Manual due created: ${due.id} — student: ${data.studentId} — amount: ${data.dueAmount}`);
    return due;
  }

  async waiveDue(tenantId: string, id: string, notes?: string) {
    const due = await this.getDue(tenantId, id);
    if (due.status === 'paid') throw new AppError('INVALID_STATUS', 'الفاتورة مدفوعة بالفعل', 400);
    // إعفاء فاتورة متحصل منها جزء بيسامح بس في المتبقي — الجزء المدفوع فعلاً فضل في الخزينة وميترجعش
    due.waive();
    if (notes) due.notes = notes;
    await this.repo.saveDue(tenantId, due);
    return due;
  }

  async deleteDue(tenantId: string, id: string) {
    const due = await this.getDue(tenantId, id);

    // الحذف مسموح فقط للفواتير غير المدفوعة
    // لو فيها سداد (partial أو paid) لازم يلغي السداد الأول
    if (due.status !== 'unpaid') {
      throw new AppError(
        'INVALID_STATUS',
        due.status === 'paid'
          ? 'لا يمكن حذف فاتورة مدفوعة — ألغِ السداد أولاً ثم أعد المحاولة'
          : due.status === 'partial'
          ? 'لا يمكن حذف فاتورة بها سداد جزئي — ألغِ السداد أولاً ثم أعد المحاولة'
          : 'لا يمكن حذف هذه الفاتورة',
        400,
      );
    }

    due.softDelete();
    await this.repo.saveDue(tenantId, due);
    this.logger.log(`Due deleted (soft): ${id}`);
  }

  // ─── Payments ─────────────────────────────────────────────
  async listPayments(tenantId: string, params: ListPaymentsDto) {
    return this.repo.findPayments(tenantId, params);
  }

  async getPayment(tenantId: string, id: string) {
    const payment = await this.repo.findPaymentById(tenantId, id);
    if (!payment) throw new AppError('NOT_FOUND', 'الإيصال غير موجود', 404);
    return payment;
  }

  // المنطق الفعلي لتسجيل دفعة — لازم يتنفذ جوه transaction معاها due/treasury مقفولين
  // (forUpdate) قبل ما يتنادى. مستخدمة من createPayment (دفعة واحدة) وcollectMultiplePayments
  // (أكتر من فاتورة مرة واحدة) عشان نتجنب تكرار نفس منطق التحقق والتحديث.
  private async createPaymentInTx(
    tenantId: string, data: CreatePaymentDto, userId: string, trx: Kysely<TenantDatabase>,
  ): Promise<PaymentEntity> {
    const due = await this.getDueLocked(tenantId, data.monthlyDueId, trx);
    const treasury = await this.getTreasuryLocked(tenantId, data.treasuryId, trx);

    if (!treasury.isActive) throw new AppError('TREASURY_INACTIVE', 'الخزينة متوقفة — لا يمكن التحصيل فيها', 400);
    if (due.status === 'paid') throw new AppError('ALREADY_PAID', 'الفاتورة مدفوعة بالكامل', 400);
    if (due.status === 'waived') throw new AppError('INVALID_STATUS', 'الفاتورة معفاة', 400);
    if (data.amount > due.remainingAmount) {
      throw new AppError('AMOUNT_EXCEEDED', `المبلغ يتجاوز المتبقي (${due.remainingAmount} جنيه)`, 400);
    }

    const balanceBefore = treasury.balance;
    treasury.credit(data.amount);
    due.addPayment(data.amount);

    const payment = await this.repo.createPayment(tenantId, {
      studentId: due.studentId,
      monthlyDueId: due.id,
      treasuryId: treasury.id,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      notes: data.notes,
      createdBy: userId,
    }, trx);

    await this.repo.saveTreasury(tenantId, treasury, trx);
    await this.repo.saveDue(tenantId, due, trx);
    await this.repo.createTransaction(tenantId, {
      paymentId: payment.id,
      treasuryId: treasury.id,
      type: 'income',
      amount: data.amount,
      balanceBefore,
      balanceAfter: treasury.balance,
      createdBy: userId,
    }, trx);

    return payment;
  }

  async createPayment(tenantId: string, data: CreatePaymentDto, userId: string) {
    const payment = await this.runInTransaction(tenantId, (trx) =>
      this.createPaymentInTx(tenantId, data, userId, trx),
    );

    this.logger.log(`Payment created: ${payment.id} — amount: ${data.amount} — receipt: #${payment.receiptNumber}`);

    // WhatsApp notification — fire and forget، وبعد ما الـ transaction اتأكدت ونجحت بالكامل
    this.sendPaymentConfirmNotification(tenantId, payment.studentId, data.amount, payment.receiptNumber)
      .catch(err => this.logger.error('PAYMENT_CONFIRM WA failed: ' + err.message));

    return payment;
  }

  async cancelPayment(tenantId: string, id: string, data: CancelPaymentDto, userId: string) {
    return this.runInTransaction(tenantId, async (trx) => {
      const payment = await this.getPaymentInTx(tenantId, id, trx);
      if (payment.status !== 'paid') throw new AppError('INVALID_STATUS', 'لا يمكن إلغاء هذا الإيصال', 400);

      const due = await this.getDueLocked(tenantId, payment.monthlyDueId, trx);
      const treasury = await this.getTreasuryLocked(tenantId, payment.treasuryId, trx);

      if (payment.amount > treasury.balance) {
        throw new AppError('INSUFFICIENT_BALANCE', `رصيد الخزينة الحالي (${treasury.balance} جنيه) أقل من مبلغ الإيصال — لا يمكن الإلغاء الآن`, 400);
      }

      const balanceBefore = treasury.balance;
      treasury.debit(payment.amount);
      due.reversePayment(payment.amount);
      payment.cancel(data.reason);

      await this.repo.savePayment(tenantId, payment, trx);
      await this.repo.saveDue(tenantId, due, trx);
      await this.repo.saveTreasury(tenantId, treasury, trx);
      await this.repo.createTransaction(tenantId, {
        paymentId: payment.id,
        treasuryId: treasury.id,
        type: 'cancellation',
        amount: payment.amount,
        balanceBefore,
        balanceAfter: treasury.balance,
        notes: data.reason,
        createdBy: userId,
      }, trx);

      return payment;
    });
  }

  async refundPayment(tenantId: string, id: string, data: RefundPaymentDto, userId: string) {
    return this.runInTransaction(tenantId, async (trx) => {
      const payment = await this.getPaymentInTx(tenantId, id, trx);
      if (payment.status === 'cancelled') throw new AppError('INVALID_STATUS', 'الإيصال ملغي', 400);
      if (payment.status === 'refunded') throw new AppError('INVALID_STATUS', 'تم الاسترجاع بالكامل بالفعل', 400);

      // منع تجاوز المبلغ المسترجع الفعلي في حالة partial_refund —
      // الإيصال ممكن يكون partial_refund من استرجاع سابق —
      // لازم نحسب المتبقي القابل للاسترجاع بدل المقارنة بـ payment.amount كامل
      const alreadyRefunded = payment.refundAmount ?? 0;
      const maxRefundable = payment.amount - alreadyRefunded;
      if (data.amount > maxRefundable) {
        throw new AppError(
          'AMOUNT_EXCEEDED',
          `مبلغ الاسترجاع يتجاوز المتبقي القابل للاسترجاع (${maxRefundable} جنيه)`,
          400,
        );
      }

      const due = await this.getDueLocked(tenantId, payment.monthlyDueId, trx);
      const treasury = await this.getTreasuryLocked(tenantId, payment.treasuryId, trx);

      if (data.amount > treasury.balance) {
        throw new AppError('INSUFFICIENT_BALANCE', `رصيد الخزينة الحالي (${treasury.balance} جنيه) أقل من مبلغ الاسترجاع المطلوب`, 400);
      }

      const balanceBefore = treasury.balance;
      treasury.debit(data.amount);
      due.reversePayment(data.amount);

      // نحدّث الـ refundAmount التراكمي وليس بس الأخير
      const totalRefunded = alreadyRefunded + data.amount;
      payment.refund(totalRefunded);

      await this.repo.savePayment(tenantId, payment, trx);
      await this.repo.saveDue(tenantId, due, trx);
      await this.repo.saveTreasury(tenantId, treasury, trx);
      await this.repo.createTransaction(tenantId, {
        paymentId: payment.id,
        treasuryId: treasury.id,
        type: 'refund',
        amount: data.amount,
        balanceBefore,
        balanceAfter: treasury.balance,
        notes: data.notes,
        createdBy: userId,
      }, trx);

      return payment;
    });
  }

  // ─── Expenses ─────────────────────────────────────────────
  async listExpenses(tenantId: string, params: ListExpensesDto) {
    return this.repo.findExpenses(tenantId, params);
  }

  async getExpense(tenantId: string, id: string) {
    const expense = await this.repo.findExpenseById(tenantId, id);
    if (!expense) throw new AppError('NOT_FOUND', 'المصروف غير موجود', 404);
    return expense;
  }

  async createExpense(tenantId: string, data: CreateExpenseDto, userId: string) {
    return this.runInTransaction(tenantId, async (trx) => {
      const treasury = await this.getTreasuryLocked(tenantId, data.treasuryId, trx);
      if (!treasury.isActive) throw new AppError('TREASURY_INACTIVE', 'الخزينة متوقفة — لا يمكن تسجيل مصروف عليها', 400);
      if (data.amount > treasury.balance) {
        throw new AppError('INSUFFICIENT_BALANCE', `رصيد الخزينة غير كافي (${treasury.balance} جنيه)`, 400);
      }

      const balanceBefore = treasury.balance;
      treasury.debit(data.amount);

      const expense = await this.repo.createExpense(tenantId, {
        treasuryId: data.treasuryId,
        category: data.category,
        title: data.title,
        amount: data.amount,
        expenseDate: data.expenseDate ? new Date(data.expenseDate) : new Date(),
        notes: data.notes,
        createdBy: userId,
      }, trx);

      await this.repo.saveTreasury(tenantId, treasury, trx);
      await this.repo.createTransaction(tenantId, {
        treasuryId: treasury.id,
        type: 'expense',
        amount: data.amount,
        balanceBefore,
        balanceAfter: treasury.balance,
        notes: data.title,
        createdBy: userId,
      }, trx);

      return expense;
    });
  }

  async updateExpense(tenantId: string, id: string, data: UpdateExpenseDto) {
    const expense = await this.getExpense(tenantId, id);
    expense.update(data as any);
    await this.repo.saveExpense(tenantId, expense);
    return expense;
  }

  async deleteExpense(tenantId: string, id: string) {
    const expense = await this.getExpense(tenantId, id);
    expense.softDelete();
    await this.repo.saveExpense(tenantId, expense);
  }

  // ─── Collection ───────────────────────────────────────────
  async searchStudentsForCollection(tenantId: string, query: string) {
    if (!query || query.trim().length < 2) return [];
    return this.repo.searchStudentsForCollection(tenantId, query.trim());
  }

  async getStudentOpenDues(tenantId: string, studentId: string) {
    const result = await this.repo.findOpenDuesByStudentId(tenantId, studentId);
    if (!result) throw new AppError('NOT_FOUND', 'الطالب غير موجود', 404);
    return result;
  }

  async getStudentFinancialProfile(tenantId: string, studentId: string) {
    return this.repo.getStudentFinancialProfile(tenantId, studentId);
  }

  async collectMultiplePayments(tenantId: string, data: {
    payments: { monthlyDueId: string; amount: number }[];
    treasuryId: string;
    paymentMethod: string;
    notes?: string;
  }, userId: string) {
    // ترتيب الفواتير حسب الـ id (مش ترتيب اختيار المستخدم) — عشان لو حصل طلبين
    // تحصيل متزامنين شغالين على فواتير مشتركة، الاتنين يقفلوا الصفوف بنفس
    // الترتيب فمايحصلش deadlock بينهم
    const sortedPayments = [...data.payments].sort((a, b) => a.monthlyDueId.localeCompare(b.monthlyDueId));

    // الكل في transaction واحدة — إما كل الفواتير المختارة تتحصّل مع بعض، أو ولا
    // واحدة فيها تتسجل خالص. قبل كده كانت بتتحصّل واحدة واحدة في loop عادي —
    // لو فاتورة في النص فشلت، اللي قبلها كانت بتفضل متحصّلة فعلياً من غير أي
    // تراجع، والمستخدم كان بيشوف رسالة خطأ عامة من غير ما يعرف مين اتحصل فعلاً
    const results = await this.runInTransaction(tenantId, async (trx) => {
      const created: PaymentEntity[] = [];
      for (let i = 0; i < sortedPayments.length; i++) {
        const p = sortedPayments[i];
        try {
          const payment = await this.createPaymentInTx(tenantId, {
            monthlyDueId: p.monthlyDueId,
            treasuryId: data.treasuryId,
            amount: p.amount,
            paymentMethod: data.paymentMethod as any,
            notes: data.notes,
          }, userId, trx);
          created.push(payment);
        } catch (err: any) {
          // الرسالة بتوضح بالظبط أي فاتورة فشلت — والـ transaction كلها هترجع
          // (rollback) يعني ولا فاتورة من اللي "نجحت" قبلها هتتسجل فعلياً
          const failedNames = created.length > 0 ? ` (بعد نجاح ${created.length} فاتورة تم التراجع عنها تلقائياً)` : '';
          throw new AppError(
            err.code || 'COLLECT_FAILED',
            `فشل تحصيل الفاتورة رقم ${i + 1} من ${sortedPayments.length}: ${err.message}${failedNames}`,
            err.statusCode || 400,
          );
        }
      }
      return created;
    });

    // WhatsApp — بعد ما الـ transaction اتأكدت ونجحت بالكامل بس
    for (const payment of results) {
      this.sendPaymentConfirmNotification(tenantId, payment.studentId, payment.amount, payment.receiptNumber)
        .catch(err => this.logger.error('PAYMENT_CONFIRM WA failed: ' + err.message));
    }

    return results;
  }

  // ─── Stats ────────────────────────────────────────────────
  async getStats(tenantId: string, month: string) {
    return this.repo.getStats(tenantId, month);
  }

  // ─── WhatsApp: Payment Confirm ────────────────────────────
  private async sendPaymentConfirmNotification(
    tenantId: string,
    studentId: string,
    amount: number,
    receiptNumber: number,
  ): Promise<void> {
    const db = this.kysely.getTenantDb(tenantId);

    const studentRow = await db
      .selectFrom('students')
      .select(['full_name', 'parent_phone'])
      .where('id', '=', studentId as any)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (!studentRow?.parent_phone) {
      this.logger.debug(`No parent phone for student ${studentId} — skipping PAYMENT_CONFIRM`);
      return;
    }

    const centerSettings = await db
      .selectFrom('center_settings')
      .select(['center_name'])
      .executeTakeFirst();

    const today = new Date().toLocaleDateString('ar-EG', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const result = await this.sendNotification.execute({
      tenantId,
      phone: studentRow.parent_phone,
      templateKey: 'PAYMENT_CONFIRM',
      vars: {
        student_name: (studentRow as any).full_name,
        amount: amount.toString(),
        date: today,
        center_name: (centerSettings as any)?.center_name || 'المركز',
      },
    });

    this.logger.log(`PAYMENT_CONFIRM result for student ${studentId}: ${JSON.stringify(result)}`);
  }

  // ─── Cron: Auto Generate Dues ─────────────────────────────
  @Cron('0 0 1 * *')
  async autoGenerateDues() {
    // desktop mode — الـ cron شغال عادي
    this.logger.log('Auto generating monthly dues...');
    try {
      const tenants = await this.prisma.tenant.findMany({ where: { isActive: true } });
      const now = new Date();
      // نولد فواتير الشهر الحالي
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      let totalCreated = 0;
      let totalSkipped = 0;
      for (const tenant of tenants) {
        try {
          // بدون userId — بيتخزن created_by = NULL بدل محاولة تحويل نص 'system' لـ UUID (كان بيفشل قبل كده)
          const result = await this.generateDues(tenant.id, { month });
          totalCreated += result.created;
          totalSkipped += result.skipped;
          this.logger.log(`Tenant ${tenant.id}: ${result.created} created, ${result.skipped} skipped`);
        } catch (err: any) {
          this.logger.error(`Failed to generate dues for tenant ${tenant.id}: ${err.message}`);
        }
      }
      this.logger.log(`Auto dues done — total: ${totalCreated} created, ${totalSkipped} skipped across ${tenants.length} tenants`);
    } catch (err: any) {
      this.logger.error(`autoGenerateDues failed: ${err.message}`);
    }
  }
}
