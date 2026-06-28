const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrateSessions(tenantId) {
  const schema = `tenant_${tenantId.replace(/-/g, '_')}`;
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schema}"`);

    // ─── Drop & recreate sessions ──────────────────────────────
    await client.query(`DROP TABLE IF EXISTS attendance`);
    await client.query(`DROP TABLE IF EXISTS sessions`);

    await client.query(`
      CREATE TABLE sessions (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type            VARCHAR(20) NOT NULL DEFAULT 'lesson',
        group_id        UUID,
        grade           VARCHAR(100),
        subject_id      UUID,
        title           VARCHAR(255) NOT NULL,
        out_of          INTEGER,
        start_date      DATE NOT NULL,
        end_date        DATE,
        start_time      TIME,
        end_time        TIME,
        status          VARCHAR(20) NOT NULL DEFAULT 'scheduled',
        image_url       TEXT,
        notes           TEXT,
        created_by      UUID,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at      TIMESTAMPTZ,
        CONSTRAINT chk_session_type CHECK (
          type IN ('lesson','lesson_revision','lesson_exam','exam','grade_exam')
        ),
        CONSTRAINT chk_session_status CHECK (
          status IN ('scheduled','ongoing','completed','cancelled')
        ),
        CONSTRAINT chk_group_or_grade CHECK (
          (type != 'grade_exam' AND group_id IS NOT NULL)
          OR
          (type = 'grade_exam' AND grade IS NOT NULL AND subject_id IS NOT NULL)
        )
      )
    `);
    await client.query(`GRANT ALL ON TABLE sessions TO nabgha`);
    await client.query(`CREATE INDEX idx_sessions_group_id   ON sessions(group_id) WHERE deleted_at IS NULL`);
    await client.query(`CREATE INDEX idx_sessions_grade       ON sessions(grade)    WHERE deleted_at IS NULL`);
    await client.query(`CREATE INDEX idx_sessions_start_date  ON sessions(start_date)`);
    await client.query(`CREATE INDEX idx_sessions_status      ON sessions(status)`);

    // ─── attendance ────────────────────────────────────────────
    await client.query(`
      CREATE TABLE attendance (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        student_id  UUID NOT NULL,
        status      VARCHAR(20) NOT NULL DEFAULT 'absent',
        degree      NUMERIC(5,2),
        scanned_at  TIMESTAMPTZ,
        notes       TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(session_id, student_id),
        CONSTRAINT chk_attendance_status CHECK (
          status IN ('present','absent','late')
        )
      )
    `);
    await client.query(`GRANT ALL ON TABLE attendance TO nabgha`);
    await client.query(`CREATE INDEX idx_attendance_session_id ON attendance(session_id)`);
    await client.query(`CREATE INDEX idx_attendance_student_id ON attendance(student_id)`);

    console.log(`✅ ${schema} — sessions + attendance done`);
  } catch (err) {
    console.error(`❌ ${schema}:`, err.message);
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    const { rows } = await pool.query(`SELECT id FROM public.tenants`);
    if (rows.length === 0) {
      console.log('⚠️  No tenants found — running on test tenant only');
      await migrateSessions('00000000-0000-0000-0000-000000000001');
    } else {
      for (const row of rows) {
        await migrateSessions(row.id);
      }
    }
    console.log('🎉 Migration complete');
  } finally {
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
