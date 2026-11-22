/**
 * migrate-notify-absence-excused.js
 *
 * Migration مرة واحدة — يضيف عمود notify_absence_excused لجدول wa_settings
 * في كل الـ tenants الموجودة حالياً.
 *
 * الاستخدام:
 *   node migrate-notify-absence-excused.js
 */

const { Pool } = require('pg');

const DB_URL = process.env.DATABASE_URL
  || 'postgresql://nabgha:nabgha123@127.0.0.1:5432/nabgha';

const pool = new Pool({ connectionString: DB_URL });

async function run() {
  const client = await pool.connect();
  try {
    console.log('🔍 جاري جلب الـ tenants...\n');

    // جلب كل الـ tenants الموجودة
    const { rows: tenants } = await client.query(
      `SELECT id, name, schema_name FROM public.tenants WHERE is_active = true`
    );

    console.log(`📋 عدد الـ tenants: ${tenants.length}\n`);

    for (const tenant of tenants) {
      const schema = tenant.schema_name;
      try {
        await client.query(`
          ALTER TABLE ${schema}.wa_settings
          ADD COLUMN IF NOT EXISTS notify_absence_excused BOOLEAN NOT NULL DEFAULT true
        `);
        console.log(`  ✓ ${tenant.name} (${schema})`);
      } catch (err) {
        console.error(`  ✗ ${tenant.name} (${schema}): ${err.message}`);
      }
    }

    console.log('\n✅ Migration اكتملت بنجاح!');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('❌ فشل الـ migration:', err.message);
  process.exit(1);
});
