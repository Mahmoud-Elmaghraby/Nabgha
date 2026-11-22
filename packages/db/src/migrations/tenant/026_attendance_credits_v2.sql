-- Migration 026: إعادة تنظيم رصيد التعويض (الحضور البديل)
-- كل حضور بديل في مجموعة تانية = رصيد واحد (credit) مربوط بسجل الحضور ده.
-- الرصيد يا إما متاح، يا إما اتصرف على غياب معيّن (consumed)، يا إما اتلغى (revoked)
-- لو الحضور البديل نفسه اتشال (مسح بالغلط / إلغاء الحصة).
-- الأسبوع بقى من السبت للجمعة (كان للخميس، فحصص الجمعة ماكانتش بتتحسب).
-- Added: Nov 2026

-- حضور بديل واحد = رصيد واحد بس
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_credits_source
  ON attendance_credits (source_attendance_id);

-- للبحث السريع عن الرصيد اللي اتصرف على غياب معيّن (عشان نرجّعه لو الغياب اتعدّل)
CREATE INDEX IF NOT EXISTS idx_attendance_credits_consumed
  ON attendance_credits (consumed_attendance_id)
  WHERE consumed_attendance_id IS NOT NULL;

ALTER TABLE attendance_credits DROP CONSTRAINT IF EXISTS attendance_credits_status_check;
ALTER TABLE attendance_credits ADD CONSTRAINT attendance_credits_status_check
  CHECK (status IN ('available', 'consumed', 'revoked', 'expired'));
