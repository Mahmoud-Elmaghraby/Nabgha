const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const client = await pool.connect();
  try {
    const { rows: tenants } = await client.query(`SELECT id FROM public.tenants`);

    for (const tenant of tenants) {
      const schema = `tenant_${tenant.id.replace(/-/g, '_')}`;
      await client.query(`SET search_path = ${schema}`);

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
      await client.query(`GRANT ALL ON TABLE center_settings TO nabgha`);

      await client.query(`
        CREATE TABLE IF NOT EXISTS subjects (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          grade VARCHAR(100),
          color VARCHAR(7) DEFAULT '#0E3B2E',
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          deleted_at TIMESTAMPTZ
        )
      `);
      await client.query(`GRANT ALL ON TABLE subjects TO nabgha`);

      console.log(`✅ ${schema}`);
    }
    console.log('Done');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
