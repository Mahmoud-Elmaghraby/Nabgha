-- Migration 028: إصلاح trigger زيادة times_used في بنك الأسئلة
-- الدالة (من 024) كانت بتعمل UPDATE exam_questions من غير اسم الـ schema.
-- الـ API بيكلّم قاعدة البيانات والـ search_path = public، فأي إضافة سؤال من البنك
-- لامتحان (حفظ أسئلة الامتحان / التوليد التلقائي) كانت بتفشل بـ:
--   relation "exam_questions" does not exist
-- الحل: نستخدم schema الجدول اللي عليه الـ trigger نفسه (TG_TABLE_SCHEMA).
-- Added: Nov 2026

CREATE OR REPLACE FUNCTION increment_question_times_used()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.question_id IS NOT NULL THEN
    EXECUTE format('UPDATE %I.exam_questions SET times_used = times_used + 1 WHERE id = $1', TG_TABLE_SCHEMA)
      USING NEW.question_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
