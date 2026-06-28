const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function createTenantSchema(tenantId) {
  const schemaName = `tenant_${tenantId.replace(/-/g, '_')}`;
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    await client.query(`SET search_path TO "${schemaName}"`);
    await client.query(`CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email VARCHAR(255) UNIQUE, username VARCHAR(100) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL, name VARCHAR(255) NOT NULL, role VARCHAR(50) NOT NULL DEFAULT 'teacher', permissions JSONB DEFAULT '[]', is_active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted_at TIMESTAMPTZ)`);
    await client.query(`GRANT ALL ON TABLE users TO nabgha`);
    await client.query(`CREATE TABLE IF NOT EXISTS students (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), full_name VARCHAR(255) NOT NULL, parent_phone VARCHAR(20) NOT NULL, student_phone VARCHAR(20), date_of_birth DATE, grade VARCHAR(100), notes TEXT, qr_code VARCHAR(255) UNIQUE NOT NULL, is_active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted_at TIMESTAMPTZ)`);
    await client.query(`GRANT ALL ON TABLE students TO nabgha`);
    await client.query(`CREATE TABLE IF NOT EXISTS groups (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(255) NOT NULL, subject VARCHAR(255), teacher_id UUID NOT NULL, max_students INTEGER NOT NULL DEFAULT 30, monthly_fee NUMERIC(10,2) NOT NULL DEFAULT 0, schedule JSONB NOT NULL DEFAULT '[]', is_active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted_at TIMESTAMPTZ)`);
    await client.query(`GRANT ALL ON TABLE groups TO nabgha`);
    await client.query(`CREATE TABLE IF NOT EXISTS group_students (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), group_id UUID NOT NULL, student_id UUID NOT NULL, joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), left_at TIMESTAMPTZ, UNIQUE(group_id, student_id))`);
    await client.query(`GRANT ALL ON TABLE group_students TO nabgha`);
    await client.query(`CREATE TABLE IF NOT EXISTS sessions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), group_id UUID NOT NULL, date DATE NOT NULL, start_time TIME NOT NULL, end_time TIME NOT NULL, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await client.query(`GRANT ALL ON TABLE sessions TO nabgha`);
    await client.query(`CREATE TABLE IF NOT EXISTS attendance (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), session_id UUID NOT NULL, student_id UUID NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'present', notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(session_id, student_id))`);
    await client.query(`GRANT ALL ON TABLE attendance TO nabgha`);
    await client.query(`CREATE SEQUENCE IF NOT EXISTS payments_receipt_seq`);
    await client.query(`GRANT USAGE ON SEQUENCE payments_receipt_seq TO nabgha`);
    await client.query(`CREATE TABLE IF NOT EXISTS payments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), student_id UUID NOT NULL, group_id UUID NOT NULL, amount NUMERIC(10,2) NOT NULL, month VARCHAR(7) NOT NULL, payment_method VARCHAR(20) NOT NULL DEFAULT 'cash', receipt_number INTEGER NOT NULL DEFAULT nextval('payments_receipt_seq'), notes TEXT, paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await client.query(`GRANT ALL ON TABLE payments TO nabgha`);
    await client.query(`CREATE TABLE IF NOT EXISTS notifications (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), type VARCHAR(100) NOT NULL, recipient_phone VARCHAR(20) NOT NULL, message TEXT NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'pending', sent_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await client.query(`GRANT ALL ON TABLE notifications TO nabgha`);
    await client.query(`CREATE TABLE IF NOT EXISTS tenant_settings (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), key VARCHAR(100) UNIQUE NOT NULL, value TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await client.query(`GRANT ALL ON TABLE tenant_settings TO nabgha`);
    console.log(`✅ Schema created: ${schemaName}`);
  } finally {
    client.release();
  }
}

async function migrateAllTenants() {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT id, schema_name FROM public.tenants');
    console.log(`Found ${result.rows.length} tenants`);
    for (const tenant of result.rows) {
      await createTenantSchema(tenant.id);
    }
    console.log('🎉 Migration completed!');
  } finally {
    client.release();
    await pool.end();
  }
}

migrateAllTenants().catch(console.error);
