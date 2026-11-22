/**
 * seed-telegram-defaults.js — يغلق الفجوة اللي سكريبت migrate-telegram-tables.js
 * سابها: الجداول اتعملت (016/018/019/020/021) لكن فاضية تمامًا — من غير صف
 * افتراضي في telegram_settings ولا الـ 12 قالب في telegram_templates، الإشعارات
 * لسه مش هتشتغل حتى لو الجداول موجودة، لأن TelegramNotifyUseCase.execute()
 * بيرجع 'telegram_disabled' فورًا لو settings=null، و'template_not_found' لو
 * مفيش صف قالب. الموقعين التانيين (getOrCreate/getAllTemplates في الباك إند)
 * بيعملوا الـ seed ده تلقائي بس *لما* حد يفتح تبويب "الإعدادات" أو "القوالب"
 * في الواجهة — السكريبت ده بيعمل نفس الحاجة مباشرة على كل الـ tenants دفعة
 * واحدة، من غير ما نستنى حد يفتح الشاشة.
 *
 * كمان بيسيب صف migration 017 (TELEGRAM_LINK داخل wa_templates) اللي
 * migrate-telegram-tables.js ما عملهوش خالص — من غيره "الإرسال الجماعي لروابط
 * تليجرام" (اللي بيتبعت عبر الواتساب) هيفشل بـ template_not_found لكل الطلاب.
 *
 * آمن للتشغيل أكتر من مرة (ON CONFLICT DO NOTHING في كل حتة).
 *
 * تشغيل:
 *   node apps/api/seed-telegram-defaults.js
 */

const { Pool } = require('pg');

const DB_URL =
  process.env.DATABASE_URL ||
  'postgresql://nabgha:nabgha123@127.0.0.1:5432/nabgha';

const pool = new Pool({ connectionString: DB_URL });

const TELEGRAM_DEFAULT_TEMPLATES = {
  ABSENT:           '{center_name}: نحيطكم علماً بغياب الطالب {student_name} عن حصة {subject} بتاريخ {date}',
  PRESENT:          '{center_name}: تم تسجيل حضور الطالب {student_name} لحصة {subject} في تمام الساعة {time}',
  LATE:             '{center_name}: تم تسجيل تأخر الطالب {student_name} عن حصة {subject} بتاريخ {date}',
  THREE_ABSENCES:   '{center_name}: نلفت انتباهكم إلى غياب الطالب {student_name} {count} مرات متتالية في مادة {subject}. يُرجى التواصل مع إدارة المركز',
  PAYMENT_CONFIRM:  '{center_name}: نفيدكم بأنه تم استلام مبلغ {amount} جنيه من الطالب {student_name} بتاريخ {date}. شكراً لتعاملكم معنا',
  PAYMENT_DUE:      '{center_name}: نذكّركم بأن موعد استحقاق سداد الطالب {student_name} ({amount} جنيه) يحل بعد {days} يوم',
  PAYMENT_OVERDUE:  '{center_name}: نحيطكم علماً بتأخر سداد مستحقات الطالب {student_name} البالغة {amount} جنيه منذ {days} يوم. يُرجى التواصل مع الإدارة',
  NEW_STUDENT:      '{center_name}: تم تسجيل الطالب {student_name} بنجاح. نتمنى له تجربة تعليمية مثمرة',
  GROUP_ADDED:      '{center_name}: تم إلحاق الطالب {student_name} بمجموعة {group_name} — الأيام: {days}، الساعة: {time}',
  GROUP_REMOVED:    '{center_name}: تم إخراج الطالب {student_name} من مجموعة {group_name}',
  ABSENCE_EXCUSED:  '{center_name}: تم اعتبار غياب الطالب {student_name} عن حصة {subject} بتاريخ {date} معذوراً نظراً لحضوره حصة بديلة',
  GRADE_RECORDED:   '{center_name}: درجة الطالب {student_name} في {subject} بتاريخ {date}: {degree} من {out_of}',
};

const TELEGRAM_LINK_BODY =
  '{center_name}: لمتابعة إشعارات الطالب {student_name} على تليجرام، افتح الرابط واضغط Start:\n{link}';

async function seedSchema(client, schema, tenantId) {
  await client.query(`SET search_path TO "${schema}"`);

  // 1) صف telegram_settings افتراضي — لو الجدول من غيره الإشعارات هترجع
  //    'telegram_disabled' فورًا حتى لو telegram_enabled=true منطقيًا مفروض
  //    تتفعل يدوي، لكن على الأقل الصف لازم يكون موجود عشان أي تفعيل بعد كده يشتغل.
  const settingsResult = await client.query(`
    INSERT INTO telegram_settings (tenant_id)
    VALUES ($1)
    ON CONFLICT (tenant_id) DO NOTHING
    RETURNING id
  `, [tenantId]);

  // 2) الـ 12 قالب الافتراضي
  let templatesInserted = 0;
  for (const [key, body] of Object.entries(TELEGRAM_DEFAULT_TEMPLATES)) {
    const r = await client.query(`
      INSERT INTO telegram_templates (tenant_id, key, body, is_default)
      VALUES ($1, $2, $3, true)
      ON CONFLICT (tenant_id, key) DO NOTHING
      RETURNING id
    `, [tenantId, key, body]);
    if (r.rowCount > 0) templatesInserted++;
  }

  // 3) قالب TELEGRAM_LINK داخل wa_templates (migration 017 اللي اتنسيت من
  //    السكريبت اللي فات) — من غيره "الإرسال الجماعي لروابط تليجرام" (اللي بيتبعت
  //    عبر الواتساب) هيفشل بـ template_not_found لكل طالب.
  const linkResult = await client.query(`
    INSERT INTO wa_templates (tenant_id, key, body, is_default)
    VALUES ($1, 'TELEGRAM_LINK', $2, true)
    ON CONFLICT (tenant_id, key) DO NOTHING
    RETURNING id
  `, [tenantId, TELEGRAM_LINK_BODY]);

  return {
    settingsCreated: settingsResult.rowCount > 0,
    templatesInserted,
    linkTemplateCreated: linkResult.rowCount > 0,
  };
}

async function run() {
  const client = await pool.connect();
  try {
    console.log('🚀 بدء زرع البيانات الافتراضية لتليجرام على كل الـ tenants النشطين...\n');

    const { rows: tenants } = await client.query(
      `SELECT id, name, schema_name FROM public.tenants WHERE is_active = true ORDER BY name`,
    );

    if (tenants.length === 0) {
      console.log('⚠️  لا يوجد tenants نشطين.');
      return;
    }

    for (const tenant of tenants) {
      try {
        const r = await seedSchema(client, tenant.schema_name, tenant.id);
        console.log(
          `  ✓ ${tenant.name} — settings:${r.settingsCreated ? 'اتعمل' : 'موجود بالفعل'}, ` +
          `قوالب جديدة:${r.templatesInserted}/12, ` +
          `TELEGRAM_LINK:${r.linkTemplateCreated ? 'اتعمل' : 'موجود بالفعل'}`,
        );
      } catch (err) {
        console.error(`  ✗ ${tenant.name}: ${err.message}`);
      }
    }

    console.log('\n✅ انتهى! البيانات الافتراضية جاهزة لكل الـ tenants.');
    console.log('   ملحوظة مهمة: telegram_enabled = false افتراضيًا لكل مركز —');
    console.log('   لازم كل مركز يفعّل الإشعارات بنفسه من تبويب "الإعدادات" في صفحة تليجرام.');
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
