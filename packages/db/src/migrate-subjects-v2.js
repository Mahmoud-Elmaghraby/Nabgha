const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrateTenant(client, tenantId) {
  const schema = `tenant_${tenantId.replace(/-/g, '_')}`;
  console.log(`\n→ Migrating: ${schema}`);
  await client.query(`SET search_path TO "${schema}"`);

  // 1. subjects
  await client.query(`
    CREATE TABLE IF NOT EXISTS subjects (
      id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      name       VARCHAR(255) NOT NULL,
      color      VARCHAR(7)  NOT NULL DEFAULT '#0E3B2E',
      is_active  BOOLEAN     NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await client.query(`ALTER TABLE subjects DROP COLUMN IF EXISTS fee`);
  await client.query(`ALTER TABLE subjects DROP COLUMN IF EXISTS default_fee`);
  await client.query(`ALTER TABLE subjects DROP COLUMN IF EXISTS payment_type`);
  await client.query(`ALTER TABLE subjects DROP COLUMN IF EXISTS session_duration`);
  await client.query(`ALTER TABLE subjects DROP COLUMN IF EXISTS grade`);
  await client.query(`GRANT ALL ON TABLE subjects TO nabgha`);
  console.log(`  ✓ subjects`);

  // 2. subject_grades
  await client.query(`
    CREATE TABLE IF NOT EXISTS subject_grades (
      id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      subject_id       UUID         NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      grade            VARCHAR(100) NOT NULL,
      fee              NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (fee >= 0),
      payment_type     VARCHAR(20)  NOT NULL DEFAULT 'monthly'
                         CHECK (payment_type IN ('monthly', 'per_session', 'termly')),
      session_duration INTEGER      NOT NULL DEFAULT 60 CHECK (session_duration > 0),
      is_active        BOOLEAN      NOT NULL DEFAULT true,
      created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      deleted_at       TIMESTAMPTZ,
      UNIQUE(subject_id, grade)
    )
  `);
  await client.query(`GRANT ALL ON TABLE subject_grades TO nabgha`);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_subject_grades_subject_id
    ON subject_grades(subject_id) WHERE deleted_at IS NULL
  `);
  console.log(`  ✓ subject_grades`);

  // 3. groups
  await client.query(`
    ALTER TABLE groups
      ADD COLUMN IF NOT EXISTS subject_grade_id UUID REFERENCES subject_grades(id) ON DELETE SET NULL
  `);
  await client.query(`ALTER TABLE groups DROP COLUMN IF EXISTS monthly_fee`);
  await client.query(`ALTER TABLE groups DROP COLUMN IF EXISTS subject`);
  await client.query(`ALTER TABLE groups DROP COLUMN IF EXISTS subject_id`);
  await client.query(`ALTER TABLE groups DROP COLUMN IF EXISTS grade`);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_groups_subject_grade_id
    ON groups(subject_grade_id) WHERE deleted_at IS NULL
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_groups_teacher_id
    ON groups(teacher_id) WHERE deleted_at IS NULL
  `);
  console.log(`  ✓ groups`);

  // 4. group_students
  await client.query(`
    ALTER TABLE group_students
      ADD COLUMN IF NOT EXISTS discount NUMERIC(10,2) NOT NULL DEFAULT 0
  `);
  await client.query(`
    DO $$ BEGIN
      ALTER TABLE group_students
        DROP CONSTRAINT IF EXISTS group_students_group_id_student_id_key;
    EXCEPTION WHEN others THEN NULL;
    END $$
  `);
  await client.query(`
    DO $$ BEGIN
      ALTER TABLE group_students ADD CONSTRAINT chk_left_after_joined
        CHECK (left_at IS NULL OR left_at > joined_at);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_group_students_group_id
    ON group_students(group_id) WHERE left_at IS NULL
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_group_students_student_id
    ON group_students(student_id) WHERE left_at IS NULL
  `);
  console.log(`  ✓ group_students`);

  // 5. payments
  await client.query(`CREATE SEQUENCE IF NOT EXISTS payments_receipt_seq`);
  await client.query(`GRANT USAGE ON SEQUENCE payments_receipt_seq TO nabgha`);
  await client.query(`
    ALTER TABLE payments
      ADD COLUMN IF NOT EXISTS subject_grade_id UUID REFERENCES subject_grades(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS discount_applied  NUMERIC(10,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS payment_type      VARCHAR(20)   NOT NULL DEFAULT 'monthly'
  `);
  await client.query(`ALTER TABLE payments DROP COLUMN IF EXISTS amount`);
  await client.query(`
    DO $$ BEGIN
      ALTER TABLE payments ADD CONSTRAINT chk_paid_lte_due
        CHECK (paid_amount <= due_amount);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `);
  await client.query(`
    DO $$ BEGIN
      ALTER TABLE payments ADD CONSTRAINT chk_paid_at_when_paid
        CHECK (status != 'paid' OR paid_at IS NOT NULL);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_payments_student_id ON payments(student_id)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_payments_group_id ON payments(group_id)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status) WHERE status != 'paid'
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_payments_month ON payments(month)
  `);
  console.log(`  ✓ payments`);

  console.log(`\n✅ ${schema} done`);
}

async function migrate() {
  const client = await pool.connect();
  try {
    const { rows: tenants } = await client.query(
      `SELECT id FROM public.tenants ORDER BY created_at`
    );
    console.log(`Found ${tenants.length} tenant(s)`);
    for (const tenant of tenants) {
      await migrateTenant(client, tenant.id);
    }
    console.log('\n🎉 migrate-subjects-v2 completed!');
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    console.error(err.detail || '');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(() => process.exit(1));
