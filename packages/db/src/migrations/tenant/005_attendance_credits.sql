-- Migration 005: نظام "رصيد التعويض" — حضور بديل في مجموعة تانية بنفس المادة
-- بيسمح بربط الغياب في المجموعة الأصلية بحضور بديل في مجموعة تانية،
-- في الاتجاهين (تعويض قبل الغياب أو بعده)، محصور بنطاق أسبوع واحد (سبت-خميس)
-- Added: July 2026

CREATE TABLE IF NOT EXISTS attendance_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  subject_grade_id UUID NOT NULL,
  source_session_id UUID NOT NULL,
  source_attendance_id UUID NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'available',
  consumed_attendance_id UUID NULL,
  consumed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_credits_lookup
  ON attendance_credits (student_id, subject_grade_id, status, week_start, week_end);
