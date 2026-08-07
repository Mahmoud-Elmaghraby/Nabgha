-- Migration 006: إضافة قالب واتساب جديد ABSENCE_EXCUSED
-- يُستخدم لما الغياب يتحول لـ excused بسبب رصيد تعويض (حضور بديل)
-- تاريخ tenant_id مُستمد من صف موجود بالفعل في نفس الجدول (idempotent وآمن)
-- Added: July 2026

INSERT INTO wa_templates (tenant_id, key, body, is_default)
SELECT DISTINCT tenant_id, 'ABSENCE_EXCUSED',
  'نبغة: تم إعفاء {student_name} من غياب {subject} بتاريخ {date} — حضر حصة بديلة ✅',
  true
FROM wa_templates
ON CONFLICT (tenant_id, key) DO NOTHING;
