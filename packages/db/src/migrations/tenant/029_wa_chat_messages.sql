-- Migration 029: صندوق وارد الواتساب (WA-110) — كل رسايل المحادثات مع أولياء الأمور في جدول واحد.
-- direction: 'in' من ولي الأمر · 'out' مننا
-- source:    'parent' (وارد) · 'app' (رد من البرنامج) · 'phone' (رد من موبايل المركز مباشرة)
-- الإشعارات التلقائية (حضور / غياب / دفع…) بتفضل في wa_messages_log وبتتعرض جوّه المحادثة من هناك.
-- media_*: الفويس نوت والصور والملفات بتتحفظ على الجهاز (مش في /storage العام) وبتتقري من endpoint محمي.
-- wa_message_id: معرّف الرسالة في واتساب — عشان مانسجّلش نفس الرسالة مرتين (رسايلنا بترجع لنا كـ fromMe).
-- Added: 2026-11-25

CREATE TABLE IF NOT EXISTS wa_chat_messages (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  phone          VARCHAR(20)  NOT NULL,
  direction      VARCHAR(3)   NOT NULL,
  source         VARCHAR(10)  NOT NULL,
  body           TEXT         NOT NULL DEFAULT '',
  media_type     VARCHAR(20),
  media_path     TEXT,
  media_mime     VARCHAR(100),
  media_seconds  INTEGER,
  media_size     INTEGER,
  media_status   VARCHAR(20),
  wa_message_id  VARCHAR(128),
  status         VARCHAR(10)  NOT NULL DEFAULT 'sent',
  error_message  TEXT,
  sent_by        UUID,
  is_read        BOOLEAN      NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE wa_chat_messages DROP CONSTRAINT IF EXISTS wa_chat_messages_direction_check;
ALTER TABLE wa_chat_messages ADD CONSTRAINT wa_chat_messages_direction_check CHECK (direction IN ('in', 'out'));
ALTER TABLE wa_chat_messages DROP CONSTRAINT IF EXISTS wa_chat_messages_source_check;
ALTER TABLE wa_chat_messages ADD CONSTRAINT wa_chat_messages_source_check CHECK (source IN ('parent', 'app', 'phone'));
ALTER TABLE wa_chat_messages DROP CONSTRAINT IF EXISTS wa_chat_messages_status_check;
ALTER TABLE wa_chat_messages ADD CONSTRAINT wa_chat_messages_status_check CHECK (status IN ('pending', 'sent', 'failed'));

CREATE INDEX IF NOT EXISTS idx_wa_chat_phone_created ON wa_chat_messages(phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_chat_unread ON wa_chat_messages(phone) WHERE direction = 'in' AND is_read = false;
CREATE UNIQUE INDEX IF NOT EXISTS uq_wa_chat_message_id ON wa_chat_messages(wa_message_id) WHERE wa_message_id IS NOT NULL;

-- الرسايل الواردة القديمة (نص بس) تظهر في المحادثات. بيتنفّذ مرة واحدة: لو الجدول فيه أي حاجة مابيعملش حاجة.
-- wa_inbound_messages بيفضل زي ما هو (مابنحذفش جداول مباشرة — CONVENTIONS §2.3).
INSERT INTO wa_chat_messages (phone, direction, source, body, is_read, created_at)
SELECT phone, 'in', 'parent', body, is_read, received_at
FROM wa_inbound_messages
WHERE NOT EXISTS (SELECT 1 FROM wa_chat_messages);
