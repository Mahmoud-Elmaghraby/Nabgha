import { z } from 'zod';

// ─── Treasury DTOs ────────────────────────────────────────
export const CreateTreasurySchema = z.object({
  name: z.string().min(1, 'اسم الخزينة مطلوب'),
  type: z.enum(['cash', 'bank', 'vodafone', 'instapay', 'other']),
  notes: z.string().optional(),
});

export const UpdateTreasurySchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['cash', 'bank', 'vodafone', 'instapay', 'other']).optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
});

// ─── Monthly Due DTOs ─────────────────────────────────────
export const GenerateDuesSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'صيغة الشهر غير صحيحة (YYYY-MM)'),
});

export const UpdateDueSchema = z.object({
  dueAmount: z.number().min(0).optional(),
  discountApplied: z.number().min(0).optional(),
  notes: z.string().optional(),
});

export const WaiveDueSchema = z.object({
  notes: z.string().optional(),
});

export const ListDuesSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  studentId: z.string().uuid().optional(),
  subjectGradeId: z.string().uuid().optional(),
  status: z.enum(['unpaid', 'partial', 'paid', 'waived']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ─── Manual Due (فاتورة يدوية — تسجيل مقدم / دفعة في نص الشهر) ─────
export const CreateManualDueSchema = z.object({
  studentId: z.string().uuid('طالب غير صحيح'),
  subjectGradeId: z.string().uuid('مادة غير صحيحة'),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'صيغة الشهر غير صحيحة (YYYY-MM)'),
  dueAmount: z.number().min(0, 'المبلغ لا يمكن أن يكون سالباً'),
  notes: z.string().optional(),
});

// ─── Payment DTOs ─────────────────────────────────────────
export const CreatePaymentSchema = z.object({
  monthlyDueId: z.string().uuid('فاتورة غير صحيحة'),
  treasuryId: z.string().uuid('خزينة غير صحيحة'),
  amount: z.number().positive('المبلغ يجب أن يكون أكبر من صفر'),
  paymentMethod: z.enum(['cash', 'visa', 'instapay', 'vodafone', 'bank', 'other']),
  notes: z.string().optional(),
});

export const CancelPaymentSchema = z.object({
  reason: z.string().min(1, 'سبب الإلغاء مطلوب'),
});

export const RefundPaymentSchema = z.object({
  amount: z.number().positive('مبلغ الاسترجاع يجب أن يكون أكبر من صفر'),
  notes: z.string().optional(),
});

export const CollectMultiSchema = z.object({
  payments: z.array(z.object({
    monthlyDueId: z.string().uuid(),
    amount: z.number().positive(),
  })).min(1, 'يجب اختيار فاتورة واحدة على الأقل'),
  treasuryId: z.string().uuid('خزينة غير صحيحة'),
  paymentMethod: z.enum(['cash', 'visa', 'instapay', 'vodafone', 'bank', 'other']),
  notes: z.string().optional(),
});

export const ListPaymentsSchema = z.object({
  studentId: z.string().uuid().optional(),
  treasuryId: z.string().uuid().optional(),
  status: z.enum(['paid', 'cancelled', 'refunded', 'partial_refund']).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ─── Expense DTOs ─────────────────────────────────────────
export const CreateExpenseSchema = z.object({
  treasuryId: z.string().uuid('خزينة غير صحيحة'),
  category: z.enum(['electricity', 'water', 'gas', 'rent', 'salary', 'maintenance', 'supplies', 'other']),
  title: z.string().min(1, 'عنوان المصروف مطلوب'),
  amount: z.number().positive('المبلغ يجب أن يكون أكبر من صفر'),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().optional(),
});

export const UpdateExpenseSchema = z.object({
  category: z.enum(['electricity', 'water', 'gas', 'rent', 'salary', 'maintenance', 'supplies', 'other']).optional(),
  title: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().optional(),
});

export const ListExpensesSchema = z.object({
  treasuryId: z.string().uuid().optional(),
  category: z.enum(['electricity', 'water', 'gas', 'rent', 'salary', 'maintenance', 'supplies', 'other']).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ─── Types ────────────────────────────────────────────────
export type CreateManualDueDto     = z.infer<typeof CreateManualDueSchema>;
export type CreateTreasuryDto     = z.infer<typeof CreateTreasurySchema>;
export type UpdateTreasuryDto     = z.infer<typeof UpdateTreasurySchema>;
export type GenerateDuesDto       = z.infer<typeof GenerateDuesSchema>;
export type UpdateDueDto          = z.infer<typeof UpdateDueSchema>;
export type ListDuesDto           = z.infer<typeof ListDuesSchema>;
export type CreatePaymentDto      = z.infer<typeof CreatePaymentSchema>;
export type CancelPaymentDto      = z.infer<typeof CancelPaymentSchema>;
export type RefundPaymentDto      = z.infer<typeof RefundPaymentSchema>;
export type ListPaymentsDto       = z.infer<typeof ListPaymentsSchema>;
export type CollectMultiDto       = z.infer<typeof CollectMultiSchema>;
export type CreateExpenseDto      = z.infer<typeof CreateExpenseSchema>;
export type UpdateExpenseDto      = z.infer<typeof UpdateExpenseSchema>;
export type ListExpensesDto       = z.infer<typeof ListExpensesSchema>;
