-- Migration 011: السماح بحالة 'cancelled' للفواتير الشهرية
-- الكود (MonthlyDueEntity.softDelete / deleteDue) بيحط status='cancelled' عند حذف فاتورة،
-- لكن الـ CHECK constraint الأصلية في 001_initial.sql كانت بتسمح بس بـ
-- ('unpaid','partial','paid','waived') — يعني حذف أي فاتورة كان بيفشل بخطأ Postgres خام.
-- نفس أسلوب migration 009 (توسيع CHECK constraint موجودة).
-- Added: Aug 2026

ALTER TABLE monthly_dues DROP CONSTRAINT IF EXISTS monthly_dues_status_check;

ALTER TABLE monthly_dues ADD CONSTRAINT monthly_dues_status_check
  CHECK (status::text = ANY (ARRAY['unpaid', 'partial', 'paid', 'waived', 'cancelled']::text[]));
