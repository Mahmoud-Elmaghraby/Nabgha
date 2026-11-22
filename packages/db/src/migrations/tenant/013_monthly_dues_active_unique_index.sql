-- Migration 013: allow recreating a monthly due after cancelling the old one.
-- The original UNIQUE constraint blocked any second due for the same
-- student/subject/month, even if the old due was soft-deleted as cancelled.

ALTER TABLE monthly_dues
  DROP CONSTRAINT IF EXISTS monthly_dues_student_id_subject_grade_id_month_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_dues_unique_active
  ON monthly_dues(student_id, subject_grade_id, month)
  WHERE status <> 'cancelled';
