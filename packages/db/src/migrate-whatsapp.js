const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrateWhatsApp() {
  const client = await pool.connect();
  try {
    const tenantsResult = await client.query(
      `SELECT id FROM public.tenants`
    );
    const tenants = tenantsResult.rows;
    console.log(`Found ${tenants.length} tenants`);

    for (const tenant of tenants) {
      const schemaName = `tenant_${tenant.id.replace(/-/g, '_')}`;
      console.log(`Migrating schema: ${schemaName}`);

      await client.query(`SET search_path = ${schemaName}`);

      // wa_sessions
      await client.query(`
        CREATE TABLE IF NOT EXISTS wa_sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL,
          phone VARCHAR(20),
          status VARCHAR(20) NOT NULL DEFAULT 'disconnected',
          qr_code TEXT,
          qr_expires_at TIMESTAMPTZ,
          connected_at TIMESTAMPTZ,
          disconnected_at TIMESTAMPTZ,
          warmup_started_at TIMESTAMPTZ,
          warmup_day INTEGER NOT NULL DEFAULT 0,
          is_banned BOOLEAN NOT NULL DEFAULT false,
          banned_until TIMESTAMPTZ,
          last_health_check TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await client.query(`GRANT ALL ON TABLE wa_sessions TO nabgha`);

      // wa_settings
      await client.query(`
        CREATE TABLE IF NOT EXISTS wa_settings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL,
          wa_enabled BOOLEAN NOT NULL DEFAULT false,
          send_hours_from VARCHAR(5) NOT NULL DEFAULT '08:00',
          send_hours_to VARCHAR(5) NOT NULL DEFAULT '22:00',
          daily_limit INTEGER NOT NULL DEFAULT 50,
          delay_min_seconds INTEGER NOT NULL DEFAULT 3,
          delay_max_seconds INTEGER NOT NULL DEFAULT 8,
          warmup_enabled BOOLEAN NOT NULL DEFAULT true,
          notify_absent BOOLEAN NOT NULL DEFAULT true,
          notify_present BOOLEAN NOT NULL DEFAULT false,
          notify_late BOOLEAN NOT NULL DEFAULT true,
          notify_3_absences BOOLEAN NOT NULL DEFAULT true,
          late_threshold_min INTEGER NOT NULL DEFAULT 15,
          notify_payment_confirm BOOLEAN NOT NULL DEFAULT true,
          notify_payment_due_7d BOOLEAN NOT NULL DEFAULT true,
          notify_payment_due_1d BOOLEAN NOT NULL DEFAULT true,
          notify_payment_overdue BOOLEAN NOT NULL DEFAULT true,
          notify_new_student BOOLEAN NOT NULL DEFAULT true,
          notify_group_added BOOLEAN NOT NULL DEFAULT true,
          notify_group_removed BOOLEAN NOT NULL DEFAULT false,
          notify_student_card BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      // Patch existing tables that may be missing notify_group_removed
      await client.query(`
        ALTER TABLE wa_settings
          ADD COLUMN IF NOT EXISTS notify_group_removed BOOLEAN NOT NULL DEFAULT false
      `);
      await client.query(`GRANT ALL ON TABLE wa_settings TO nabgha`);


      // wa_templates
      await client.query(`
        CREATE TABLE IF NOT EXISTS wa_templates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL,
          key VARCHAR(50) NOT NULL,
          body TEXT NOT NULL,
          is_default BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(tenant_id, key)
        )
      `);
      await client.query(`GRANT ALL ON TABLE wa_templates TO nabgha`);

      // wa_messages_log
      await client.query(`
        CREATE TABLE IF NOT EXISTS wa_messages_log (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL,
          phone VARCHAR(20) NOT NULL,
          template_key VARCHAR(50),
          body TEXT NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          error_message TEXT,
          sent_at TIMESTAMPTZ,
          delivered_at TIMESTAMPTZ,
          bulk_job_id UUID,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await client.query(`GRANT ALL ON TABLE wa_messages_log TO nabgha`);

      // wa_bulk_jobs
      await client.query(`
        CREATE TABLE IF NOT EXISTS wa_bulk_jobs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL,
          title VARCHAR(255) NOT NULL,
          body TEXT NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          total INTEGER NOT NULL DEFAULT 0,
          sent INTEGER NOT NULL DEFAULT 0,
          failed INTEGER NOT NULL DEFAULT 0,
          queued INTEGER NOT NULL DEFAULT 0,
          created_by UUID NOT NULL,
          scheduled_at TIMESTAMPTZ,
          started_at TIMESTAMPTZ,
          completed_at TIMESTAMPTZ,
          cancelled_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await client.query(`GRANT ALL ON TABLE wa_bulk_jobs TO nabgha`);

      // wa_inbound_messages
      await client.query(`
        CREATE TABLE IF NOT EXISTS wa_inbound_messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL,
          phone VARCHAR(20) NOT NULL,
          body TEXT NOT NULL,
          student_id UUID,
          is_read BOOLEAN NOT NULL DEFAULT false,
          received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await client.query(`GRANT ALL ON TABLE wa_inbound_messages TO nabgha`);

      console.log(`✅ ${schemaName} — done`);
    }

    console.log('✅ WhatsApp migration completed');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrateWhatsApp();
