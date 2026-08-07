-- ============================================================
-- نبغة — Tenant Schema
-- Single Source of Truth للـ Tenant Database
-- Version: 2.0 | Date: 2026-06-16
-- ============================================================
-- الاستخدام: هذا الملف للقراءة والمرجعية فقط
-- التشغيل الفعلي: migrate.js
-- ============================================================

-- ============================================================
-- 1. USERS — مستخدمي النظام
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email            VARCHAR(255) UNIQUE,
  username         VARCHAR(100) UNIQUE NOT NULL,
  password_hash    VARCHAR(255) NOT NULL,
  name             VARCHAR(255) NOT NULL,
  role             VARCHAR(50)  NOT NULL DEFAULT 'teacher'
                   CHECK (role IN ('tenant_admin','teacher','secretary','parent')),
  permissions      JSONB        NOT NULL DEFAULT '[]',
  is_active        BOOLEAN      NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_role        ON users(role)     WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_username    ON users(username) WHERE deleted_at IS NULL;

-- ============================================================
-- 2. CENTER_SETTINGS — إعدادات المركز (row واحدة دايماً)
-- ============================================================
CREATE TABLE IF NOT EXISTS center_settings (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  center_name      VARCHAR(255) NOT NULL DEFAULT 'المركز التعليمي',
  center_logo_url  TEXT,
  center_phone     VARCHAR(20),
  center_address   TEXT,
  currency         VARCHAR(10)  NOT NULL DEFAULT 'EGP',
  currency_symbol  VARCHAR(5)   NOT NULL DEFAULT 'ج.م',
  academic_year    VARCHAR(20),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. SUBJECTS — المواد الدراسية
-- ============================================================
CREATE TABLE IF NOT EXISTS subjects (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(255)  NOT NULL,
  color            VARCHAR(7)    NOT NULL DEFAULT '#0E3B2E',
  fee              NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_type     VARCHAR(20)   NOT NULL DEFAULT 'monthly'
                   CHECK (payment_type IN ('monthly','per_session','term')),
  session_duration INTEGER       NOT NULL DEFAULT 60,
  is_active        BOOLEAN       NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_subjects_active ON subjects(is_active) WHERE deleted_at IS NULL;

-- ============================================================
-- 4. TEACHERS — المدرسون
-- ============================================================
CREATE TABLE IF NOT EXISTS teachers (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(255) NOT NULL,
  phone            VARCHAR(20),
  email            VARCHAR(255),
  subject_ids      JSONB        NOT NULL DEFAULT '[]',
  notes            TEXT,
  is_active        BOOLEAN      NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_teachers_active ON teachers(is_active) WHERE deleted_at IS NULL;

-- ============================================================
-- 5. STUDENTS — الطلاب
-- ============================================================
CREATE TABLE IF NOT EXISTS students (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name        VARCHAR(255) NOT NULL,
  parent_phone     VARCHAR(20)  NOT NULL,
  student_phone    VARCHAR(20),
  date_of_birth    DATE,
  grade            VARCHAR(100),
  notes            TEXT,
  qr_code          VARCHAR(255) UNIQUE NOT NULL,
  is_active        BOOLEAN      NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_students_parent_phone ON students(parent_phone);
CREATE INDEX IF NOT EXISTS idx_students_qr_code      ON students(qr_code);
CREATE INDEX IF NOT EXISTS idx_students_grade        ON students(grade) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_students_active       ON students(is_active) WHERE deleted_at IS NULL;

-- ============================================================
-- 6. GROUPS — المجموعات
-- ============================================================
CREATE TABLE IF NOT EXISTS groups (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(255)  NOT NULL,
  subject_id       UUID          REFERENCES subjects(id) ON DELETE SET NULL,
  teacher_id       UUID          REFERENCES teachers(id) ON DELETE SET NULL,
  grade            VARCHAR(100),
  max_students     INTEGER       NOT NULL DEFAULT 30,
  schedule         JSONB         NOT NULL DEFAULT '[]',
  is_active        BOOLEAN       NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_groups_subject_id  ON groups(subject_id)  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_groups_teacher_id  ON groups(teacher_id)  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_groups_grade       ON groups(grade)       WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_groups_active      ON groups(is_active)   WHERE deleted_at IS NULL;

-- ============================================================
-- 7. GROUP_STUDENTS — الطلاب في المجموعات
-- بدون UNIQUE constraint — left_at هو اللي بيحدد النشط
-- ============================================================
CREATE TABLE IF NOT EXISTS group_students (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id         UUID        NOT NULL REFERENCES groups(id)   ON DELETE CASCADE,
  student_id       UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  joined_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_group_students_group_id   ON group_students(group_id)   WHERE left_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_group_students_student_id ON group_students(student_id) WHERE left_at IS NULL;

-- ============================================================
-- 8. SESSIONS — الحصص
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id         UUID        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  date             DATE        NOT NULL,
  start_time       TIME        NOT NULL,
  end_time         TIME        NOT NULL,
  status           VARCHAR(20) NOT NULL DEFAULT 'scheduled'
                   CHECK (status IN ('scheduled','completed','cancelled')),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_group_id ON sessions(group_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date     ON sessions(date);

-- ============================================================
-- 9. ATTENDANCE — الحضور
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID        NOT NULL REFERENCES sessions(id)  ON DELETE CASCADE,
  student_id       UUID        NOT NULL REFERENCES students(id)  ON DELETE CASCADE,
  status           VARCHAR(20) NOT NULL DEFAULT 'present'
                   CHECK (status IN ('present','absent','late')),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_session_id ON attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance(student_id);

-- ============================================================
-- 10. PAYMENTS — المدفوعات
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS payments_receipt_seq START 1000;

CREATE TABLE IF NOT EXISTS payments (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       UUID          NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  group_id         UUID          NOT NULL REFERENCES groups(id)   ON DELETE RESTRICT,
  subject_id       UUID          REFERENCES subjects(id)          ON DELETE SET NULL,
  month            VARCHAR(7)    NOT NULL,
  due_amount       NUMERIC(10,2) NOT NULL,
  paid_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  status           VARCHAR(20)   NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','partial','paid')),
  payment_method   VARCHAR(20)   NOT NULL DEFAULT 'cash'
                   CHECK (payment_method IN ('cash','transfer','other')),
  receipt_number   INTEGER       NOT NULL DEFAULT nextval('payments_receipt_seq'),
  notes            TEXT,
  created_by       UUID          REFERENCES users(id) ON DELETE SET NULL,
  paid_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_student_id ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_group_id   ON payments(group_id);
CREATE INDEX IF NOT EXISTS idx_payments_month      ON payments(month);
CREATE INDEX IF NOT EXISTS idx_payments_status     ON payments(status);

-- ============================================================
-- 11. NOTIFICATIONS — الإشعارات
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type             VARCHAR(100) NOT NULL,
  recipient_phone  VARCHAR(20)  NOT NULL,
  message          TEXT         NOT NULL,
  status           VARCHAR(20)  NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','sent','failed')),
  sent_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_notifications_phone  ON notifications(recipient_phone);

-- ============================================================
-- 12. TENANT_SETTINGS — إعدادات عامة (key-value)
-- ============================================================
CREATE TABLE IF NOT EXISTS tenant_settings (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key              VARCHAR(100) UNIQUE NOT NULL,
  value            TEXT         NOT NULL,
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 13. WA_SESSIONS — جلسات الواتساب
-- ============================================================
CREATE TABLE IF NOT EXISTS wa_sessions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone               VARCHAR(20),
  status              VARCHAR(20) NOT NULL DEFAULT 'disconnected'
                      CHECK (status IN ('disconnected','connecting','connected','banned')),
  qr_code             TEXT,
  qr_expires_at       TIMESTAMPTZ,
  connected_at        TIMESTAMPTZ,
  disconnected_at     TIMESTAMPTZ,
  warmup_started_at   TIMESTAMPTZ,
  warmup_day          INTEGER     NOT NULL DEFAULT 0,
  is_banned           BOOLEAN     NOT NULL DEFAULT false,
  banned_until        TIMESTAMPTZ,
  last_health_check   TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 14. WA_SETTINGS — إعدادات الواتساب
-- ============================================================
CREATE TABLE IF NOT EXISTS wa_settings (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_enabled              BOOLEAN     NOT NULL DEFAULT false,
  send_hours_from         VARCHAR(5)  NOT NULL DEFAULT '08:00',
  send_hours_to           VARCHAR(5)  NOT NULL DEFAULT '22:00',
  daily_limit             INTEGER     NOT NULL DEFAULT 50,
  delay_min_seconds       INTEGER     NOT NULL DEFAULT 3,
  delay_max_seconds       INTEGER     NOT NULL DEFAULT 8,
  warmup_enabled          BOOLEAN     NOT NULL DEFAULT true,
  notify_absent           BOOLEAN     NOT NULL DEFAULT true,
  notify_present          BOOLEAN     NOT NULL DEFAULT false,
  notify_late             BOOLEAN     NOT NULL DEFAULT true,
  notify_3_absences       BOOLEAN     NOT NULL DEFAULT true,
  late_threshold_min      INTEGER     NOT NULL DEFAULT 15,
  notify_payment_confirm  BOOLEAN     NOT NULL DEFAULT true,
  notify_payment_due_7d   BOOLEAN     NOT NULL DEFAULT true,
  notify_payment_due_1d   BOOLEAN     NOT NULL DEFAULT true,
  notify_payment_overdue  BOOLEAN     NOT NULL DEFAULT true,
  notify_new_student      BOOLEAN     NOT NULL DEFAULT true,
  notify_group_added      BOOLEAN     NOT NULL DEFAULT true,
  notify_group_removed    BOOLEAN     NOT NULL DEFAULT false,
  notify_student_card     BOOLEAN     NOT NULL DEFAULT false,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 15. WA_TEMPLATES — قوالب الرسائل
-- ============================================================
CREATE TABLE IF NOT EXISTS wa_templates (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key              VARCHAR(50) UNIQUE NOT NULL,
  body             TEXT        NOT NULL,
  is_default       BOOLEAN     NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 16. WA_MESSAGES_LOG — سجل الرسائل
-- ============================================================
CREATE TABLE IF NOT EXISTS wa_messages_log (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone            VARCHAR(20) NOT NULL,
  template_key     VARCHAR(50),
  body             TEXT        NOT NULL,
  status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','sent','failed','delivered')),
  error_message    TEXT,
  sent_at          TIMESTAMPTZ,
  delivered_at     TIMESTAMPTZ,
  bulk_job_id      UUID        REFERENCES wa_bulk_jobs(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_messages_log_status   ON wa_messages_log(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_wa_messages_log_bulk_job ON wa_messages_log(bulk_job_id);

-- ============================================================
-- 17. WA_BULK_JOBS — وظائف الإرسال الجماعي
-- ============================================================
CREATE TABLE IF NOT EXISTS wa_bulk_jobs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title            VARCHAR(255) NOT NULL,
  body             TEXT         NOT NULL,
  status           VARCHAR(20)  NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','running','completed','cancelled','failed')),
  total            INTEGER      NOT NULL DEFAULT 0,
  sent             INTEGER      NOT NULL DEFAULT 0,
  failed           INTEGER      NOT NULL DEFAULT 0,
  queued           INTEGER      NOT NULL DEFAULT 0,
  created_by       UUID         REFERENCES users(id) ON DELETE SET NULL,
  scheduled_at     TIMESTAMPTZ,
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  cancelled_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 18. WA_INBOUND_MESSAGES — الرسائل الواردة
-- ============================================================
CREATE TABLE IF NOT EXISTS wa_inbound_messages (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone            VARCHAR(20) NOT NULL,
  body             TEXT        NOT NULL,
  student_id       UUID        REFERENCES students(id) ON DELETE SET NULL,
  is_read          BOOLEAN     NOT NULL DEFAULT false,
  received_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_inbound_unread ON wa_inbound_messages(is_read) WHERE is_read = false;

-- ============================================================
-- TRIGGERS — updated_at تلقائي على كل الجداول
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','center_settings','subjects','teachers','students',
    'groups','sessions','attendance','payments',
    'wa_sessions','wa_settings','wa_templates','wa_bulk_jobs'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_updated_at ON %I;
       CREATE TRIGGER trg_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION update_updated_at();',
      t, t
    );
  END LOOP;
END $$;

-- ============================================================
-- GRANTS
-- ============================================================
DO $$ DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','center_settings','subjects','teachers','students',
    'groups','group_students','sessions','attendance','payments',
    'notifications','tenant_settings',
    'wa_sessions','wa_settings','wa_templates',
    'wa_messages_log','wa_bulk_jobs','wa_inbound_messages'
  ] LOOP
    EXECUTE format('GRANT ALL ON TABLE %I TO nabgha', t);
  END LOOP;
END $$;

GRANT USAGE ON SEQUENCE payments_receipt_seq TO nabgha;
