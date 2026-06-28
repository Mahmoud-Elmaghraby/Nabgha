const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrateTenant(client, tenantId) {
  const schema = `tenant_${tenantId.replace(/-/g, '_')}`;
  await client.query(`SET search_path = "${schema}"`);

  // teachers table (new standalone entity)
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
  await client.query(`GRANT ALL ON TABLE teachers TO nabgha`);

  // students table (idempotent — already in migrate-tenants.js)
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
  await client.query(`GRANT ALL ON TABLE students TO nabgha`);

  // groups table (idempotent) — add subject_id column if missing
  await client.query(`
    CREATE TABLE IF NOT EXISTS groups (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      subject VARCHAR(255),
      teacher_id UUID,
      max_students INTEGER NOT NULL DEFAULT 30,
      monthly_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
      schedule JSONB NOT NULL DEFAULT '[]',
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await client.query(`GRANT ALL ON TABLE groups TO nabgha`);
  await client.query(`ALTER TABLE groups ADD COLUMN IF NOT EXISTS subject_id UUID`);
  // allow NULL teacher_id — original migrate-tenants.js created it as NOT NULL
  await client.query(`ALTER TABLE groups ALTER COLUMN teacher_id DROP NOT NULL`);

  // group_students table (idempotent)
  await client.query(`
    CREATE TABLE IF NOT EXISTS group_students (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      group_id UUID NOT NULL,
      student_id UUID NOT NULL,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      left_at TIMESTAMPTZ,
      UNIQUE(group_id, student_id)
    )
  `);
  await client.query(`GRANT ALL ON TABLE group_students TO nabgha`);

  // add new columns to subjects
  await client.query(`ALTER TABLE subjects ADD COLUMN IF NOT EXISTS default_fee NUMERIC(10,2) NOT NULL DEFAULT 0`);
  await client.query(`ALTER TABLE subjects ADD COLUMN IF NOT EXISTS payment_type VARCHAR(20) NOT NULL DEFAULT 'monthly'`);
  await client.query(`ALTER TABLE subjects ADD COLUMN IF NOT EXISTS session_duration INTEGER NOT NULL DEFAULT 60`);

  console.log(`✅ ${schema}`);
}

async function migrate() {
  const client = await pool.connect();
  try {
    const { rows: tenants } = await client.query(`SELECT id FROM public.tenants`);
    console.log(`Found ${tenants.length} tenants`);
    for (const tenant of tenants) {
      await migrateTenant(client, tenant.id);
    }
    console.log('🎉 migrate-core completed!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);
