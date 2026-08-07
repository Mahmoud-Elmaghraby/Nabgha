const { Pool } = require('pg');
const { execSync } = require('child_process');
const path = require('path');

const DB_URL = 'postgresql://nabgha:nabgha123@127.0.0.1:5432/nabgha';
const ADMIN_URL = 'postgresql://postgres:nabgha123@127.0.0.1:5432/postgres';

async function run() {
  console.log('بدء إعداد قاعدة البيانات...');

  // 1. إنشاء user + database
  const adminPool = new Pool({ connectionString: ADMIN_URL });
  try {
    await adminPool.query(`CREATE USER nabgha WITH PASSWORD 'nabgha123'`);
    console.log('تم إنشاء المستخدم');
  } catch (e) {
    console.log('المستخدم موجود بالفعل');
  }
  try {
    await adminPool.query(`CREATE DATABASE nabgha OWNER nabgha`);
    console.log('تم إنشاء قاعدة البيانات');
  } catch (e) {
    console.log('قاعدة البيانات موجودة بالفعل');
  }
  await adminPool.end();

  // 2. Prisma db push
  console.log('جاري إعداد جداول النظام...');
  try {
    execSync(
      `"${path.join(__dirname, 'node_modules/.bin/prisma')}" db push --schema="${path.join(__dirname, 'schema.prisma')}" --skip-generate`,
      {
        env: { ...process.env, DATABASE_URL: DB_URL },
        stdio: 'inherit',
        cwd: __dirname
      }
    );
    console.log('تم إعداد جداول النظام');
  } catch (e) {
    console.error('فشل Prisma:', e.message);
  }

  console.log('تم إعداد قاعدة البيانات بنجاح!');
}

run().catch(console.error);