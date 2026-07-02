import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Inject } from '@nestjs/common';
import { IFinanceRepository, FINANCE_REPOSITORY } from '../../domain/repositories/finance.repository.interface';
import { AppError } from '../../../../core/errors/app.error';
import { SendNotificationUseCase } from '../../../whatsapp/application/use-cases/send-notification.usecase';
import { KyselyService } from "../../../../shared/infrastructure/database/kysely.service";
import { PrismaService } from "../../../../shared/infrastructure/database/prisma.service";
import type {
  CreateTreasuryDto, UpdateTreasuryDto, GenerateDuesDto, UpdateDueDto,
  CreatePaymentDto, CancelPaymentDto, RefundPaymentDto, CreateManualDueDto,
  ListDuesDto, ListPaymentsDto, CreateExpenseDto, UpdateExpenseDto, ListExpensesDto,
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
      discountApplied: 0,
      notes: data.notes,
      createdBy: userId,
    });
    this.logger.log(`Manual due created: ${due.id} — student: ${data.studentId} — amount: ${data.dueAmount}`);
    return due;
  }

  async waiveDue(tenantId: string, id: string, notes?: string) {
    const due = await this.getDue(tenantId, id);
    if (due.status === 'paid') throw new AppError('INVALID_STATUS', 'الفاتورة مدفوعة بالفعل', 400);
    if (due.paidAmount > 0) {
      throw new AppError('INVALID_STATUS', 'لا يمكن إعفاء فاتورة تم تحصيل مبلغ منها بالفعل — استخدم استرجاع الدفعة بدلاً من ذلك', 400);
    }
    due.waive();
    if (notes) due.notes = notes;
    await this.repo.saveDue(tenantId, due);
    return due;
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

  async createPayment(tenantId: string, data: CreatePaymentDto, userId: string) {
    const due = await this.getDue(tenantId, data.monthlyDueId);
    const treasury = await this.getTreasury(tenantId, data.treasuryId);

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
    });

    await Promise.all([
      this.repo.saveTreasury(tenantId, treasury),
      this.repo.saveDue(tenantId, due),
      this.repo.createTransaction(tenantId, {
        paymentId: payment.id,
        treasuryId: treasury.id,
        type: 'income',
        amount: data.amount,
        balanceBefore,
        balanceAfter: treasury.balance,
        createdBy: userId,
      }),
    ]);

    this.logger.log(`Payment created: ${payment.id} — amount: ${data.amount} — receipt: #${payment.receiptNumber}`);

    // WhatsApp notification — fire and forget
    this.sendPaymentConfirmNotification(tenantId, due.studentId, data.amount, payment.receiptNumber)
      .catch(err => this.logger.error('PAYMENT_CONFIRM WA failed: ' + err.message));

    return payment;
  }

  async cancelPayment(tenantId: string, id: string, data: CancelPaymentDto, userId: string) {
    const payment = await this.getPayment(tenantId, id);
    if (payment.status !== 'paid') throw new AppError('INVALID_STATUS', 'لا يمكن إلغاء هذا الإيصال', 400);

    const due = await this.getDue(tenantId, payment.monthlyDueId);
    const treasury = await this.getTreasury(tenantId, payment.treasuryId);

    if (payment.amount > treasury.balance) {
      throw new AppError('INSUFFICIENT_BALANCE', `رصيد الخزينة الحالي (${treasury.balance} جنيه) أقل من مبلغ الإيصال — لا يمكن الإلغاء الآن`, 400);
    }

    const balanceBefore = treasury.balance;
    treasury.debit(payment.amount);
    due.reversePayment(payment.amount);
    payment.cancel(data.reason);

    await Promise.all([
      this.repo.savePayment(tenantId, payment),
      this.repo.saveDue(tenantId, due),
      this.repo.saveTreasury(tenantId, treasury),
      this.repo.createTransaction(tenantId, {
        paymentId: payment.id,
        treasuryId: treasury.id,
        type: 'cancellation',
        amount: payment.amount,
        balanceBefore,
        balanceAfter: treasury.balance,
        notes: data.reason,
        createdBy: userId,
      }),
    ]);

    return payment;
  }

  async refundPayment(tenantId: string, id: string, data: RefundPaymentDto, userId: string) {
    const payment = await this.getPayment(tenantId, id);
    if (payment.status === 'cancelled') throw new AppError('INVALID_STATUS', 'الإيصال ملغي', 400);
    if (payment.status === 'refunded') throw new AppError('INVALID_STATUS', 'تم الاسترجاع بالفعل', 400);
    if (data.amount > payment.amount) throw new AppError('AMOUNT_EXCEEDED', 'مبلغ الاسترجاع يتجاوز مبلغ الإيصال', 400);

    const due = await this.getDue(tenantId, payment.monthlyDueId);
    const treasury = await this.getTreasury(tenantId, payment.treasuryId);

    if (data.amount > treasury.balance) {
      throw new AppError('INSUFFICIENT_BALANCE', `رصيد الخزينة الحالي (${treasury.balance} جنيه) أقل من مبلغ الاسترجاع المطلوب`, 400);
    }

    const balanceBefore = treasury.balance;
    treasury.debit(data.amount);
    due.reversePayment(data.amount);
    payment.refund(data.amount);

    await Promise.all([
      this.repo.savePayment(tenantId, payment),
      this.repo.saveDue(tenantId, due),
      this.repo.saveTreasury(tenantId, treasury),
      this.repo.createTransaction(tenantId, {
        paymentId: payment.id,
        treasuryId: treasury.id,
        type: 'refund',
        amount: data.amount,
        balanceBefore,
        balanceAfter: treasury.balance,
        notes: data.notes,
        createdBy: userId,
      }),
    ]);

    return payment;
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
    const treasury = await this.getTreasury(tenantId, data.treasuryId);
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
    });

    await Promise.all([
      this.repo.saveTreasury(tenantId, treasury),
      this.repo.createTransaction(tenantId, {
        treasuryId: treasury.id,
        type: 'expense',
        amount: data.amount,
        balanceBefore,
        balanceAfter: treasury.balance,
        notes: data.title,
        createdBy: userId,
      }),
    ]);

    return expense;
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
    const results = [];
    for (const p of data.payments) {
      const payment = await this.createPayment(tenantId, {
        monthlyDueId: p.monthlyDueId,
        treasuryId: data.treasuryId,
        amount: p.amount,
        paymentMethod: data.paymentMethod as any,
        notes: data.notes,
      }, userId);
      results.push(payment);
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
