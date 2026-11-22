/**
 * migrate-telegram-tables.js — إضافة جداول تليجرام للـ tenants الموجودين
 *
 * آمن للتشغيل أكتر من مرة (IF NOT EXISTS / CREATE INDEX IF NOT EXISTS).
 * يطبّق migrations 016-021 على كل tenant نشط في قاعدة البيانات.
 *
 * تشغيل:
 *   node apps/api/migrate-telegram-tables.js
 */

const { Pool } = require('pg');

const DB_URL =
  process.env.DATABASE_URL ||
  'postgresql://nabgha:nabgha123@127.0.0.1:5432/nabgha';

const pool = new Pool({ connectionString: DB_URL });

async function migrateSchema(client, schema) {
  await client.query(`SET search_path TO "${schema}"`);

  // 016 — telegram_links
  await client.query(`
    CREATE TABLE IF NOT EXISTS telegram_links (
      id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      entity_type VARCHAR(20)  NOT NULL,
      entity_id   UUID         NOT NULL,
      chat_id     VARCHAR(50)  NOT NULL,
      linked_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      UNIQUE(entity_type, entity_id)
    )
  `);
  await client.query(`GRANT ALL ON TABLE telegram_links TO nabgha`);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_telegram_links_chat_id ON telegram_links(chat_id)
  `);

  // 018 — telegram_settings
  await client.query(`
    CREATE TABLE IF NOT EXISTS telegram_settings (
      id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id              UUID        NOT NULL UNIQUE,
      telegram_enabled       BOOLEAN     NOT NULL DEFAULT false,
      send_hours_from        VARCHAR(5)  NOT NULL DEFAULT '08:00',
      send_hours_to          VARCHAR(5)  NOT NULL DEFAULT '22:00',
      notify_absent          BOOLEAN     NOT NULL DEFAULT true,
      notify_present         BOOLEAN     NOT NULL DEFAULT false,
      notify_late            BOOLEAN     NOT NULL DEFAULT true,
      notify_3_absences      BOOLEAN     NOT NULL DEFAULT true,
      notify_payment_confirm BOOLEAN     NOT NULL DEFAULT true,
      notify_payment_due_7d  BOOLEAN     NOT NULL DEFAULT true,
      notify_payment_due_1d  BOOLEAN     NOT NULL DEFAULT true,
      notify_payment_overdue BOOLEAN     NOT NULL DEFAULT true,
      notify_new_student     BOOLEAN     NOT NULL DEFAULT true,
      notify_group_added     BOOLEAN     NOT NULL DEFAULT true,
      notify_group_removed   BOOLEAN     NOT NULL DEFAULT false,
      notify_absence_excused BOOLEAN     NOT NULL DEFAULT true,
      notify_grade_recorded  BOOLEAN     NOT NULL DEFAULT true,
      created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`GRANT ALL ON TABLE telegram_settings TO nabgha`);

  // 019 — telegram_templates
  await client.query(`
    CREATE TABLE IF NOT EXISTS telegram_templates (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id   UUID        NOT NULL,
      key         VARCHAR(50) NOT NULL,
      body        TEXT        NOT NULL,
      is_default  BOOLEAN     NOT NULL DEFAULT true,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (tenant_id, key)
    )
  `);
  await client.query(`GRANT ALL ON TABLE telegram_templates TO nabgha`);

  // 020 — telegram_messages
  await client.query(`
    CREATE TABLE IF NOT EXISTS telegram_messages (
      id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id     UUID        NOT NULL,
      chat_id       VARCHAR(64) NOT NULL,
      entity_type   VARCHAR(20) NOT NULL,
      entity_id     UUID        NOT NULL,
      template_key  VARCHAR(50),
      body          TEXT        NOT NULL,
      status        VARCHAR(20) NOT NULL DEFAULT 'pending',
      error_message TEXT,
      sent_at       TIMESTAMPTZ,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`GRANT ALL ON TABLE telegram_messages TO nabgha`);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_telegram_messages_tenant ON telegram_messages(tenant_id)
  `);

  // 021 — telegram_inbound_messages
  await client.query(`
    CREATE TABLE IF NOT EXISTS telegram_inbound_messages (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id   UUID        NOT NULL,
      chat_id     VARCHAR(64) NOT NULL,
      body        TEXT        NOT NULL,
      entity_type VARCHAR(20),
      entity_id   UUID,
      is_read     BOOLEAN     NOT NULL DEFAULT false,
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`GRANT ALL ON TABLE telegram_inbound_messages TO nabgha`);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_telegram_inbound_tenant ON telegram_inbound_messages(tenant_id)
  `);
}

async function run() {
  const client = await pool.connect();
  try {
    console.log('🚀 بدء تطبيق جداول تليجرام على كل الـ tenants النشطين...\n');

    // جيب كل tenants النشطين
    const { rows: tenants } = await client.query(
      `SELECT id, name, schema_name FROM public.tenants WHERE is_active = true ORDER BY name`,
    );

    if (tenants.length === 0) {
      console.log('⚠️  لا يوجد tenants نشطين.');
      return;
    }

    for (const tenant of tenants) {
      try {
        await migrateSchema(client, tenant.schema_name);
        console.log(`  ✓ ${tenant.name} (${tenant.schema_name})`);
      } catch (err) {
        console.error(`  ✗ ${tenant.name}: ${err.message}`);
      }
    }

    console.log('\n✅ انتهى! جداول تليجرام جاهزة لكل الـ tenants.');
    console.log('   الآن روّح لإعدادات التليجرام في الواجهة وفعّل الخدمة.');
  } catch (err) {
    console.error('\n❌ فشل:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
