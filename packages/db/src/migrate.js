const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

// إعادة محاولة الاتصال بقاعدة البيانات بدل الفشل الفوري — لو Postgres لسه بيبدأ
// (مثلاً فور فتح الجهاز، أو خدمة Windows لسه بتقوم) كان pool.connect() بيرمي
// ECONNREFUSED على طول، والسكريبت بيخرج بـ exit code=1، وده كان بيخلي تطبيق
// سطح المكتب (main.ts) يقفل البرنامج كله فورًا بدل ما يستنى — وده السبب اللي
// كان بيخلي المستخدم يحتاج يفتح البرنامج أكتر من مرة لحد ما Postgres يخلص
// بدء تشغيله. دلوقتي بنستنى لحد 30 ثانية (محاولة كل ثانية) قبل ما نستسلم فعلاً.
async function connectWithRetry(dbPool, { retries = 30, delayMs = 1000 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await dbPool.connect();
    } catch (err) {
      if (attempt === retries) throw err;
      console.log(`  ⏳ قاعدة البيانات لسه مش جاهزة (محاولة ${attempt}/${retries}): ${err.message} — هعيد المحاولة بعد ثانية...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

const PLATFORM_ADMIN = {
  email: 'admin@nabgha.com',
  password: 'Nabgha@Admin2026',
  name: 'Super Admin',
};

async function ensureMigrationsTable(client, schema) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${schema}.schema_migrations (
      version    VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(client, schema) {
  const { rows } = await client.query(
    `SELECT version FROM ${schema}.schema_migrations ORDER BY version`
  );
  return rows.map(r => r.version);
}

async function getMigrationFiles(type) {
  const dir = path.join(MIGRATIONS_DIR, type);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .sort();
}

// ── Public Schema ─────────────────────────────────────────────
async function runPublicMigrations(client) {
  console.log('\n📦 Public Schema Migrations...');
  await ensureMigrationsTable(client, 'public');
  const applied = await getAppliedMigrations(client, 'public');
  const files = await getMigrationFiles('public');

  for (const file of files) {
    const version = `public/${file}`;
    if (applied.includes(version)) {
      console.log(`  ⏭  Skipped: ${version}`);
      continue;
    }
    console.log(`  → Applying: ${version}`);
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, 'public', file), 'utf8');
    await client.query(sql);
    await client.query(
      `INSERT INTO public.schema_migrations (version) VALUES ($1)`,
      [version]
    );
    console.log(`  ✓ Done: ${version}`);
  }

  // seed platform admin بـ bcrypt hash صح
  const existing = await client.query(
    `SELECT id FROM public.platform_users WHERE email = $1`,
    [PLATFORM_ADMIN.email]
  );
  if (existing.rows.length === 0) {
    const hash = await bcrypt.hash(PLATFORM_ADMIN.password, 10);
    await client.query(`
      INSERT INTO public.platform_users (id, email, password_hash, name, is_super_admin, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, $3, true, NOW(), NOW())
    `, [PLATFORM_ADMIN.email, hash, PLATFORM_ADMIN.name]);
    console.log(`  ✓ Platform admin created: ${PLATFORM_ADMIN.email}`);
  } else {
    console.log(`  ⏭  Platform admin already exists`);
  }
}

// ── Tenant Schema ─────────────────────────────────────────────
async function runTenantMigrations(client, tenantId) {
  const schema = `tenant_${tenantId.replace(/-/g, '_')}`;
  console.log(`\n🏫 Tenant: ${schema}`);

  await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  await ensureMigrationsTable(client, `"${schema}"`);

  const applied = await getAppliedMigrations(client, `"${schema}"`);
  const files = await getMigrationFiles('tenant');

  for (const file of files) {
    const version = `tenant/${file}`;
    if (applied.includes(version)) {
      console.log(`  ⏭  Skipped: ${version}`);
      continue;
    }
    console.log(`  → Applying: ${version}`);
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, 'tenant', file), 'utf8');
    await client.query(`SET search_path TO "${schema}"`);
    await client.query(sql);
    await client.query(
      `INSERT INTO "${schema}".schema_migrations (version) VALUES ($1)`,
      [version]
    );
    console.log(`  ✓ Done: ${version}`);
  }
}

// ── Provision New Tenant (من NestJS) ─────────────────────────
async function provisionTenant(client, tenantId, adminData) {
  await runTenantMigrations(client, tenantId);

  if (adminData) {
    const schema = `tenant_${tenantId.replace(/-/g, '_')}`;
    const hash = await bcrypt.hash(adminData.password, 10);
    await client.query(`SET search_path TO "${schema}"`);
    await client.query(`
      INSERT INTO users (username, password_hash, name, role, permissions)
      VALUES ($1, $2, $3, 'tenant_admin', '[]')
      ON CONFLICT (username) DO NOTHING
    `, [adminData.username, hash, adminData.name]);
    await client.query(`
      INSERT INTO center_settings (center_name) VALUES ($1)
    `, [adminData.centerName]);
    console.log(`  ✓ Admin created: ${adminData.username}`);
  }
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  const client = await connectWithRetry(pool);
  try {
    await runPublicMigrations(client);

    const { rows: tenants } = await client.query(
      `SELECT id FROM public.tenants ORDER BY created_at`
    );
    console.log(`\nFound ${tenants.length} tenant(s)`);
    for (const tenant of tenants) {
      await runTenantMigrations(client, tenant.id);
    }

    console.log('\n🎉 All migrations completed successfully!');
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

module.exports = { provisionTenant, runTenantMigrations };

if (require.main === module) {
  main();
}
