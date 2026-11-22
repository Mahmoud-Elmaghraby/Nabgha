-- Migration 018: جدول إعدادات إشعارات تليجرام — مستقل تمامًا عن wa_settings.
-- مفيش حقول حماية من الحظر (daily_limit / delay / warmup) لأن بوت تليجرام
-- الرسمي (Bot API) مالوش مخاطر حظر زي واتساب Baileys غير الرسمي.

CREATE TABLE IF NOT EXISTS telegram_settings (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID        NOT NULL UNIQUE,
  telegram_enabled       BOOLEAN     NOT NULL DEFAULT false,
  send_hours_from        VARCHAR(5)  NOT NULL DEFAULT '08:00',
  send_hours_to          VARCHAR(5)  NOT NULL DEFAULT '22:00',
  notify_absent          BOOLEAN     NOT NULL DEFAULT true,
  notify_present         BOOLEAN     NOT NULL DEFAULT false,
  notify_late            BOOLEAN     NOT NULL DEFAULT true,
  notify_3_absences      BOOLEAN     NOT NULL DEFAULT true,
  notify_payment_confirm BOOLEAN     NOT NULL DEFAULT true,
  notify_payment_due_7d  BOOLEAN     NOT NULL DEFAULT true,
  notify_payment_due_1d  BOOLEAN     NOT NULL DEFAULT true,
  notify_payment_overdue BOOLEAN     NOT NULL DEFAULT true,
  notify_new_student     BOOLEAN     NOT NULL DEFAULT true,
  notify_group_added     BOOLEAN     NOT NULL DEFAULT true,
  notify_group_removed   BOOLEAN     NOT NULL DEFAULT false,
  notify_absence_excused BOOLEAN     NOT NULL DEFAULT true,
  notify_grade_recorded  BOOLEAN     NOT NULL DEFAULT true,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
