import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';

export interface ProvisionTenantInput {
  schemaName: string;
  centerName: string;
  adminUsername: string;
  adminPassword: string;
  adminName: string;
}

/**
 * مسار ملفات الـ tenant migrations.
 * في الإنتاج/الديسكتوب بييجي من DB_MIGRATIONS_PATH، وفي التطوير بنرجع لـ packages/db
 * (dist/shared/infrastructure/database → 6 مستويات لحد جذر الـ monorepo).
 */
export function resolveTenantMigrationsDir(): string {
  return process.env.DB_MIGRATIONS_PATH
    ? path.join(process.env.DB_MIGRATIONS_PATH, 'tenant')
    : path.join(__dirname, '..', '..', '..', '..', '..', '..', 'packages', 'db', 'src', 'migrations', 'tenant');
}

/**
 * ينشئ schema المركز ويطبّق عليها كل الـ tenant migrations بالترتيب، ثم ينشئ
 * حساب الأدمن وإعدادات المركز. المصدر الوحيد لتجهيز أي مركز جديد
 * (لوحة المنصة + معالج إعداد الديسكتوب) — عشان أي migration جديدة توصل للكل.
 */
export async function provisionTenantSchema(input: ProvisionTenantInput): Promise<void> {
  const { schemaName } = input;
  if (!/^tenant_[a-z0-9_]+$/.test(schemaName)) {
    throw new Error(`Invalid tenant schema name: ${schemaName}`);
  }

  const migrationsDir = resolveTenantMigrationsDir();
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Tenant migrations directory not found: ${migrationsDir}`);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".schema_migrations (
        version    VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const files = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const version = `tenant/${file}`;
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query(`SET search_path TO "${schemaName}"`);
      await client.query(sql);
      await client.query(
        `INSERT INTO "${schemaName}".schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING`,
        [version],
      );
    }

    const passwordHash = await bcrypt.hash(input.adminPassword, 10);
    await client.query(`SET search_path TO "${schemaName}"`);
    await client.query(
      `INSERT INTO users (username, password_hash, name, role, permissions)
       VALUES ($1, $2, $3, 'tenant_admin', '[]')
       ON CONFLICT (username) DO NOTHING`,
      [input.adminUsername, passwordHash, input.adminName],
    );
    await client.query(
      `INSERT INTO center_settings (center_name) VALUES ($1)`,
      [input.centerName],
    );
  } finally {
    client.release();
    await pool.end();
  }
}
