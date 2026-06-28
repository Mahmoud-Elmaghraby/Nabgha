const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrateTenant(client, tenantId) {
  const schema = `tenant_${tenantId.replace(/-/g, '_')}`;
  console.log(`\n→ Migrating: ${schema}`);

  await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  await client.query(`SET search_path TO "${schema}"`);

  // users
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE,
      username VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'teacher',
      permissions JSONB DEFAULT '[]',
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    )
  `);

  // center_settings
  await client.query(`
    CREATE TABLE IF NOT EXISTS center_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      center_name VARCHAR(255) NOT NULL DEFAULT 'المركز التعليمي',
      center_logo_url TEXT,
      center_phone VARCHAR(20),
      center_address TEXT,
      currency VARCHAR(10) NOT NULL DEFAULT 'EGP',
      currency_symbol VARCHAR(5) NOT NULL DEFAULT 'ج.م',
      academic_year VARCHAR(20),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // subjects — fee بدل default_fee، بدون grade
  await client.query(`
    CREATE TABLE IF NOT EXISTS subjects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      color VARCHAR(7) DEFAULT '#0E3B2E',
      fee NUMERIC(10,2) NOT NULL DEFAULT 0,
      payment_type VARCHAR(20) NOT NULL DEFAULT 'monthly',
      session_duration INTEGER NOT NULL DEFAULT 60,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    )
  `);

  // إصلاح subjects لو كانت موجودة بالـ schema القديم
  await client.query(`ALTER TABLE subjects ADD COLUMN IF NOT EXISTS fee NUMERIC(10,2) NOT NULL DEFAULT 0`);
  await client.query(`ALTER TABLE subjects ADD COLUMN IF NOT EXISTS payment_type VARCHAR(20) NOT NULL DEFAULT 'monthly'`);
  await client.query(`ALTER TABLE subjects ADD COLUMN IF NOT EXISTS session_duration INTEGER NOT NULL DEFAULT 60`);
  await client.query(`ALTER TABLE subjects DROP COLUMN IF EXISTS default_fee`);
  await client.query(`ALTER TABLE subjects DROP COLUMN IF EXISTS grade`);

  // teachers
  await client.query(`
    CREATE TABLE IF NOT EXISTS teachers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(20),
      email VARCHAR(255),
      subject_ids JSONB NOT NULL DEFAULT '[]',
      notes TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    )
  `);

  // students
  await client.query(`
    CREATE TABLE IF NOT EXISTS students (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      full_name VARCHAR(255) NOT NULL,
      parent_phone VARCHAR(20) NOT NULL,
      student_phone VARCHAR(20),
      date_of_birth DATE,
      grade VARCHAR(100),
      notes TEXT,
      qr_code VARCHAR(255) UNIQUE NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    )
  `);

  // groups — grade على group، بدون monthly_fee
  await client.query(`
    CREATE TABLE IF NOT EXISTS groups (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      subject_id UUID,
      teacher_id UUID,
      grade VARCHAR(100),
      max_students INTEGER NOT NULL DEFAULT 30,
      schedule JSONB NOT NULL DEFAULT '[]',
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    )
  `);

  // إصلاح groups لو كانت موجودة بالـ schema القديم
  await client.query(`ALTER TABLE groups ADD COLUMN IF NOT EXISTS subject_id UUID`);
  await client.query(`ALTER TABLE groups ADD COLUMN IF NOT EXISTS grade VARCHAR(100)`);
  await client.query(`ALTER TABLE groups DROP COLUMN IF EXISTS monthly_fee`);
  await client.query(`ALTER TABLE groups DROP COLUMN IF EXISTS subject`);
  await client.query(`ALTER TABLE groups ALTER COLUMN teacher_id DROP NOT NULL`);

  // group_students — بدون UNIQUE constraint
  await client.query(`
    CREATE TABLE IF NOT EXISTS group_students (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      group_id UUID NOT NULL,
      student_id UUID NOT NULL,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      left_at TIMESTAMPTZ
    )
  `);

  // شيل الـ UNIQUE constraint لو موجودة
  await client.query(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'group_students_group_id_student_id_key'
        AND conrelid = '"${schema}".group_students'::regclass
      ) THEN
        ALTER TABLE group_students DROP CONSTRAINT group_students_group_id_student_id_key;
      END IF;
    EXCEPTION WHEN others THEN NULL;
    END $$
  `);

  // sessions
  await client.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      group_id UUID NOT NULL,
      date DATE NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'scheduled'`);

  // attendance
  await client.query(`
    CREATE TABLE IF NOT EXISTS attendance (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL,
      student_id UUID NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'present',
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(session_id, student_id)
    )
  `);

  // payments — schema جديد كامل
  await client.query(`CREATE SEQUENCE IF NOT EXISTS payments_receipt_seq`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id UUID NOT NULL,
      group_id UUID NOT NULL,
      subject_id UUID,
      month VARCHAR(7) NOT NULL,
      due_amount NUMERIC(10,2) NOT NULL,
      paid_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      payment_method VARCHAR(20) NOT NULL DEFAULT 'cash',
      receipt_number INTEGER NOT NULL DEFAULT nextval('payments_receipt_seq'),
      notes TEXT,
      created_by UUID,
      paid_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // إصلاح payments لو كانت موجودة بالـ schema القديم
  await client.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS subject_id UUID`);
  await client.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS due_amount NUMERIC(10,2)`);
  await client.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending'`);
  await client.query(`ALTER TABLE payments DROP COLUMN IF EXISTS amount`);

  // notifications
  await client.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type VARCHAR(100) NOT NULL,
      recipient_phone VARCHAR(20) NOT NULL,
      message TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // tenant_settings
  await client.query(`
    CREATE TABLE IF NOT EXISTS tenant_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key VARCHAR(100) UNIQUE NOT NULL,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // GRANT
  const tables = ['users','center_settings','subjects','teachers','students',
    'groups','group_students','sessions','attendance','payments',
    'notifications','tenant_settings'];
  for (const t of tables) {
    await client.query(`GRANT ALL ON TABLE ${t} TO nabgha`).catch(() => {});
  }
  await client.query(`GRANT USAGE ON SEQUENCE payments_receipt_seq TO nabgha`).catch(() => {});

  console.log(`✅ ${schema} done`);
}

async function migrate() {
  const client = await pool.connect();
  try {
    const { rows: tenants } = await client.query(`SELECT id FROM public.tenants`);
    console.log(`Found ${tenants.length} tenants`);
    for (const tenant of tenants) {
      await migrateTenant(client, tenant.id);
    }
    console.log('\n🎉 migrate-all completed!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);
