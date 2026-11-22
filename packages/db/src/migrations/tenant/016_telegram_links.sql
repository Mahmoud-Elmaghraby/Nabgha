-- Migration 016: إعادة بناء موديول التيليجرام على أساس Long Polling بدل Webhook
-- (الأسباب: النشر الفعلي للعميل شغال Desktop mode بدون IP عام/بورت مفتوح، فأي
-- webhook مستحيل يوصله تيليجرام أصلاً — نفس السبب اللي قفل بوابة الأهالي في
-- ParentPortalAvailabilityGuard. الـ polling طلب صادر بس، شغال من أي جهاز عادي).
--
-- جدول عام (entity_type/entity_id) بدل عمود telegram_chat_id المخصص لجدول
-- الطلاب بس — عشان أي جهة تانية (مدرسين مستقبلاً) تتربط بنفس الآلية من غير
-- تعديل في طبقة النقل أو الأمان. عمود students.telegram_chat_id القديم اتسيب
-- من غير حذف (ما كانش فيه بيانات حقيقية فيه أصلاً لأن الموديول القديم ما كانش شغال).

CREATE TABLE IF NOT EXISTS telegram_links (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(20)  NOT NULL,
  entity_id   UUID         NOT NULL,
  chat_id     VARCHAR(50)  NOT NULL,
  linked_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE(entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_telegram_links_chat_id ON telegram_links(chat_id);
