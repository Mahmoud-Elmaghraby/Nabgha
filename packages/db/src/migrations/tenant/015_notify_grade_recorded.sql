-- Migration 015: add notify_grade_recorded toggle to wa_settings.
-- GRADE_RECORDED كانت الرسالة الوحيدة اللي بتتبعت من غير أي مفتاح تحكم في
-- الإعدادات (كل قالب تاني عنده notify_* خاص بيه) — يعني ما كانش فيه طريقة توقف
-- إشعارات الدرجات لوحدها من غير ما توقف الواتساب كله. الافتراضي true عشان
-- السلوك الحالي (بيتبعت دايمًا) يفضل زي ما هو للعملاء الموجودين.

ALTER TABLE wa_settings
  ADD COLUMN IF NOT EXISTS notify_grade_recorded BOOLEAN NOT NULL DEFAULT true;
