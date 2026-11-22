// سكريبت تشخيص فقط — قراءة بيانات (SELECT) بدون أي تعديل على قاعدة البيانات إطلاقًا
// الهدف: التأكد هل السبب هو وجود أكثر من صف تسجيل نشط (group_students) لنفس الطالب
// في نفس المادة (subject_grade) عبر أكثر من مجموعة — بخصومات مختلفة، مما يخلي
// generateDues() ياخد خصم صف عشوائي (0 غالبًا) بدل الصف اللي اتسجل فيه الخصم فعليًا.
// pg مش hoisted لمجلد node_modules الرئيسي مع pnpm — بنستخدم المسار المباشر داخل .pnpm store
const { Client } = require(require('path').join(__dirname, '..', '..', 'node_modules', '.pnpm', 'pg@8.21.0', 'node_modules', 'pg'));
const fs = require('fs');
const path = require('path');

// تحميل DATABASE_URL من .env يدويًا (بدون الاعتماد على مكتبة dotenv)
(function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  const raw = fs.readFileSync(envPath, 'utf-8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
})();

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // لازم نعرف كل الـ schemas الخاصة بالمستأجرين (كل مركز/معلم له schema منفصل)
  const { rows: schemas } = await client.query(`
    SELECT nspname FROM pg_namespace
    WHERE nspname LIKE 'tenant_%'
    ORDER BY nspname;
  `);

  console.log(`عدد الـ tenants الموجودة: ${schemas.length}`);

  for (const { nspname: schema } of schemas) {
    // هل الجدول موجود في هذا الـ schema (بعض الـ schemas ممكن تكون قديمة/غير مهيأة)
    const { rows: tblCheck } = await client.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = $1 AND table_name = 'group_students' LIMIT 1;
    `, [schema]);
    if (tblCheck.length === 0) continue;

    const { rows: dupes } = await client.query(`
      SELECT
        gs.student_id,
        s.full_name AS student_name,
        g.subject_grade_id,
        COUNT(*) AS active_enrollment_rows,
        STRING_AGG(g.name || ' (خصم=' || gs.discount || ')', ' | ') AS groups_and_discounts
      FROM "${schema}".group_students gs
      JOIN "${schema}".groups g ON g.id = gs.group_id
      JOIN "${schema}".students s ON s.id = gs.student_id
      WHERE gs.left_at IS NULL
        AND g.deleted_at IS NULL
        AND s.deleted_at IS NULL
      GROUP BY gs.student_id, s.full_name, g.subject_grade_id
      HAVING COUNT(*) > 1
      ORDER BY s.full_name;
    `);

    if (dupes.length > 0) {
      console.log(`\n=== Tenant: ${schema} — طلاب لهم أكثر من تسجيل نشط لنفس المادة ===`);
      for (const d of dupes) {
        console.log(`  الطالب: ${d.student_name} — عدد التسجيلات: ${d.active_enrollment_rows} — ${d.groups_and_discounts}`);
      }
    }

    // فواتير شهر 9-2026 غير مدفوعة بخصم = 0، بينما الطالب له تسجيل نشط بخصم > 0
    // لنفس المادة — يعني الفاتورة اتولدت من صف بدون الخصم
    const { rows: mismatches } = await client.query(`
      SELECT
        s.full_name AS student_name,
        md.month,
        md.due_amount,
        md.discount_applied AS invoice_discount,
        gs.discount AS enrollment_discount,
        g.name AS group_name,
        md.created_at AS due_created_at,
        gs.joined_at AS enrollment_joined_at
      FROM "${schema}".monthly_dues md
      JOIN "${schema}".students s ON s.id = md.student_id
      JOIN "${schema}".group_students gs ON gs.student_id = md.student_id
      JOIN "${schema}".groups g ON g.id = gs.group_id AND g.subject_grade_id = md.subject_grade_id
      WHERE md.status IN ('unpaid', 'partial')
        AND gs.left_at IS NULL
        AND g.deleted_at IS NULL
        AND md.discount_applied = 0
        AND gs.discount > 0
      ORDER BY md.month DESC, s.full_name;
    `);

    if (mismatches.length > 0) {
      console.log(`\n=== Tenant: ${schema} — فواتير غير مدفوعة اتولدت بدون خصم رغم وجود خصم نشط ===`);
      for (const m of mismatches) {
        console.log(`  الطالب: ${m.student_name} — شهر: ${m.month} — المبلغ: ${m.due_amount} — خصم الفاتورة: ${m.invoice_discount} — خصم التسجيل النشط: ${m.enrollment_discount} (مجموعة: ${m.group_name}) — الفاتورة اتعملت: ${m.due_created_at} — التسجيل بدأ: ${m.enrollment_joined_at}`);
      }
    }
  }

  await client.end();
  console.log('\nانتهى التشخيص.');
}

main().catch(err => { console.error('خطأ:', err); process.exit(1); });
