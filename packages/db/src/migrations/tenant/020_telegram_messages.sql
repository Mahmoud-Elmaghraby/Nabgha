-- Migration 020: سجل رسايل تليجرام الصادرة (للتتبع والتاريخ) — مرآة مبسّطة
-- لـ wa_messages_log من غير حقول الحظر (retry_count/bulk_job_id إلخ غير لازمة هنا).

CREATE TABLE IF NOT EXISTS telegram_messages (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL,
  chat_id       VARCHAR(64) NOT NULL,
  entity_type   VARCHAR(20) NOT NULL,
  entity_id     UUID        NOT NULL,
  template_key  VARCHAR(50),
  body          TEXT        NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending',
  error_message TEXT,
  sent_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_messages_tenant ON telegram_messages(tenant_id);
