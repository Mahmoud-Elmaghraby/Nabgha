import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Inject } from '@nestjs/common';
import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { TenantDatabase } from '@nabgha/db';
import { IFinanceRepository, FINANCE_REPOSITORY } from '../../domain/repositories/finance.repository.interface';
import { AppError } from '../../../../core/errors/app.error';
import { SendNotificationUseCase } from '../../../whatsapp/application/use-cases/send-notification.usecase';
import { TelegramNotifyUseCase } from '../../../telegram/application/use-cases/telegram-notify.usecase';
import { KyselyService } from "../../../../shared/infrastructure/database/kysely.service";
import { PrismaService } from "../../../../shared/infrastructure/database/prisma.service";
import type { PaymentEntity } from '../../domain/entities/finance.entity';
import { roundMoney } from '../../domain/entities/finance.entity';
import type {
  CreateTreasuryDto, UpdateTreasuryDto, GenerateDuesDto, UpdateDueDto,
  CreatePaymentDto, CancelPaymentDto, RefundPaymentDto, CreateManualDueDto,
  ListDuesDto, ListPaymentsDto, CreateExpenseDto, UpdateExpenseDto, ListExpensesDto,
  TransferBetweenTreasuriesDto,
} from '../dtos/finance.dto';

@Injectable()
export class FinanceUseCase implements OnApplicationBootstrap {
  private readonly logger = new Logger(FinanceUseCase.name);

  constructor(
    @Inject(FINANCE_REPOSITORY)
    private readonly repo: IFinanceRepository,
    private readonly sendNotification: SendNotificationUseCase,
    private readonly telegramNotify: TelegramNotifyUseCase,
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

      // insert ... on conflict do nothing — استعلام واحد بدل (فحص + إدخال) لكل طالب،
      // ومفيش فشل في النص لو التوليد التلقائي واليدوي اشتغلوا في نفس اللحظة
      const due = await this.repo.createDueIfAbsent(tenantId, {
        studentId: enrollment.studentId,
        subjectGradeId: enrollment.subjectGradeId,
        month: data.month,
        dueAmount: enrollment.fee,
        // الخصم مايزيدش عن السعر (لو حد كتب خصم أكبر من سعر المادة)
        discountApplied: Math.min(enrollment.discount, enrollment.fee),
        createdBy: userId,
      });
      if (due) created++;
      else skipped++;
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
    if (!due || due.status === 'paid' || due.status === 'waived' || due.status === 'cancelled') return;
    try {
      due.updateAmount(due.dueAmount, Math.min(discount, due.dueAmount));
    } catch (err: any) {
      // الخصم الجديد هيخلي المطلوب أقل من المدفوع فعلاً — نسيب فاتورة الشهر ده زي
      // ما هي (الخصم هيتطبق من الشهر الجاي) بدل ما نفشل تعديل الخصم نفسه
      this.logger.warn(`Discount not synced to due ${due.id}: ${err.message}`);
      return;
    }
    await this.repo.saveDue(tenantId, due);
  }

