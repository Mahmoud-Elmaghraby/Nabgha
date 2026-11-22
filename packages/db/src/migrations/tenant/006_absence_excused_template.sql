-- Migration 006: إضافة قالب واتساب جديد ABSENCE_EXCUSED
-- يُستخدم لما الغياب يتحول لـ excused بسبب رصيد تعويض (حضور بديل)
-- تاريخ tenant_id مُستمد من صف موجود بالفعل في نفس الجدول (idempotent وآمن)
-- Added: July 2026

INSERT INTO wa_templates (tenant_id, key, body, is_default)
SELECT DISTINCT tenant_id, 'ABSENCE_EXCUSED',
  '{center_name}: تم اعتبار غياب الطالب {student_name} عن حصة {subject} بتاريخ {date} معذوراً نظراً لحضوره حصة بديلة',
  true
FROM wa_templates
ON CONFLICT (tenant_id, key) DO NOTHING;
