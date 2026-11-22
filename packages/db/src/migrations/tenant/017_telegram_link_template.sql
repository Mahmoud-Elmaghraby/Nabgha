-- Migration 017: إضافة قالب واتساب جديد TELEGRAM_LINK
-- يُستخدم عند الإرسال الجماعي لروابط ربط تليجرام لأولياء الأمور (عن طريق بوت
-- الواتساب المتصل بالفعل، مش بوت تليجرام نفسه — راجع telegram-links.repository.ts
-- و send-telegram-links.usecase.ts). نفس نمط migration 006 بالظبط.

INSERT INTO wa_templates (tenant_id, key, body, is_default)
SELECT DISTINCT tenant_id, 'TELEGRAM_LINK',
  '{center_name}: لمتابعة إشعارات الطالب {student_name} على تليجرام، افتح الرابط واضغط Start:' || E'\n' || '{link}',
  true
FROM wa_templates
ON CONFLICT (tenant_id, key) DO NOTHING;
