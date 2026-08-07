-- Migration 007: تحديث CHECK constraint على attendance.status ليشمل 'excused'
-- كانت لسه محصورة في present/absent/late من الـ schema الأصلية،
-- ومنعت نظام رصيد التعويض (attendance_credits) من العمل
-- Added: July 2026

ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check;

ALTER TABLE attendance ADD CONSTRAINT attendance_status_check
  CHECK (status::text = ANY (ARRAY['present', 'absent', 'late', 'excused']::text[]));
