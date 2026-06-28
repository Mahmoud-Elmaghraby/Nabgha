const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migratePayments(tenantId) {
  const schema = `tenant_${tenantId.replace(/-/g, '_')}`;
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schema}"`);

    // ─── Treasuries ───────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS treasuries (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR(255) NOT NULL,
        type        VARCHAR(20) NOT NULL DEFAULT 'cash',
        balance     NUMERIC(10,2) NOT NULL DEFAULT 0,
        is_active   BOOLEAN NOT NULL DEFAULT true,
        notes       TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at  TIMESTAMPTZ,
        CONSTRAINT chk_treasury_type CHECK (type IN ('cash','bank','vodafone','instapay','other'))
      )
    `);
    await client.query(`GRANT ALL ON TABLE treasuries TO nabgha`);

    // ─── Monthly Dues ─────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS monthly_dues (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id        UUID NOT NULL,
        subject_grade_id  UUID NOT NULL,
        month             VARCHAR(7) NOT NULL,
        due_amount        NUMERIC(10,2) NOT NULL,
        discount_applied  NUMERIC(10,2) NOT NULL DEFAULT 0,
        paid_amount       NUMERIC(10,2) NOT NULL DEFAULT 0,
        status            VARCHAR(20) NOT NULL DEFAULT 'unpaid',
        notes             TEXT,
        created_by        UUID,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(student_id, subject_grade_id, month),
        CONSTRAINT chk_due_status CHECK (
          status IN ('unpaid','partial','paid','waived')
        )
      )
    `);
    await client.query(`GRANT ALL ON TABLE monthly_dues TO nabgha`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_monthly_dues_student ON monthly_dues(student_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_monthly_dues_month ON monthly_dues(month)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_monthly_dues_status ON monthly_dues(status)`);

    // ─── Receipt sequence ─────────────────────────────────────
    await client.query(`CREATE SEQUENCE IF NOT EXISTS payment_receipt_seq`);
    await client.query(`GRANT USAGE ON SEQUENCE payment_receipt_seq TO nabgha`);

    // ─── Payments ─────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id      UUID NOT NULL,
        monthly_due_id  UUID NOT NULL REFERENCES monthly_dues(id),
        treasury_id     UUID NOT NULL REFERENCES treasuries(id),
        amount          NUMERIC(10,2) NOT NULL,
        payment_method  VARCHAR(20) NOT NULL DEFAULT 'cash',
        receipt_number  INTEGER NOT NULL DEFAULT nextval('payment_receipt_seq'),
        status          VARCHAR(20) NOT NULL DEFAULT 'paid',
        cancel_reason   TEXT,
        refund_amount   NUMERIC(10,2),
        notes           TEXT,
        created_by      UUID,
        paid_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT chk_payment_method CHECK (
          payment_method IN ('cash','visa','instapay','vodafone','bank','other')
        ),
        CONSTRAINT chk_payment_status CHECK (
          status IN ('paid','cancelled','refunded','partial_refund')
        )
      )
    `);
    await client.query(`GRANT ALL ON TABLE payments TO nabgha`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_due ON payments(monthly_due_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_treasury ON payments(treasury_id)`);

    // ─── Payment Transactions (Audit Trail) ───────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_transactions (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        payment_id      UUID REFERENCES payments(id),
        treasury_id     UUID NOT NULL REFERENCES treasuries(id),
        type            VARCHAR(20) NOT NULL,
        amount          NUMERIC(10,2) NOT NULL,
        balance_before  NUMERIC(10,2) NOT NULL,
        balance_after   NUMERIC(10,2) NOT NULL,
        notes           TEXT,
        created_by      UUID,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT chk_transaction_type CHECK (
          type IN ('income','cancellation','refund','expense')
        )
      )
    `);
    await client.query(`GRANT ALL ON TABLE payment_transactions TO nabgha`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_payment_tx_treasury ON payment_transactions(treasury_id)`);

    // ─── Expenses ─────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        treasury_id   UUID NOT NULL REFERENCES treasuries(id),
        category      VARCHAR(50) NOT NULL,
        title         VARCHAR(255) NOT NULL,
        amount        NUMERIC(10,2) NOT NULL,
        expense_date  DATE NOT NULL DEFAULT CURRENT_DATE,
        notes         TEXT,
        created_by    UUID,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at    TIMESTAMPTZ,
        CONSTRAINT chk_expense_category CHECK (
          category IN ('electricity','water','gas','rent','salary','maintenance','supplies','other')
        )
      )
    `);
    await client.query(`GRANT ALL ON TABLE expenses TO nabgha`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category)`);

    // ─── Default Treasury ─────────────────────────────────────
    await client.query(`
      INSERT INTO treasuries (name, type, balance)
      VALUES ('الخزينة الرئيسية', 'cash', 0)
      ON CONFLICT DO NOTHING
    `);

    console.log(`✅ ${schema} — payments migration done`);
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
      await migratePayments('00000000-0000-0000-0000-000000000001');
    } else {
      for (const row of rows) await migratePayments(row.id);
    }
    console.log('🎉 Migration complete');
  } finally {
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
