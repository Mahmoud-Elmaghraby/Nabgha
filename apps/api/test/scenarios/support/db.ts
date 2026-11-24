import { Pool } from 'pg';

/**
 * اتصال قاعدة بيانات الاختبارات — Postgres محلي فيه schema اسمها tenant_t
 * متطبّق عليها كل الـ tenant migrations (شوف setup-db.sh).
 * القيم من متغيرات البيئة عشان كل مطوّر يشغّلها على جهازه.
 */
export function testPool(max = 10): Pool {
  return new Pool({
    host: process.env.TEST_PG_HOST ?? '/tmp',
    port: Number(process.env.TEST_PG_PORT ?? 5544),
    user: process.env.TEST_PG_USER ?? 'postgres',
    password: process.env.TEST_PG_PASSWORD,
    database: process.env.TEST_PG_DB ?? 'nabtest',
    max,
  });
}
