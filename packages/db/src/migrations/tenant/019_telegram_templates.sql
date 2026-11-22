-- Migration 019: جدول قوالب تليجرام — مستقل تمامًا عن wa_templates، نفس الشكل
-- بالظبط، لكن تعديل قالب هنا ميأثرش على قالب الواتساب المقابل والعكس صحيح.

CREATE TABLE IF NOT EXISTS telegram_templates (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL,
  key         VARCHAR(50) NOT NULL,
  body        TEXT        NOT NULL,
  is_default  BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, key)
);
