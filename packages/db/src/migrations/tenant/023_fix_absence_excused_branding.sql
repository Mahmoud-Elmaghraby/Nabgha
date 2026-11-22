-- Migration 023: تصحيح قالب واتساب ABSENCE_EXCUSED القديم — كان اتزرع بنص "نبغة:" حرفي
-- جوه migration 006 بدل متغير {center_name} الديناميكي (نسيان وقت كتابة الـ migration —
-- الـ default الصحيح في الكود (WA_DEFAULT_TEMPLATES) كان سليم دايمًا، لكن الـ migration
-- زرعت نص تاني في قاعدة البيانات الفعلية لأي تنانت كان موجود وقتها). النتيجة: أي رسالة
-- ABSENCE_EXCUSED فعلية كانت بتتبعت باسم "نبغة" بدل اسم المركز/المدرس حسب إعدادات الهوية،
-- حتى لو الإعداد على "مدرس". الإصلاح آمن ومحدود جدًا: بيصحح بس الصفوف اللي لسه على قيمتها
-- الافتراضية الأصلية (is_default = true) ومطابقة للنص القديم بالظبط — أي تعديل يدوي عمله
-- أي مركز على القالب ده (حتى لو ابتدى بكلمة "نبغة" بنفسه لسبب ما) مش بيتلمس خالص.
-- Added: Sept 2026

UPDATE wa_templates
SET body = '{center_name}: تم اعتبار غياب الطالب {student_name} عن حصة {subject} بتاريخ {date} معذوراً نظراً لحضوره حصة بديلة',
    updated_at = NOW()
WHERE key = 'ABSENCE_EXCUSED'
  AND is_default = true
  AND body = 'نبغة: تم إعفاء {student_name} من غياب {subject} بتاريخ {date} — حضر حصة بديلة ✅';

-- نفس التصحيح لقالب تليجرام المقابل (لو نفس النص القديم اتزرع بنفس الطريقة في أي مسار قديم)
UPDATE telegram_templates
SET body = '{center_name}: تم اعتبار غياب الطالب {student_name} عن حصة {subject} بتاريخ {date} معذوراً نظراً لحضوره حصة بديلة',
    updated_at = NOW()
WHERE key = 'ABSENCE_EXCUSED'
  AND is_default = true
  AND body = 'نبغة: تم إعفاء {student_name} من غياب {subject} بتاريخ {date} — حضر حصة بديلة ✅';
