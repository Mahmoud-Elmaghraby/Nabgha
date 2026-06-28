const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const client = await pool.connect();
  try {
    // جيب كل الـ tenant schemas
    const { rows: tenants } = await client.query(`
      SELECT id FROM public.tenants WHERE is_active = true
    `);

    for (const tenant of tenants) {
      const schema = `tenant_${tenant.id.replace(/-/g, '_')}`;
      console.log(`Migrating ${schema}...`);

      await client.query(`
        ALTER TABLE ${schema}.students
        ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(50) NULL;
      `);

      // جدول لإعدادات التليجرام
      await client.query(`
        INSERT INTO ${schema}.tenant_settings (key, value, updated_at)
        VALUES ('telegram_bot_token', '', NOW())
        ON CONFLICT (key) DO NOTHING;
      `);

      console.log(`✅ ${schema} done`);
    }

    console.log('Migration completed!');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);
