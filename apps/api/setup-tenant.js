/**
 * setup-tenant.js — Fresh Install
 *
 * يُنشئ:
 *   • plan + tenant في public schema
 *   • الـ tenant schema الكامل بكل جداوله (23 جدول)
 *   • admin user أول بأول
 *
 * المرجع النهائي للـ schema: packages/db/src/kysely-types.ts
 */

const { Pool }      = require('pg');
const bcrypt        = require('bcrypt');
const { randomUUID } = require('crypto');

const DB_URL = process.env.DATABASE_URL
  || 'postgresql://nabgha:nabgha123@127.0.0.1:5432/nabgha';

const pool = new Pool({ connectionString: DB_URL });

// ─── ثوابت الـ tenant الافتراضي ──────────────────────────────────
const TENANT_ID   = '00000000-0000-0000-0000-000000000001';
const SCHEMA      = `tenant_${TENANT_ID.replace(/-/g, '_')}`;
const PLAN_ID     = randomUUID();
const ADMIN_PASS  = 'Nabgha@TempPass123';

// ─── الدالة الرئيسية ──────────────────────────────────────────────
async function setup() {
  const client = await pool.connect();
  try {
    console.log('🚀 بدء إعداد بيانات المركز...\n');

    // ══════════════════════════════════════════════════════════════
    // 1. Public schema — plan + tenant
    // ══════════════════════════════════════════════════════════════
    await client.query(`
      INSERT INTO public.plans(id, name, slug, "maxStudents", features, price, updated_at)
      VALUES($1, 'Basic', 'basic', 9999, '{}', 0, NOW())
      ON CONFLICT DO NOTHING
    `, [PLAN_ID]);

    await client.query(`
      INSERT INTO public.tenants(id, name, slug, plan_id, is_active, limits, schema_name, updated_at)
      VALUES($1, 'مركزي', 'my-center', $2, true, '{}', $3, NOW())
      ON CONFLICT DO NOTHING
    `, [TENANT_ID, PLAN_ID, SCHEMA]);

    console.log('  ✓ plan + tenant');

    // ══════════════════════════════════════════════════════════════
    // 2. إنشاء الـ Schema
    // ══════════════════════════════════════════════════════════════
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${SCHEMA}"`);
    await client.query(`SET search_path TO "${SCHEMA}"`);
    console.log(`  ✓ schema: ${SCHEMA}`);

    // ══════════════════════════════════════════════════════════════
    // 3. Core Tables
    // ══════════════════════════════════════════════════════════════

    // users
    await client.query(`
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
      )
    `);
    await client.query(`GRANT ALL ON TABLE users TO nabgha`);
    console.log('  ✓ users');

    // center_settings
    await client.query(`
      CREATE TABLE IF NOT EXISTS center_settings (
        id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        center_name      VARCHAR(255) NOT NULL DEFAULT 'المركز التعليمي',
        center_logo_url  TEXT,
        center_phone     VARCHAR(20),
        center_address   TEXT,
        currency         VARCHAR(10)  NOT NULL DEFAULT 'EGP',
        currency_symbol  VARCHAR(5)   NOT NULL DEFAULT 'ج.م',
        academic_year    VARCHAR(20),
        created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`GRANT ALL ON TABLE center_settings TO nabgha`);
    console.log('  ✓ center_settings');

    // ══════════════════════════════════════════════════════════════
    // 4. Subjects & Subject Grades
    // ══════════════════════════════════════════════════════════════

    // subjects  (بدون fee/grade — موجودة في subject_grades)
    await client.query(`
      CREATE TABLE IF NOT EXISTS subjects (
        id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        name       VARCHAR(255) NOT NULL,
        color      VARCHAR(7)   NOT NULL DEFAULT '#0E3B2E',
        is_active  BOOLEAN      NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);
    await client.query(`GRANT ALL ON TABLE subjects TO nabgha`);
    console.log('  ✓ subjects');

    // subject_grades
    await client.query(`
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
      )
    `);
    await client.query(`GRANT ALL ON TABLE subject_grades TO nabgha`);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_subject_grades_subject_id
      ON subject_grades(subject_id) WHERE deleted_at IS NULL
    `);
    console.log('  ✓ subject_grades');

    // ══════════════════════════════════════════════════════════════
    // 5. Teachers
    // ══════════════════════════════════════════════════════════════
    await client.query(`
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
      )
    `);
    await client.query(`GRANT ALL ON TABLE teachers TO nabgha`);
    console.log('  ✓ teachers');

    // ══════════════════════════════════════════════════════════════
    // 6. Students
    // ══════════════════════════════════════════════════════════════
    await client.query(`CREATE SEQUENCE IF NOT EXISTS student_code_seq START 1`);
    await client.query(`GRANT USAGE ON SEQUENCE student_code_seq TO nabgha`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS students (
        id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        full_name        VARCHAR(255) NOT NULL,
        parent_phone     VARCHAR(20)  NOT NULL,
        student_phone    VARCHAR(20),
        date_of_birth    DATE,
        grade            VARCHAR(100),
        notes            TEXT,
        qr_code          VARCHAR(255) UNIQUE NOT NULL,
        student_code     VARCHAR(20)  UNIQUE DEFAULT ('STU-' || LPAD(nextval('student_code_seq')::text, 5, '0')),
        telegram_chat_id VARCHAR(50),
        is_active        BOOLEAN      NOT NULL DEFAULT true,
        created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        deleted_at       TIMESTAMPTZ
      )
    `);
    await client.query(`GRANT ALL ON TABLE students TO nabgha`);
    console.log('  ✓ students');

    // ══════════════════════════════════════════════════════════════
    // 7. Groups & Group Students
    // ══════════════════════════════════════════════════════════════
    await client.query(`
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
      )
    `);
    await client.query(`GRANT ALL ON TABLE groups TO nabgha`);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_groups_subject_grade_id
      ON groups(subject_grade_id) WHERE deleted_at IS NULL
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_groups_teacher_id
      ON groups(teacher_id) WHERE deleted_at IS NULL
    `);
    console.log('  ✓ groups');

    await client.query(`
      CREATE TABLE IF NOT EXISTS group_students (
        id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id   UUID          NOT NULL,
        student_id UUID          NOT NULL,
        discount   NUMERIC(10,2) NOT NULL DEFAULT 0,
        joined_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        left_at    TIMESTAMPTZ,
        CONSTRAINT chk_left_after_joined CHECK (left_at IS NULL OR left_at > joined_at)
      )
    `);
    await client.query(`GRANT ALL ON TABLE group_students TO nabgha`);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_group_students_group_id
      ON group_students(group_id) WHERE left_at IS NULL
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_group_students_student_id
      ON group_students(student_id) WHERE left_at IS NULL
    `);
    console.log('  ✓ group_students');

    // ══════════════════════════════════════════════════════════════
    // 8. Sessions & Attendance
    // ══════════════════════════════════════════════════════════════
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        type        VARCHAR(20)  NOT NULL DEFAULT 'lesson'
                      CHECK (type IN ('lesson','lesson_revision','lesson_exam','exam','grade_exam')),
        group_id    UUID,
        grade       VARCHAR(100),
        subject_id  UUID,
        title       VARCHAR(255) NOT NULL,
        out_of      INTEGER,
        start_date  DATE         NOT NULL,
        end_date    DATE,
        start_time  TIME,
        end_time    TIME,
        status      VARCHAR(20)  NOT NULL DEFAULT 'scheduled'
                      CHECK (status IN ('scheduled','ongoing','completed','cancelled')),
        image_url   TEXT,
        notes       TEXT,
        created_by  UUID,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        deleted_at  TIMESTAMPTZ,
        CONSTRAINT chk_group_or_grade CHECK (
          (type != 'grade_exam' AND group_id IS NOT NULL)
          OR
          (type = 'grade_exam' AND grade IS NOT NULL AND subject_id IS NOT NULL)
        )
      )
    `);
    await client.query(`GRANT ALL ON TABLE sessions TO nabgha`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sessions_group_id  ON sessions(group_id)   WHERE deleted_at IS NULL`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sessions_grade      ON sessions(grade)      WHERE deleted_at IS NULL`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sessions_start_date ON sessions(start_date)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sessions_status     ON sessions(status)`);
    console.log('  ✓ sessions');

    await client.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id  UUID         NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        student_id  UUID         NOT NULL,
        status      VARCHAR(20)  NOT NULL DEFAULT 'absent'
                      CHECK (status IN ('present','absent','late')),
        degree      NUMERIC(5,2),
        scanned_at  TIMESTAMPTZ,
        notes       TEXT,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        UNIQUE(session_id, student_id)
      )
    `);
    await client.query(`GRANT ALL ON TABLE attendance TO nabgha`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_attendance_session_id ON attendance(session_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance(student_id)`);
    console.log('  ✓ attendance');

    // ══════════════════════════════════════════════════════════════
    // 9. Finance — Treasuries / Monthly Dues / Payments / Expenses
    // ══════════════════════════════════════════════════════════════
    await client.query(`
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
      )
    `);
    await client.query(`GRANT ALL ON TABLE treasuries TO nabgha`);
    console.log('  ✓ treasuries');

    await client.query(`
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
      )
    `);
    await client.query(`GRANT ALL ON TABLE monthly_dues TO nabgha`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_monthly_dues_student ON monthly_dues(student_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_monthly_dues_month   ON monthly_dues(month)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_monthly_dues_status  ON monthly_dues(status)`);
    console.log('  ✓ monthly_dues');

    await client.query(`CREATE SEQUENCE IF NOT EXISTS payment_receipt_seq`);
    await client.query(`GRANT USAGE ON SEQUENCE payment_receipt_seq TO nabgha`);

    await client.query(`
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
      )
    `);
    await client.query(`GRANT ALL ON TABLE payments TO nabgha`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_student  ON payments(student_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_due      ON payments(monthly_due_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_treasury ON payments(treasury_id)`);
    console.log('  ✓ payments');

    await client.query(`
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
      )
    `);
    await client.query(`GRANT ALL ON TABLE payment_transactions TO nabgha`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_payment_tx_treasury ON payment_transactions(treasury_id)`);
    console.log('  ✓ payment_transactions');

    await client.query(`
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
      )
    `);
    await client.query(`GRANT ALL ON TABLE expenses TO nabgha`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_expenses_date     ON expenses(expense_date)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category)`);
    console.log('  ✓ expenses');

    // ══════════════════════════════════════════════════════════════
    // 10. Notifications & Tenant Settings
    // ══════════════════════════════════════════════════════════════
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        type            VARCHAR(100) NOT NULL,
        recipient_phone VARCHAR(20)  NOT NULL,
        message         TEXT         NOT NULL,
        status          VARCHAR(20)  NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','sent','failed')),
        sent_at         TIMESTAMPTZ,
        created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`GRANT ALL ON TABLE notifications TO nabgha`);
    console.log('  ✓ notifications');

    await client.query(`
      CREATE TABLE IF NOT EXISTS tenant_settings (
        id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        key        VARCHAR(100) UNIQUE NOT NULL,
        value      TEXT         NOT NULL,
        updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`GRANT ALL ON TABLE tenant_settings TO nabgha`);
    console.log('  ✓ tenant_settings');

    // ══════════════════════════════════════════════════════════════
    // 11. WhatsApp Tables
    // ══════════════════════════════════════════════════════════════
    await client.query(`
      CREATE TABLE IF NOT EXISTS wa_sessions (
        id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id         UUID         NOT NULL,
        phone             VARCHAR(20),
        status            VARCHAR(20)  NOT NULL DEFAULT 'disconnected',
        qr_code           TEXT,
        qr_expires_at     TIMESTAMPTZ,
        connected_at      TIMESTAMPTZ,
        disconnected_at   TIMESTAMPTZ,
        warmup_started_at TIMESTAMPTZ,
        warmup_day        INTEGER      NOT NULL DEFAULT 0,
        is_banned         BOOLEAN      NOT NULL DEFAULT false,
        banned_until      TIMESTAMPTZ,
        last_health_check TIMESTAMPTZ,
        created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`GRANT ALL ON TABLE wa_sessions TO nabgha`);
    console.log('  ✓ wa_sessions');

    await client.query(`
      CREATE TABLE IF NOT EXISTS wa_settings (
        id                      UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id               UUID    NOT NULL,
        wa_enabled              BOOLEAN NOT NULL DEFAULT false,
        send_hours_from         VARCHAR(5) NOT NULL DEFAULT '08:00',
        send_hours_to           VARCHAR(5) NOT NULL DEFAULT '22:00',
        daily_limit             INTEGER NOT NULL DEFAULT 50,
        delay_min_seconds       INTEGER NOT NULL DEFAULT 3,
        delay_max_seconds       INTEGER NOT NULL DEFAULT 8,
        warmup_enabled          BOOLEAN NOT NULL DEFAULT true,
        notify_absent           BOOLEAN NOT NULL DEFAULT true,
        notify_present          BOOLEAN NOT NULL DEFAULT false,
        notify_late             BOOLEAN NOT NULL DEFAULT true,
        notify_3_absences       BOOLEAN NOT NULL DEFAULT true,
        late_threshold_min      INTEGER NOT NULL DEFAULT 15,
        notify_payment_confirm  BOOLEAN NOT NULL DEFAULT true,
        notify_payment_due_7d   BOOLEAN NOT NULL DEFAULT true,
        notify_payment_due_1d   BOOLEAN NOT NULL DEFAULT true,
        notify_payment_overdue  BOOLEAN NOT NULL DEFAULT true,
        notify_new_student      BOOLEAN NOT NULL DEFAULT true,
        notify_group_added      BOOLEAN NOT NULL DEFAULT true,
        notify_group_removed    BOOLEAN NOT NULL DEFAULT false,
        notify_student_card     BOOLEAN NOT NULL DEFAULT false,
        created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`GRANT ALL ON TABLE wa_settings TO nabgha`);
    console.log('  ✓ wa_settings');

    await client.query(`
      CREATE TABLE IF NOT EXISTS wa_templates (
        id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id  UUID         NOT NULL,
        key        VARCHAR(50)  NOT NULL,
        body       TEXT         NOT NULL,
        is_default BOOLEAN      NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        UNIQUE(tenant_id, key)
      )
    `);
    await client.query(`GRANT ALL ON TABLE wa_templates TO nabgha`);
    console.log('  ✓ wa_templates');

    await client.query(`
      CREATE TABLE IF NOT EXISTS wa_messages_log (
        id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id    UUID         NOT NULL,
        phone        VARCHAR(20)  NOT NULL,
        template_key VARCHAR(50),
        body         TEXT         NOT NULL,
        status       VARCHAR(20)  NOT NULL DEFAULT 'pending',
        error_message TEXT,
        retry_count  INTEGER      NOT NULL DEFAULT 0,
        sent_at      TIMESTAMPTZ,
        delivered_at TIMESTAMPTZ,
        bulk_job_id  UUID,
        created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`GRANT ALL ON TABLE wa_messages_log TO nabgha`);
    console.log('  ✓ wa_messages_log');

    await client.query(`
      CREATE TABLE IF NOT EXISTS wa_bulk_jobs (
        id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id    UUID         NOT NULL,
        title        VARCHAR(255) NOT NULL,
        body         TEXT         NOT NULL,
        status       VARCHAR(20)  NOT NULL DEFAULT 'pending',
        total        INTEGER      NOT NULL DEFAULT 0,
        sent         INTEGER      NOT NULL DEFAULT 0,
        failed       INTEGER      NOT NULL DEFAULT 0,
        queued       INTEGER      NOT NULL DEFAULT 0,
        created_by   UUID         NOT NULL,
        scheduled_at TIMESTAMPTZ,
        started_at   TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        cancelled_at TIMESTAMPTZ,
        created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`GRANT ALL ON TABLE wa_bulk_jobs TO nabgha`);
    console.log('  ✓ wa_bulk_jobs');

    await client.query(`
      CREATE TABLE IF NOT EXISTS wa_inbound_messages (
        id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id   UUID         NOT NULL,
        phone       VARCHAR(20)  NOT NULL,
        body        TEXT         NOT NULL,
        student_id  UUID,
        is_read     BOOLEAN      NOT NULL DEFAULT false,
        received_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`GRANT ALL ON TABLE wa_inbound_messages TO nabgha`);
    console.log('  ✓ wa_inbound_messages');

    // ══════════════════════════════════════════════════════════════
    // 12. Default Data — admin user + خزينة رئيسية
    // ══════════════════════════════════════════════════════════════
    const hash = await bcrypt.hash(ADMIN_PASS, 10);

    await client.query(`
      INSERT INTO users(id, name, username, password_hash, role, is_active)
      VALUES($1, 'المدير', 'admin', $2, 'tenant_admin', true)
      ON CONFLICT DO NOTHING
    `, [randomUUID(), hash]);
    console.log('  ✓ admin user (username: admin)');

    await client.query(`
      INSERT INTO treasuries(name, type, balance)
      VALUES('الخزينة الرئيسية', 'cash', 0)
      ON CONFLICT DO NOTHING
    `);
    console.log('  ✓ خزينة رئيسية');

    console.log('\n✅ تم إعداد بيانات المركز بنجاح!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Tenant ID : ${TENANT_ID}`);
    console.log(`   Slug      : my-center`);
    console.log(`   Username  : admin`);
    console.log(`   Password  : ${ADMIN_PASS}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (err) {
    console.error('\n❌ فشل الإعداد:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

setup().catch(err => {
  console.error(err);
  process.exit(1);
});