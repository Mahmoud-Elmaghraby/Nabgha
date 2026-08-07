-- Migration 010: عمود لتتبّع وقت إرسال إشعار الدرجة عبر واتساب
-- بيمنع الإرسال المزدوج لو المستخدم دوس "إرسال الكل" أكتر من مرة،
-- وبيسمح بمعرفة مين درجته اتبعتله فعلاً ومين لسه
-- Added: Aug 2026
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS grade_notified_at TIMESTAMPTZ;
