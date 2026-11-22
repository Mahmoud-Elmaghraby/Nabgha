-- Migration 025: نوع حركة جديد expense_reversal
-- تعديل مبلغ مصروف بالنقص أو حذف مصروف لازم يرجّع الفرق للخزينة بقيد واضح،
-- بدل ما رصيد الخزينة يفضل ناقص من غير سبب (كان بيحصل قبل كده).
-- Added: Nov 2026

ALTER TABLE payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_type_check;

ALTER TABLE payment_transactions ADD CONSTRAINT payment_transactions_type_check
  CHECK (type::text = ANY (ARRAY['income', 'cancellation', 'refund', 'expense', 'expense_reversal', 'transfer_in', 'transfer_out']::text[]));
