-- Migration 021: صندوق وارد تليجرام — مرآة لـ wa_inbound_messages. الفرق المهم:
-- entity_id بيتملى فورًا وقت الاستقبال (مش null) لأن الربط بـ telegram_links عن
-- طريق chat_id دقيق ومباشر، عكس مطابقة رقم تليفون الواتساب.

CREATE TABLE IF NOT EXISTS telegram_inbound_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL,
  chat_id     VARCHAR(64) NOT NULL,
  body        TEXT        NOT NULL,
  entity_type VARCHAR(20),
  entity_id   UUID,
  is_read     BOOLEAN     NOT NULL DEFAULT false,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_inbound_tenant ON telegram_inbound_messages(tenant_id);
