// ─── Treasury ─────────────────────────────────────────────
export type TreasuryType = 'cash' | 'bank' | 'vodafone' | 'instapay' | 'other';

export class TreasuryEntity {
  constructor(
    public readonly id: string,
    public name: string,
    public type: TreasuryType,
    public balance: number,
    public isActive: boolean,
    public notes: string | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
    public deletedAt: Date | null,
  ) {}

  credit(amount: number): void {
    this.balance += amount;
    this.updatedAt = new Date();
  }

  debit(amount: number): void {
    if (amount > this.balance) throw new Error('رصيد الخزينة غير كافي');
    this.balance -= amount;
    this.updatedAt = new Date();
  }

  update(data: Partial<{ name: string; type: TreasuryType; notes: string; isActive: boolean }>): void {
    Object.assign(this, data);
    this.updatedAt = new Date();
  }

  softDelete(): void {
    this.deletedAt = new Date();
    this.updatedAt = new Date();
  }
}

// ─── Monthly Due ──────────────────────────────────────────
export type DueStatus = 'unpaid' | 'partial' | 'paid' | 'waived' | 'cancelled';

export class MonthlyDueEntity {
  constructor(
    public readonly id: string,
    public readonly studentId: string,
    public readonly subjectGradeId: string,
    public readonly month: string,
    public dueAmount: number,
    public discountApplied: number,
    public paidAmount: number,
    public status: DueStatus,
    public notes: string | null,
    public readonly createdBy: string | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
    // joined
    public readonly studentName?: string,
    public readonly studentCode?: string,
    public readonly subjectName?: string,
    public readonly gradeName?: string,
  ) {}

  get remainingAmount(): number {
    return Math.max(0, this.dueAmount - this.discountApplied - this.paidAmount);
  }

  get netDueAmount(): number {
    return Math.max(0, this.dueAmount - this.discountApplied);
  }

  addPayment(amount: number): void {
    this.paidAmount += amount;
    if (this.paidAmount >= this.netDueAmount) {
      this.status = 'paid';
    } else if (this.paidAmount > 0) {
      this.status = 'partial';
    }
    this.updatedAt = new Date();
  }

  reversePayment(amount: number): void {
    this.paidAmount = Math.max(0, this.paidAmount - amount);
    if (this.paidAmount === 0) {
      this.status = 'unpaid';
    } else {
      this.status = 'partial';
    }
    this.updatedAt = new Date();
  }

  waive(): void {
    this.status = 'waived';
    this.updatedAt = new Date();
  }

  updateAmount(dueAmount: number, discountApplied: number): void {
    this.dueAmount = dueAmount;
    this.discountApplied = discountApplied;
    // إعادة حساب الحالة — تعديل المبلغ ممكن يخلي المدفوع يغطي الفاتورة الجديدة أو العكس
    if (this.status !== 'waived') {
      if (this.paidAmount > 0 && this.paidAmount >= this.netDueAmount) {
        this.status = 'paid';
      } else if (this.paidAmount > 0) {
        this.status = 'partial';
      } else {
        this.status = 'unpaid';
      }
    }
    this.updatedAt = new Date();
  }

  softDelete(): void {
    // لا يجوز حذف فاتورة بها سداد — الحذف مسموح فقط لـ unpaid
    if (this.status !== 'unpaid') {
      throw new Error('لا يمكن حذف فاتورة إلا إذا كانت غير مدفوعة — ألغِ السداد أولاً ثم احذف الفاتورة');
    }
    this.status = 'cancelled';
    this.updatedAt = new Date();
  }
}

// ─── Payment ──────────────────────────────────────────────
export type PaymentMethod = 'cash' | 'visa' | 'instapay' | 'vodafone' | 'bank' | 'other';
export type PaymentStatus = 'paid' | 'cancelled' | 'refunded' | 'partial_refund';

export class PaymentEntity {
  constructor(
    public readonly id: string,
    public readonly studentId: string,
    public readonly monthlyDueId: string,
    public readonly treasuryId: string,
    public amount: number,
    public paymentMethod: PaymentMethod,
    public readonly receiptNumber: number,
    public status: PaymentStatus,
    public cancelReason: string | null,
    public refundAmount: number | null,
    public notes: string | null,
    public readonly createdBy: string | null,
    public readonly paidAt: Date,
    public readonly createdAt: Date,
    public updatedAt: Date,
    // joined
    public readonly studentName?: string,
    public readonly studentCode?: string,
    public readonly subjectName?: string,
    public readonly month?: string,
    public readonly treasuryName?: string,
    // خصم الفاتورة (monthly_dues.discount_applied) وقت الدفع — مفيد لعرضه في
    // الإيصال المطبوع، رغم إنه مش عمود على payments نفسه (بيتم جلبه بـ join)
    public readonly discountApplied?: number,
  ) {}

  cancel(reason: string): void {
    this.status = 'cancelled';
    this.cancelReason = reason;
    this.updatedAt = new Date();
  }

  refund(amount: number): void {
    this.refundAmount = amount;
    this.status = amount >= this.amount ? 'refunded' : 'partial_refund';
    this.updatedAt = new Date();
  }
}

// ─── Payment Transaction ──────────────────────────────────
export type TransactionType = 'income' | 'cancellation' | 'refund' | 'expense' | 'transfer_in' | 'transfer_out';

export class PaymentTransactionEntity {
  constructor(
    public readonly id: string,
    public readonly paymentId: string | null,
    public readonly treasuryId: string,
    public readonly type: TransactionType,
    public readonly amount: number,
    public readonly balanceBefore: number,
    public readonly balanceAfter: number,
    public readonly notes: string | null,
    public readonly createdBy: string | null,
    public readonly createdAt: Date,
    public readonly relatedTreasuryId?: string | null,
    // joined
    public readonly treasuryName?: string,
    public readonly relatedTreasuryName?: string,
  ) {}
}

// ─── Expense ──────────────────────────────────────────────
export type ExpenseCategory = 'electricity' | 'water' | 'gas' | 'rent' | 'salary' | 'maintenance' | 'supplies' | 'other';

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  electricity: 'كهرباء',
  water:       'مياه',
  gas:         'غاز',
  rent:        'إيجار',
  salary:      'مرتبات',
  maintenance: 'صيانة',
  supplies:    'نثريات',
  other:       'أخرى',
};

export class ExpenseEntity {
  constructor(
    public readonly id: string,
    public readonly treasuryId: string,
    public category: ExpenseCategory,
    public title: string,
    public amount: number,
    public expenseDate: Date,
    public notes: string | null,
    public readonly createdBy: string | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
    public deletedAt: Date | null,
    public readonly treasuryName?: string,
  ) {}

  update(data: Partial<{ category: ExpenseCategory; title: string; amount: number; expenseDate: Date; notes: string }>): void {
    Object.assign(this, data);
    this.updatedAt = new Date();
  }

  softDelete(): void {
    this.deletedAt = new Date();
    this.updatedAt = new Date();
  }
}
