-- ============================================================
-- 001_initial.sql — Tenant Schema (كل الجداول من الصفر)
-- :schema يتبدل بالـ runner بـ schema name الفعلي
-- ============================================================

-- Users
CREATE TABLE IF NOT EXISTS users (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE,
  username      VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(255) NOT NULL,
  role          VARCHAR(50)  NOT NULL DEFAULT 'teacher',
  permissions   JSONB        NOT NULL DEFAULT '[]',
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

-- Center Settings
CREATE TABLE IF NOT EXISTS center_settings (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  center_name     VARCHAR(255) NOT NULL DEFAULT 'المركز التعليمي',
  center_logo_url TEXT,
  center_phone    VARCHAR(20),
  center_address  TEXT,
  currency        VARCHAR(10)  NOT NULL DEFAULT 'EGP',
  currency_symbol VARCHAR(5)   NOT NULL DEFAULT 'ج.م',
  academic_year   VARCHAR(20)  NOT NULL DEFAULT '2025/2026',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Tenant Settings (key-value)
CREATE TABLE IF NOT EXISTS tenant_settings (
  key        VARCHAR(255) PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Subjects
CREATE TABLE IF NOT EXISTS subjects (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(255) NOT NULL,
  color      VARCHAR(7)   NOT NULL DEFAULT '#0E3B2E',
  is_active  BOOLEAN      NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Subject Grades (Fee يعيش هنا)
CREATE TABLE IF NOT EXISTS subject_grades (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id       UUID          NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  grade            VARCHAR(100)  NOT NULL,
  fee              NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (fee >= 0),
  payment_type     VARCHAR(20)   NOT NULL DEFAULT 'monthly'
                     CHECK (payment_type IN ('monthly','per_session','termly')),
  session_duration INTEGER       NOT NULL DEFAULT 60 CHECK (session_duration > 0),
  is_active        BOOLEAN       NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ,
  UNIQUE(subject_id, grade)
);
CREATE INDEX IF NOT EXISTS idx_subject_grades_subject_id ON subject_grades(subject_id) WHERE deleted_at IS NULL;

-- Teachers
CREATE TABLE IF NOT EXISTS teachers (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  phone       VARCHAR(20),
  email       VARCHAR(255),
  subject_ids JSONB        NOT NULL DEFAULT '[]',
  notes       TEXT,
  is_active   BOOLEAN      NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

-- Students
CREATE SEQUENCE IF NOT EXISTS student_code_seq START 1;
CREATE TABLE IF NOT EXISTS students (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name        VARCHAR(255) NOT NULL,
  parent_phone     VARCHAR(20)  NOT NULL,
  student_phone    VARCHAR(20),
  date_of_birth    DATE,
  grade            VARCHAR(100),
  notes            TEXT,
  qr_code          VARCHAR(255) UNIQUE NOT NULL,
  student_code     VARCHAR(20)  UNIQUE,
  telegram_chat_id VARCHAR(50),
  is_active        BOOLEAN      NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

-- Groups
CREATE TABLE IF NOT EXISTS groups (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(255) NOT NULL,
  subject_grade_id UUID         REFERENCES subject_grades(id) ON DELETE SET NULL,
  teacher_id       UUID,
  max_students     INTEGER      NOT NULL DEFAULT 30,
  schedule         JSONB        NOT NULL DEFAULT '[]',
  is_active        BOOLEAN      NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_groups_subject_grade_id ON groups(subject_grade_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_groups_teacher_id ON groups(teacher_id) WHERE deleted_at IS NULL;

-- Group Students
CREATE TABLE IF NOT EXISTS group_students (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID        NOT NULL,
  student_id UUID        NOT NULL,
  discount   NUMERIC(10,2) NOT NULL DEFAULT 0,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at    TIMESTAMPTZ,
  CONSTRAINT chk_left_after_joined CHECK (left_at IS NULL OR left_at > joined_at)
);
CREATE INDEX IF NOT EXISTS idx_group_students_group_id ON group_students(group_id) WHERE left_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_group_students_student_id ON group_students(student_id) WHERE left_at IS NULL;

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type       VARCHAR(20) NOT NULL DEFAULT 'lesson'
               CHECK (type IN ('lesson','lesson_revision','lesson_exam','exam','grade_exam')),
  group_id   UUID,
  grade      VARCHAR(100),
  subject_id UUID,
  title      VARCHAR(255) NOT NULL,
  out_of     INTEGER,
  start_date DATE        NOT NULL,
  end_date   DATE,
  start_time TIME,
  end_time   TIME,
  status     VARCHAR(20) NOT NULL DEFAULT 'scheduled'
               CHECK (status IN ('scheduled','ongoing','completed','cancelled')),
  image_url  TEXT,
  notes      TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_group_or_grade CHECK (
    (type != 'grade_exam' AND group_id IS NOT NULL)
    OR
    (type = 'grade_exam' AND grade IS NOT NULL AND subject_id IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_sessions_group_id   ON sessions(group_id)    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_grade      ON sessions(grade)       WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_start_date ON sessions(start_date);
CREATE INDEX IF NOT EXISTS idx_sessions_status     ON sessions(status);

-- Attendance
CREATE TABLE IF NOT EXISTS attendance (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  student_id UUID        NOT NULL,
  status     VARCHAR(20) NOT NULL DEFAULT 'absent'
               CHECK (status IN ('present','absent','late')),
  degree     NUMERIC(5,2),
  scanned_at TIMESTAMPTZ,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_attendance_session_id ON attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance(student_id);

-- Treasuries
CREATE TABLE IF NOT EXISTS treasuries (
  id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(255)  NOT NULL,
  type       VARCHAR(20)   NOT NULL DEFAULT 'cash'
               CHECK (type IN ('cash','bank','vodafone','instapay','other')),
  balance    NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active  BOOLEAN       NOT NULL DEFAULT true,
  notes      TEXT,
  created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Monthly Dues
CREATE TABLE IF NOT EXISTS monthly_dues (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       UUID          NOT NULL,
  subject_grade_id UUID          NOT NULL,
  month            VARCHAR(7)    NOT NULL,
  due_amount       NUMERIC(10,2) NOT NULL,
  discount_applied NUMERIC(10,2) NOT NULL DEFAULT 0,
  paid_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  status           VARCHAR(20)   NOT NULL DEFAULT 'unpaid'
                     CHECK (status IN ('unpaid','partial','paid','waived')),
  notes            TEXT,
  created_by       UUID,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, subject_grade_id, month)
);
CREATE INDEX IF NOT EXISTS idx_monthly_dues_student ON monthly_dues(student_id);
CREATE INDEX IF NOT EXISTS idx_monthly_dues_month   ON monthly_dues(month);
CREATE INDEX IF NOT EXISTS idx_monthly_dues_status  ON monthly_dues(status);

-- Payments
CREATE SEQUENCE IF NOT EXISTS payment_receipt_seq;
CREATE TABLE IF NOT EXISTS payments (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     UUID          NOT NULL,
  monthly_due_id UUID          NOT NULL REFERENCES monthly_dues(id),
  treasury_id    UUID          NOT NULL REFERENCES treasuries(id),
  amount         NUMERIC(10,2) NOT NULL,
  payment_method VARCHAR(20)   NOT NULL DEFAULT 'cash'
                   CHECK (payment_method IN ('cash','visa','instapay','vodafone','bank','other')),
  receipt_number INTEGER       NOT NULL DEFAULT nextval('payment_receipt_seq'),
  status         VARCHAR(20)   NOT NULL DEFAULT 'paid'
                   CHECK (status IN ('paid','cancelled','refunded','partial_refund')),
  cancel_reason  TEXT,
  refund_amount  NUMERIC(10,2),
  notes          TEXT,
  created_by     UUID,
  paid_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_student  ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_due      ON payments(monthly_due_id);
CREATE INDEX IF NOT EXISTS idx_payments_treasury ON payments(treasury_id);

-- Payment Transactions (Audit Trail)
CREATE TABLE IF NOT EXISTS payment_transactions (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id     UUID          REFERENCES payments(id),
  treasury_id    UUID          NOT NULL REFERENCES treasuries(id),
  type           VARCHAR(20)   NOT NULL
                   CHECK (type IN ('income','cancellation','refund','expense')),
  amount         NUMERIC(10,2) NOT NULL,
  balance_before NUMERIC(10,2) NOT NULL,
  balance_after  NUMERIC(10,2) NOT NULL,
  notes          TEXT,
  created_by     UUID,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payment_tx_treasury ON payment_transactions(treasury_id);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  treasury_id  UUID          NOT NULL REFERENCES treasuries(id),
  category     VARCHAR(50)   NOT NULL
                 CHECK (category IN ('electricity','water','gas','rent','salary','maintenance','supplies','other')),
  title        VARCHAR(255)  NOT NULL,
  amount       NUMERIC(10,2) NOT NULL,
  expense_date DATE          NOT NULL DEFAULT CURRENT_DATE,
  notes        TEXT,
  created_by   UUID,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_expenses_date     ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type            VARCHAR(100) NOT NULL,
  recipient_phone VARCHAR(20)  NOT NULL,
  message         TEXT         NOT NULL,
  status          VARCHAR(20)  NOT NULL DEFAULT 'pending',
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- WhatsApp Sessions
CREATE TABLE IF NOT EXISTS wa_sessions (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID        NOT NULL UNIQUE,
  phone              VARCHAR(20),
  status             VARCHAR(20) NOT NULL DEFAULT 'disconnected',
  qr_code            TEXT,
  qr_expires_at      TIMESTAMPTZ,
  connected_at       TIMESTAMPTZ,
  disconnected_at    TIMESTAMPTZ,
  warmup_started_at  TIMESTAMPTZ,
  warmup_day         INTEGER     NOT NULL DEFAULT 0,
  is_banned          BOOLEAN     NOT NULL DEFAULT false,
  banned_until       TIMESTAMPTZ,
  last_health_check  TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- WhatsApp Settings
CREATE TABLE IF NOT EXISTS wa_settings (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID        NOT NULL UNIQUE,
  wa_enabled             BOOLEAN     NOT NULL DEFAULT false,
  send_hours_from        VARCHAR(5)  NOT NULL DEFAULT '08:00',
  send_hours_to          VARCHAR(5)  NOT NULL DEFAULT '22:00',
  daily_limit            INTEGER     NOT NULL DEFAULT 50,
  delay_min_seconds      INTEGER     NOT NULL DEFAULT 3,
  delay_max_seconds      INTEGER     NOT NULL DEFAULT 8,
  warmup_enabled         BOOLEAN     NOT NULL DEFAULT true,
  notify_absent          BOOLEAN     NOT NULL DEFAULT true,
  notify_present         BOOLEAN     NOT NULL DEFAULT false,
  notify_late            BOOLEAN     NOT NULL DEFAULT true,
  notify_3_absences      BOOLEAN     NOT NULL DEFAULT true,
  late_threshold_min     INTEGER     NOT NULL DEFAULT 15,
  notify_payment_confirm BOOLEAN     NOT NULL DEFAULT true,
  notify_payment_due_7d  BOOLEAN     NOT NULL DEFAULT true,
  notify_payment_due_1d  BOOLEAN     NOT NULL DEFAULT true,
  notify_payment_overdue BOOLEAN     NOT NULL DEFAULT true,
  notify_new_student     BOOLEAN     NOT NULL DEFAULT true,
  notify_group_added     BOOLEAN     NOT NULL DEFAULT true,
  notify_group_removed   BOOLEAN     NOT NULL DEFAULT false,
  notify_student_card    BOOLEAN     NOT NULL DEFAULT false,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- WhatsApp Templates
CREATE TABLE IF NOT EXISTS wa_templates (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID        NOT NULL,
  key        VARCHAR(50) NOT NULL,
  body       TEXT        NOT NULL,
  is_default BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, key)
);

-- WhatsApp Messages Log
CREATE TABLE IF NOT EXISTS wa_messages_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL,
  phone        VARCHAR(20) NOT NULL,
  template_key VARCHAR(50),
  body         TEXT        NOT NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'pending',
  error_message TEXT,
  retry_count  INTEGER     NOT NULL DEFAULT 0,
  sent_at      TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  bulk_job_id  UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- WhatsApp Bulk Jobs
CREATE TABLE IF NOT EXISTS wa_bulk_jobs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL,
  title        VARCHAR(255) NOT NULL,
  body         TEXT        NOT NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'pending',
  total        INTEGER     NOT NULL DEFAULT 0,
  sent         INTEGER     NOT NULL DEFAULT 0,
  failed       INTEGER     NOT NULL DEFAULT 0,
  queued       INTEGER     NOT NULL DEFAULT 0,
  created_by   UUID        NOT NULL,
  scheduled_at TIMESTAMPTZ,
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- WhatsApp Inbound Messages
CREATE TABLE IF NOT EXISTS wa_inbound_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL,
  phone       VARCHAR(20) NOT NULL,
  body        TEXT        NOT NULL,
  student_id  UUID,
  is_read     BOOLEAN     NOT NULL DEFAULT false,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default Data
INSERT INTO treasuries (name, type, balance)
VALUES ('الخزينة الرئيسية', 'cash', 0)
ON CONFLICT DO NOTHING;

INSERT INTO tenant_settings (key, value, updated_at)
VALUES ('telegram_bot_token', '', NOW())
ON CONFLICT (key) DO NOTHING;
