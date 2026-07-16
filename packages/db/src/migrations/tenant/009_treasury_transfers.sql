-- Migration 009: تحويل رصيد بين الخزائن
-- إضافة نوعين جدد لـ payment_transactions.type (transfer_in/transfer_out)
-- وعمود related_treasury_id عشان كل قيد تحويل يعرف الخزينة التانية
-- Added: July 2026

ALTER TABLE payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_type_check;

ALTER TABLE payment_transactions ADD CONSTRAINT payment_transactions_type_check
  CHECK (type::text = ANY (ARRAY['income', 'cancellation', 'refund', 'expense', 'transfer_in', 'transfer_out']::text[]));

ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS related_treasury_id UUID REFERENCES treasuries(id);