  async updateDue(tenantId: string, id: string, data: UpdateDueDto) {
    const due = await this.getDue(tenantId, id);
    if (due.status === 'paid') throw new AppError('INVALID_STATUS', 'لا يمكن تعديل فاتورة مدفوعة', 400);
    if (due.status === 'waived') throw new AppError('INVALID_STATUS', 'لا يمكن تعديل فاتورة معفاة', 400);
    if (due.status === 'cancelled') throw new AppError('INVALID_STATUS', 'لا يمكن تعديل فاتورة ملغاة', 400);
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
    if ((data.discountApplied ?? 0) > data.dueAmount) {
      throw new AppError('INVALID_AMOUNT', 'الخصم لا يمكن أن يكون أكبر من قيمة الفاتورة', 400);
    }
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
    if (due.status === 'cancelled') throw new AppError('INVALID_STATUS', 'الفاتورة ملغاة — لا يمكن سدادها', 400);
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

  // تعديل/حذف مصروف لازم ينعكس على رصيد الخزينة بقيد واضح — قبل كده كان بيعدّل
  // سجل المصروف بس، فرصيد الخزينة كان بيفضل ناقص (أو زايد) من غير أي حركة تفسّره
  async updateExpense(tenantId: string, id: string, data: UpdateExpenseDto, userId?: string) {
    return this.runInTransaction(tenantId, async (trx) => {
      const expense = await this.repo.findExpenseById(tenantId, id, { trx, forUpdate: true });
      if (!expense) throw new AppError('NOT_FOUND', 'المصروف غير موجود', 404);

      const oldAmount = roundMoney(expense.amount);
      const newAmount = data.amount !== undefined ? roundMoney(data.amount) : oldAmount;
      const diff = roundMoney(newAmount - oldAmount);

      if (diff !== 0) {
        const treasury = await this.getTreasuryLocked(tenantId, expense.treasuryId, trx);
        const balanceBefore = treasury.balance;
        if (diff > 0) {
          // المصروف زاد → الفرق يتخصم من الخزينة
          if (diff > treasury.balance) {
            throw new AppError('INSUFFICIENT_BALANCE', `رصيد الخزينة (${treasury.balance} جنيه) أقل من الزيادة في المصروف (${diff} جنيه)`, 400);
          }
          treasury.debit(diff);
        } else {
          // المصروف قل → الفرق يرجع للخزينة
          treasury.credit(-diff);
        }
        await this.repo.saveTreasury(tenantId, treasury, trx);
        await this.repo.createTransaction(tenantId, {
          treasuryId: treasury.id,
          type: diff > 0 ? 'expense' : 'expense_reversal',
          amount: Math.abs(diff),
          balanceBefore,
          balanceAfter: treasury.balance,
          notes: `تعديل مصروف: ${expense.title} (${oldAmount} ← ${newAmount})`,
          createdBy: userId,
        }, trx);
      }

      expense.update({
        ...data,
        ...(data.amount !== undefined ? { amount: newAmount } : {}),
        ...(data.expenseDate ? { expenseDate: new Date(data.expenseDate) } : {}),
      } as any);
      await this.repo.saveExpense(tenantId, expense, trx);
      return expense;
    });
  }

  async deleteExpense(tenantId: string, id: string, userId?: string) {
    await this.runInTransaction(tenantId, async (trx) => {
      const expense = await this.repo.findExpenseById(tenantId, id, { trx, forUpdate: true });
      if (!expense) throw new AppError('NOT_FOUND', 'المصروف غير موجود', 404);

      const treasury = await this.getTreasuryLocked(tenantId, expense.treasuryId, trx);
      const balanceBefore = treasury.balance;
      treasury.credit(expense.amount);

      expense.softDelete();
      await this.repo.saveExpense(tenantId, expense, trx);
      await this.repo.saveTreasury(tenantId, treasury, trx);
      await this.repo.createTransaction(tenantId, {
        treasuryId: treasury.id,
        type: 'expense_reversal',
        amount: expense.amount,
        balanceBefore,
        balanceAfter: treasury.balance,
        notes: `حذف مصروف: ${expense.title}`,
        createdBy: userId,
      }, trx);
    });
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
    // ⚠️ تصليح: التحصيل المتعدد (أكثر من مادة/فاتورة في عملية واحدة) كان بيبعت رسالة
    // "تم استلام مبلغ" منفصلة لكل فاتورة — ولي الأمر بيستلم 2-3 رسائل لدفعة واحدة.
    // دلوقتي رسالة واحدة لكل طالب بإجمالي المبلغ.
    const totalsByStudent = new Map<string, { amount: number; receipt: number }>();
    for (const payment of results) {
      const cur = totalsByStudent.get(payment.studentId);
      if (cur) cur.amount += Number(payment.amount);
      else totalsByStudent.set(payment.studentId, { amount: Number(payment.amount), receipt: payment.receiptNumber });
    }
    for (const [studentId, t] of totalsByStudent) {
      this.sendPaymentConfirmNotification(tenantId, studentId, t.amount, t.receipt)
        .catch(err => this.logger.error('PAYMENT_CONFIRM WA failed: ' + err.message));
    }

    return results;
  }

  // ─── Stats ────────────────────────────────────────────────
  async getStats(tenantId: string, month: string) {
    // الشهر جاي من query string — لو مش مبعوت أو صيغته غلط نستخدم الشهر الحالي بدل ما نوقع
    if (!month || !/^\d{4}-\d{2}$/.test(month)) month = this.currentMonth();
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

    // تليجرام — نداء إضافي مستقل، من غير أي تعديل على نداء الواتساب اللي فوق
    this.telegramNotify.execute({
      tenantId, entityType: 'student', entityId: studentId,
      templateKey: 'PAYMENT_CONFIRM',
      vars: {
        student_name: (studentRow as any).full_name,
        amount: amount.toString(),
        date: today,
        center_name: (centerSettings as any)?.center_name || 'المركز',
      },
    }).catch((err) => this.logger.error('Telegram PAYMENT_CONFIRM failed: ' + err.message));

    this.logger.log(`PAYMENT_CONFIRM result for student ${studentId}: ${JSON.stringify(result)}`);
  }

  /**
   * منع تكرار نفس الإشعار: بيشوف لو رسالة من نفس النوع اتبعتت (أو اتحطّت في الانتظار)
   * لنفس ولي الأمر/الطالب خلال آخر N ساعة — على الواتساب أو التليجرام.
   */
  private async alreadyNotified(
    db: Kysely<TenantDatabase>,
    phone: string,
    studentId: string,
    studentName: string,
    templateKey: string,
    withinHours: number,
  ): Promise<boolean> {
    try {
      const since = new Date(Date.now() - withinHours * 3600 * 1000);
      const wa = await db
        .selectFrom('wa_messages_log' as any)
        .select('id' as any)
        .where('phone' as any, '=', phone)
        .where('template_key' as any, '=', templateKey)
        .where('body' as any, 'like', `%${studentName}%`)
        .where('created_at' as any, '>=', since)
        .limit(1)
        .executeTakeFirst();
      if (wa) return true;
      const tg = await db
        .selectFrom('telegram_messages' as any)
        .select('id' as any)
        .where('entity_id' as any, '=', studentId)
        .where('template_key' as any, '=', templateKey)
        .where('created_at' as any, '>=', since)
        .limit(1)
        .executeTakeFirst();
      return !!tg;
    } catch (err: any) {
      this.logger.warn(`alreadyNotified check failed: ${err.message}`);
      return false;
    }
  }

  // ─── Cron: Payment Due Reminders ──────────────────────────
  /**
   * يعمل كل يوم الساعة 10 صباحاً (Cairo time = 8 UTC).
   * يبحث عن الفواتير:
   *   - المستحقة خلال 7 أيام → PAYMENT_DUE (days=7)
   *   - المستحقة خلال يوم    → PAYMENT_DUE (days=1)
   *   - المتأخرة أكثر من 3 أيام → PAYMENT_OVERDUE
   * يبعت واتساب فقط لو الإعداد المقابل مفعّل في wa_settings.
   */
  // كل ساعة من 10 الصبح لـ 8 بالليل (بتوقيت الجهاز) بدل مرة واحدة الساعة 10:
  // معظم السناتر بتفتح الجهاز بعد الضهر، فالميعاد الواحد كان بيعدّي والجهاز مقفول
  // والتذكير مايتبعتش خالص. التكرار آمن لإن alreadyNotified بيمنع إرسال نفس التذكير
  // لنفس الطالب أكتر من مرة (20 ساعة للمستحق، 7 أيام للمتأخر).
  @Cron('0 10-20 * * *')
  async sendPaymentReminders(): Promise<void> {
    this.logger.log('🔔 Starting payment due reminders...');
    try {
      const tenants = await this.prisma.tenant.findMany({ where: { isActive: true } });

      for (const tenant of tenants) {
        try {
          await this.sendPaymentRemindersForTenant(tenant.id);
        } catch (err: any) {
          this.logger.error(`Payment reminders failed for tenant ${tenant.id}: ${err.message}`);
        }
      }
    } catch (err: any) {
      this.logger.error(`sendPaymentReminders cron failed: ${err.message}`);
    }
  }

  private async sendPaymentRemindersForTenant(tenantId: string): Promise<void> {
    const db = this.kysely.getTenantDb(tenantId);

    // جلب إعدادات المركز
    const centerSettings = await db
      .selectFrom('center_settings')
      .select(['center_name'])
      .executeTakeFirst();
    const centerName = (centerSettings as any)?.center_name || 'المركز';

    // ── تذكير 7 أيام ─────────────────────────────────────────
    // ⚠️ تصليح (Oct 2026): كان بيجيب كل فواتير الشهر اللي بيقع فيه (النهارده + 7 أيام)
    // وبيبعت "باقي 7 أيام" **كل يوم** لكل ولي أمر عليه فاتورة — تكرار يومي لنفس الرسالة.
    // موعد استحقاق فاتورة الشهر = أول يوم فيه، فالتذكير بيتبعت مرة واحدة بس: لما يكون
    // (النهارده + 7) أو (النهارده + 1) هو يوم 1 من الشهر ده بالظبط.
    const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const sevenDaysStr = monthKey(sevenDaysFromNow);
    const isDue7Today = sevenDaysFromNow.getDate() === 1;

    const dues7d = !isDue7Today ? [] : await db
      .selectFrom('monthly_dues as d')
      .innerJoin('students as s', 's.id', 'd.student_id')
      .select(['d.id', 'd.student_id', 'd.due_amount', 'd.paid_amount', 'd.discount_applied', 'd.month',
               's.full_name as student_name', 's.parent_phone'])
      .where('d.status', 'in', ['unpaid', 'partial'])
      .where('d.month', '=', sevenDaysStr)
      .where('s.parent_phone', 'is not', null)
      .where('s.deleted_at', 'is', null)
      .where('s.is_active', '=', true)
      .execute();

    for (const due of dues7d) {
      const remaining = Math.max(0, Number(due.due_amount) - Number(due.discount_applied ?? 0) - Number(due.paid_amount));
      if (remaining <= 0) continue;
      if (await this.alreadyNotified(db, (due as any).parent_phone, due.student_id as string, (due as any).student_name, 'PAYMENT_DUE', 20)) continue;
      await this.sendNotification.execute({
        tenantId,
        phone: (due as any).parent_phone,
        templateKey: 'PAYMENT_DUE',
        vars: {
          student_name: (due as any).student_name,
          amount: remaining.toString(),
          days: '7',
          center_name: centerName,
        },
      }).catch((err) => this.logger.warn(`PAYMENT_DUE 7d failed for ${due.student_id}: ${err.message}`));
      this.telegramNotify.execute({
        tenantId, entityType: 'student', entityId: due.student_id as string,
        templateKey: 'PAYMENT_DUE',
        vars: {
          student_name: (due as any).student_name,
          amount: remaining.toString(),
          days: '7',
          center_name: centerName,
        },
      }).catch((err) => this.logger.error(`Telegram PAYMENT_DUE 7d failed for ${due.student_id}: ${err.message}`));
    }

    // ── تذكير يوم واحد ───────────────────────────────────────
    const oneDayFromNow = new Date();
    oneDayFromNow.setDate(oneDayFromNow.getDate() + 1);
    const oneDayStr = monthKey(oneDayFromNow);

    if (oneDayFromNow.getDate() === 1) {
      const dues1d = await db
        .selectFrom('monthly_dues as d')
        .innerJoin('students as s', 's.id', 'd.student_id')
        .select(['d.id', 'd.student_id', 'd.due_amount', 'd.paid_amount', 'd.discount_applied', 'd.month',
                 's.full_name as student_name', 's.parent_phone'])
        .where('d.status', 'in', ['unpaid', 'partial'])
        .where('d.month', '=', oneDayStr)
        .where('s.parent_phone', 'is not', null)
      .where('s.deleted_at', 'is', null)
      .where('s.is_active', '=', true)
        .execute();

      for (const due of dues1d) {
        const remaining = Math.max(0, Number(due.due_amount) - Number(due.discount_applied ?? 0) - Number(due.paid_amount));
        if (remaining <= 0) continue;
        if (await this.alreadyNotified(db, (due as any).parent_phone, due.student_id as string, (due as any).student_name, 'PAYMENT_DUE', 20)) continue;
        await this.sendNotification.execute({
          tenantId,
          phone: (due as any).parent_phone,
          templateKey: 'PAYMENT_DUE',
          vars: {
            student_name: (due as any).student_name,
            amount: remaining.toString(),
            days: '1',
            center_name: centerName,
          },
        }).catch((err) => this.logger.warn(`PAYMENT_DUE 1d failed for ${due.student_id}: ${err.message}`));
        this.telegramNotify.execute({
          tenantId, entityType: 'student', entityId: due.student_id as string,
          templateKey: 'PAYMENT_DUE',
          vars: {
            student_name: (due as any).student_name,
            amount: remaining.toString(),
            days: '1',
            center_name: centerName,
          },
        }).catch((err) => this.logger.error(`Telegram PAYMENT_DUE 1d failed for ${due.student_id}: ${err.message}`));
      }
    }

    // ── متأخرة (overdue) ──────────────────────────────────────
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    // الفواتير المتأخرة = الشهور الماضية + الشهر الحالي لو تجاوزنا اليوم 5
    const overdueMonths: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      overdueMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    const overdues = await db
      .selectFrom('monthly_dues as d')
      .innerJoin('students as s', 's.id', 'd.student_id')
      .select(['d.id', 'd.student_id', 'd.due_amount', 'd.paid_amount', 'd.discount_applied', 'd.month',
               's.full_name as student_name', 's.parent_phone'])
      .where('d.status', 'in', ['unpaid', 'partial'])
      .where('d.month', 'in', overdueMonths)
      .where('s.parent_phone', 'is not', null)
      .where('s.deleted_at', 'is', null)
      .where('s.is_active', '=', true)
      .execute();

    for (const due of overdues) {
      const remaining = Math.max(0, Number(due.due_amount) - Number(due.discount_applied ?? 0) - Number(due.paid_amount));
      if (remaining <= 0) continue;
      // ⚠️ تصليح: كان بيتبعت كل يوم لكل فاتورة متأخرة — دلوقتي مرة كل 7 أيام بس لكل طالب
      if (await this.alreadyNotified(db, (due as any).parent_phone, due.student_id as string, (due as any).student_name, 'PAYMENT_OVERDUE', 24 * 7)) continue;
      const dueMonth = new Date((due as any).month + '-01');
      const daysOverdue = Math.floor((now.getTime() - dueMonth.getTime()) / (1000 * 60 * 60 * 24));
      await this.sendNotification.execute({
        tenantId,
        phone: (due as any).parent_phone,
        templateKey: 'PAYMENT_OVERDUE',
        vars: {
          student_name: (due as any).student_name,
          amount: remaining.toString(),
          days: daysOverdue.toString(),
          center_name: centerName,
        },
      }).catch((err) => this.logger.warn(`PAYMENT_OVERDUE failed for ${due.student_id}: ${err.message}`));
      this.telegramNotify.execute({
        tenantId, entityType: 'student', entityId: due.student_id as string,
        templateKey: 'PAYMENT_OVERDUE',
        vars: {
          student_name: (due as any).student_name,
          amount: remaining.toString(),
          days: daysOverdue.toString(),
          center_name: centerName,
        },
      }).catch((err) => this.logger.error(`Telegram PAYMENT_OVERDUE failed for ${due.student_id}: ${err.message}`));
    }

    this.logger.log(
      `Payment reminders done for tenant ${tenantId} — 7d: ${dues7d.length}, overdue: ${overdues.length}`,
    );
  }

  // ─── Cron: Auto Generate Dues ─────────────────────────────
  // قبل كده كان بيشتغل مرة واحدة بس الساعة 12 بالليل يوم 1 في الشهر — ولو الجهاز
  // مقفول في اللحظة دي (الطبيعي في سناتر الديسكتوب) فواتير الشهر ماكانتش بتتولد خالص.
  // دلوقتي: بيتشيك كل ساعة + بعد تشغيل البرنامج بدقيقة، وبيولّد مرة واحدة بس لكل شهر
  // لكل مركز (متسجلة في tenant_settings)، فمفيش فواتير بتتولد تاني للطلاب اللي
  // اتضافوا في نص الشهر (دول ليهم الفاتورة اليدوية زي ما هو).
  private static readonly AUTO_DUES_KEY = 'finance_auto_dues_last_month';
  private autoDuesRunning = false;

  private currentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  onApplicationBootstrap() {
    // بعد دقيقة من التشغيل عشان قاعدة البيانات والموديولات التانية تكون جاهزة
    setTimeout(() => {
      this.autoGenerateDues().catch((err) => this.logger.error(`Startup dues catch-up failed: ${err.message}`));
    }, 60_000).unref();
  }

  @Cron('5 * * * *')
  async autoGenerateDues() {
    if (this.autoDuesRunning) return;
    this.autoDuesRunning = true;
    try {
      const tenants = await this.prisma.tenant.findMany({ where: { isActive: true } });
      const month = this.currentMonth();
      for (const tenant of tenants) {
        try {
          const db = this.kysely.getTenantDb(tenant.id);
          const last = await db.selectFrom('tenant_settings').select('value')
            .where('key', '=', FinanceUseCase.AUTO_DUES_KEY)
            .executeTakeFirst();
          if (last?.value === month) continue;

          const markDone = () => db.insertInto('tenant_settings')
            .values({ key: FinanceUseCase.AUTO_DUES_KEY, value: month, updated_at: new Date() } as any)
            .onConflict((oc) => oc.column('key').doUpdateSet({ value: month, updated_at: new Date() } as any))
            .execute();

          // أول مرة بعد التحديث (مفيش سجل): لو فواتير الشهر ده اتولدت قبل كده (يدوي أو
          // بالـ cron القديم) نسجّل الشهر بس ومانولّدش، عشان الطلاب اللي اتضافوا في نص
          // الشهر مايتعملهمش فاتورة شهر كامل فجأة
          if (!last) {
            const existing = await db.selectFrom('monthly_dues')
              .select(sql<string>`COUNT(*)`.as('count'))
              .where('month', '=', month)
              .where('status', '!=', 'cancelled' as any)
              .executeTakeFirst();
            if (Number(existing?.count ?? 0) > 0) {
              await markDone();
              continue;
            }
          }

          // بدون userId — بيتخزن created_by = NULL بدل محاولة تحويل نص 'system' لـ UUID
          const result = await this.generateDues(tenant.id, { month });

          await markDone();
          this.logger.log(`Auto dues ${month} — tenant ${tenant.id}: ${result.created} created, ${result.skipped} skipped`);
        } catch (err: any) {
          this.logger.error(`Failed to generate dues for tenant ${tenant.id}: ${err.message}`);
        }
      }
    } catch (err: any) {
      this.logger.error(`autoGenerateDues failed: ${err.message}`);
    } finally {
      this.autoDuesRunning = false;
    }
  }
}
