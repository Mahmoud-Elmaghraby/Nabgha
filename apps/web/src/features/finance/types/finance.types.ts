export type TreasuryType = 'cash' | 'bank' | 'vodafone' | 'instapay' | 'other';
export const TREASURY_TYPE_LABELS: Record<TreasuryType, string> = {
  cash: 'كاش', bank: 'بنك', vodafone: 'فودافون كاش', instapay: 'إنستاباي', other: 'أخرى',
};
export interface Treasury {
  id: string; name: string; type: TreasuryType; balance: number;
  isActive: boolean; notes: string | null; createdAt: string; updatedAt: string;
}
export type DueStatus = 'unpaid' | 'partial' | 'paid' | 'waived';
export const DUE_STATUS_LABELS: Record<DueStatus, { label: string; class: string }> = {
  unpaid:  { label: 'غير مدفوع', class: 'bg-red-50 text-red-600 border-red-200' },
  partial: { label: 'جزئي',      class: 'bg-amber-50 text-amber-600 border-amber-200' },
  paid:    { label: 'مدفوع',     class: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  waived:  { label: 'معفى',      class: 'bg-gray-50 text-gray-500 border-gray-200' },
};
export interface MonthlyDue {
  id: string; studentId: string; subjectGradeId: string; month: string;
  dueAmount: number; discountApplied: number; paidAmount: number; status: DueStatus;
  notes: string | null; createdAt: string; updatedAt: string;
  studentName?: string; studentCode?: string; subjectName?: string; gradeName?: string;
}
export type PaymentMethod = 'cash' | 'visa' | 'instapay' | 'vodafone' | 'bank' | 'other';
export type PaymentStatus = 'paid' | 'cancelled' | 'refunded' | 'partial_refund';
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'كاش', visa: 'فيزا', instapay: 'إنستاباي', vodafone: 'فودافون كاش', bank: 'تحويل بنكي', other: 'أخرى',
};
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, { label: string; class: string }> = {
  paid:           { label: 'مدفوع',        class: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  cancelled:      { label: 'ملغي',         class: 'bg-red-50 text-red-600 border-red-200' },
  refunded:       { label: 'مسترجع',       class: 'bg-orange-50 text-orange-600 border-orange-200' },
  partial_refund: { label: 'مسترجع جزئي', class: 'bg-amber-50 text-amber-600 border-amber-200' },
};
export interface Payment {
  id: string; studentId: string; monthlyDueId: string; treasuryId: string;
  amount: number; paymentMethod: PaymentMethod; receiptNumber: number; status: PaymentStatus;
  cancelReason: string | null; refundAmount: number | null; notes: string | null;
  paidAt: string; createdAt: string;
  studentName?: string; studentCode?: string; subjectName?: string; month?: string; treasuryName?: string;
}
export type ExpenseCategory = 'electricity' | 'water' | 'gas' | 'rent' | 'salary' | 'maintenance' | 'supplies' | 'other';
export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, { label: string; icon: string }> = {
  electricity: { label: 'كهرباء', icon: '⚡' }, water: { label: 'مياه', icon: '💧' },
  gas: { label: 'غاز', icon: '🔥' }, rent: { label: 'إيجار', icon: '🏠' },
  salary: { label: 'مرتبات', icon: '👥' }, maintenance: { label: 'صيانة', icon: '🔧' },
  supplies: { label: 'نثريات', icon: '📦' }, other: { label: 'أخرى', icon: '📝' },
};
export interface Expense {
  id: string; treasuryId: string; category: ExpenseCategory; title: string;
  amount: number; expenseDate: string; notes: string | null; createdAt: string; treasuryName?: string;
}
export interface FinanceStats {
  totalDues: number; totalCollected: number; totalPending: number;
  totalExpenses: number; duesCount: number; paidCount: number; unpaidCount: number;
}
export interface CreateManualDuePayload {
  studentId: string;
  subjectGradeId: string;
  month: string;
  dueAmount: number;
  notes?: string;
}

export interface ListDuesParams { month?: string; studentId?: string; status?: DueStatus; page?: number; limit?: number; }
export interface ListPaymentsParams { studentId?: string; treasuryId?: string; status?: PaymentStatus; from?: string; to?: string; page?: number; limit?: number; }
export interface ListExpensesParams { treasuryId?: string; category?: ExpenseCategory; from?: string; to?: string; page?: number; limit?: number; }
