-- Migration 012: بوابة أولياء الأمور — جدول أكواد OTP للدخول
-- Added: August 2026
--
-- ملاحظة: جلسة ولي الأمر نفسها بتبقى JWT عديم الحالة (stateless) بسر منفصل
-- تمامًا عن سر الموظفين (PARENT_JWT_SECRET) — فمفيش حاجة لجدول "sessions"،
-- بس محتاجين نخزّن كود الـ OTP مؤقتًا للتحقق منه.

CREATE TABLE IF NOT EXISTS parent_otp_codes (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  phone        VARCHAR(20)  NOT NULL,
  code_hash    VARCHAR(255) NOT NULL,
  attempts     INTEGER      NOT NULL DEFAULT 0,
  consumed_at  TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ  NOT NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parent_otp_codes_phone ON parent_otp_codes(phone);
CREATE INDEX IF NOT EXISTS idx_parent_otp_codes_expires ON parent_otp_codes(expires_at);
