const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrateTenant(client, tenantId) {
  const schema = `tenant_${tenantId.replace(/-/g, '_')}`;
  await client.query(`SET search_path TO "${schema}"`);

  // sequence للكود التلقائي
  await client.query(`CREATE SEQUENCE IF NOT EXISTS student_code_seq START 1`);
  await client.query(`GRANT USAGE ON SEQUENCE student_code_seq TO nabgha`);

  // إضافة حقل student_code للجدول
  await client.query(`
    ALTER TABLE students
      ADD COLUMN IF NOT EXISTS student_code VARCHAR(20) UNIQUE
  `);

  // تحديث الطلاب الموجودين اللي مش عندهم كود
  await client.query(`
    UPDATE students
    SET student_code = 'STU-' || LPAD(nextval('student_code_seq')::text, 5, '0')
    WHERE student_code IS NULL AND deleted_at IS NULL
  `);

  console.log(`  ✓ ${schema}`);
}

async function migrate() {
  const client = await pool.connect();
  try {
    const { rows: tenants } = await client.query(`SELECT id FROM public.tenants ORDER BY created_at`);
    console.log(`Found ${tenants.length} tenant(s)`);
    for (const tenant of tenants) {
      await migrateTenant(client, tenant.id);
    }
    console.log('\n🎉 migrate-student-code completed!');
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(() => process.exit(1));
