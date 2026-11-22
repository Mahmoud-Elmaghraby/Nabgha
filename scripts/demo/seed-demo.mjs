#!/usr/bin/env node
/**
 * نبغة — إنشاء مركز تجريبي (مدرس واحد بمجموعاته) ببيانات واقعية للعرض على العملاء.
 *
 * بيشتغل بالكامل عن طريق الـ API (مش قاعدة البيانات مباشرة)، فبيمر على نفس الـ validation
 * والقواعد بتاعة البرنامج. محتاج Node 18+.
 *
 * الاستخدام:
 *   API_URL=https://example.com/api/v1 \
 *   PLATFORM_EMAIL=admin@... PLATFORM_PASSWORD=... \
 *   DEMO_SLUG=demo DEMO_ADMIN_USER=demo DEMO_ADMIN_PASS=Demo@2026 \
 *   node scripts/demo/seed-demo.mjs
 *
 * ⚠️ أرقام أولياء الأمور وهمية — ماتوصّلش واتساب حقيقي على المركز التجريبي.
 */

const API = (process.env.API_URL || '').replace(/\/$/, '');
const PLATFORM_EMAIL = process.env.PLATFORM_EMAIL;
const PLATFORM_PASSWORD = process.env.PLATFORM_PASSWORD;
const SLUG = process.env.DEMO_SLUG || 'demo';
const ADMIN_USER = process.env.DEMO_ADMIN_USER || 'demo';
const ADMIN_PASS = process.env.DEMO_ADMIN_PASS || 'Demo@2026';
const TEACHER = process.env.DEMO_TEACHER || 'أ/ أحمد سامي';
const CENTER_NAME = process.env.DEMO_CENTER || 'أ/ أحمد سامي — رياضيات';
const WEEKS = Number(process.env.DEMO_WEEKS || 6);

if (!API || !PLATFORM_EMAIL || !PLATFORM_PASSWORD) {
  console.error('لازم API_URL و PLATFORM_EMAIL و PLATFORM_PASSWORD');
  process.exit(1);
}

// ─── HTTP ────────────────────────────────────────────────────
let token = null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let calls = 0;

async function api(method, path, body, { auth = true, allow404 = false } = {}) {
  for (let attempt = 0; attempt < 8; attempt++) {
    calls++;
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 429) { // حد الطلبات — نستنى ونعيد
      process.stdout.write('⏳');
      await sleep(15000);
      continue;
    }
    if (res.status === 204) return null;
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (allow404 && res.status === 404) return null;
      const msg = json?.error?.message || res.statusText;
      throw new Error(`${method} ${path} → ${res.status}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
    }
    return json;
  }
  throw new Error(`${method} ${path} → too many 429`);
}

// ─── بيانات عشوائية ثابتة (نفس النتيجة كل مرة) ──────────────
let seed = 20261122;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const chance = (p) => rand() < p;

const BOYS = ['محمد', 'أحمد', 'يوسف', 'عمر', 'علي', 'مصطفى', 'محمود', 'خالد', 'إبراهيم', 'حسن', 'عبدالرحمن', 'زياد', 'مازن', 'آدم', 'كريم', 'سيف', 'ياسين', 'مروان', 'أنس', 'حمزة'];
const GIRLS = ['مريم', 'فاطمة', 'سلمى', 'نور', 'جنى', 'ملك', 'هنا', 'رحمة', 'آية', 'سارة', 'حبيبة', 'منة', 'لجين', 'روان', 'ندى', 'دينا', 'شهد', 'تسنيم', 'جميلة', 'يارا'];
const FATHERS = ['محمد', 'أحمد', 'محمود', 'علي', 'حسن', 'سيد', 'عادل', 'طارق', 'هشام', 'وائل', 'أشرف', 'سامح', 'إيهاب', 'خالد', 'ياسر', 'شريف', 'عمرو', 'جمال', 'رضا', 'سعيد'];
const FAMILIES = ['عبدالله', 'السيد', 'إبراهيم', 'مصطفى', 'عبدالعزيز', 'الشافعي', 'النجار', 'سليمان', 'رمضان', 'فرج', 'منصور', 'حسين', 'الشريف', 'عثمان', 'زكي'];
const SCHOOLS = ['مدرسة السعيدية الثانوية', 'مدرسة الأورمان الثانوية', 'مدرسة النصر للغات', 'مدرسة الشهيد أحمد حمدي', 'مدرسة الإبراهيمية الثانوية'];

let phoneSeq = 0;
const fakePhone = () => `0100000${String(++phoneSeq).padStart(4, '0')}`;
const studentName = () => {
  const first = chance(0.5) ? pick(BOYS) : pick(GIRLS);
  return `${first} ${pick(FATHERS)} ${pick(FAMILIES)}`;
};

// ─── التواريخ ────────────────────────────────────────────────
const DAY_INDEX = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const monthKey = (d) => fmt(d).slice(0, 7);

function pastDatesFor(day, weeks) {
  const out = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(today);
  d.setDate(d.getDate() - weeks * 7);
  while (d < today) { // النهارده نفسه مستبعد — حصص النهارده بتتعمل وقت العرض
    if (d.getDay() === DAY_INDEX[day]) out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

// ─── الخطة ───────────────────────────────────────────────────
const GRADES = [
  { grade: 'ثالث ثانوي', fee: 450, groups: [
    { name: 'ثالث ثانوي — مجموعة السبت والثلاثاء', schedule: [['saturday', '16:00', '18:00'], ['tuesday', '16:00', '18:00']], size: 16 },
    { name: 'ثالث ثانوي — مجموعة الأحد والأربعاء', schedule: [['sunday', '18:00', '20:00'], ['wednesday', '18:00', '20:00']], size: 14 },
  ] },
  { grade: 'ثاني ثانوي', fee: 350, groups: [
    { name: 'ثاني ثانوي — مجموعة الاثنين', schedule: [['monday', '16:00', '18:00']], size: 13 },
    { name: 'ثاني ثانوي — مجموعة الخميس', schedule: [['thursday', '15:00', '17:00']], size: 11 },
  ] },
  { grade: 'أول ثانوي', fee: 300, groups: [
    { name: 'أول ثانوي — مجموعة الأحد', schedule: [['sunday', '15:00', '16:30']], size: 12 },
  ] },
];

// ─── التنفيذ ─────────────────────────────────────────────────
const log = (...a) => console.log(...a);

async function main() {
  log(`🚀 إنشاء مركز تجريبي "${CENTER_NAME}" على ${API}`);

  // 1) دخول لوحة المنصة + إنشاء المركز
  const pl = await api('POST', '/auth/platform/login', { email: PLATFORM_EMAIL, password: PLATFORM_PASSWORD }, { auth: false });
  token = pl.data.accessToken;

  const tenants = (await api('GET', `/platform/tenants?search=${encodeURIComponent(SLUG)}`)).data;
  if ((Array.isArray(tenants) ? tenants : tenants?.data || []).some((t) => t.slug === SLUG)) {
    throw new Error(`فيه مركز بالـ slug "${SLUG}" بالفعل — غيّر DEMO_SLUG أو امسح القديم`);
  }
  const plans = (await api('GET', '/platform/plans')).data;
  const plan = (Array.isArray(plans) ? plans : plans?.data || [])[0];
  if (!plan) throw new Error('مفيش ولا خطة (plan) على السيرفر');

  await api('POST', '/platform/tenants', {
    name: CENTER_NAME, slug: SLUG, planId: plan.id,
    adminUsername: ADMIN_USER, adminPassword: ADMIN_PASS, adminName: TEACHER,
  });
  log('✅ المركز اتعمل');

  // 2) دخول المركز
  const tl = await api('POST', '/auth/login', { slug: SLUG, username: ADMIN_USER, password: ADMIN_PASS }, { auth: false });
  token = tl.data.accessToken;

  await api('PUT', '/settings/center', {
    centerName: CENTER_NAME, centerPhone: '01000000000',
    centerAddress: 'مدينة نصر — القاهرة', academicYear: '2026/2027',
  });

  // 3) المادة والصفوف والمدرس
  const subject = (await api('POST', '/subjects', { name: 'رياضيات', color: '#0E3B2E' })).data;
  const gradeIds = {};
  for (const g of GRADES) {
    const sg = (await api('POST', `/subjects/${subject.id}/grades`, {
      grade: g.grade, fee: g.fee, paymentType: 'monthly', sessionDuration: 120,
    })).data;
    gradeIds[g.grade] = sg.id;
  }
  const teacher = (await api('POST', '/teachers', { name: TEACHER, phone: '01000000000', subjectIds: [subject.id] })).data;
  log('✅ المادة والصفوف والمدرس');

  // 4) المجموعات والطلاب
  const groups = [];
  for (const g of GRADES) {
    for (const gr of g.groups) {
      const group = (await api('POST', '/groups', {
        name: gr.name, subjectGradeId: gradeIds[g.grade], teacherId: teacher.id, maxStudents: 25,
        schedule: gr.schedule.map(([day, startTime, endTime]) => ({ day, startTime, endTime })),
      })).data;
      const students = [];
      for (let i = 0; i < gr.size; i++) {
        const st = (await api('POST', '/students', {
          fullName: studentName(), parentPhone: fakePhone(), grade: g.grade, school: pick(SCHOOLS),
        })).data;
        // خصم إخوات/ظروف لحوالي 10% من الطلاب
        const discount = chance(0.1) ? pick([50, 100]) : 0;
        await api('POST', `/groups/${group.id}/students`, { studentId: st.id, discount });
        // "شخصية" ثابتة لكل طالب: منتظم / بيتأخر / بيغيب كتير
        const kind = rand();
        students.push({ id: st.id, attendP: kind < 0.15 ? 0.7 : kind < 0.3 ? 0.85 : 0.96, skill: 0.55 + rand() * 0.45 });
      }
      groups.push({ ...gr, id: group.id, grade: g.grade, students });
      process.stdout.write('.');
    }
  }
  log(`\n✅ ${groups.length} مجموعات، ${groups.reduce((s, g) => s + g.students.length, 0)} طالب`);

  // 5) الحصص والحضور والامتحانات (آخر WEEKS أسابيع)
  let sessionsCount = 0;
  for (const group of groups) {
    const dates = group.schedule.flatMap(([day, start, end]) =>
      pastDatesFor(day, WEEKS).map((d) => ({ d, start, end }))).sort((a, b) => a.d - b.d);
    let lessonNo = 0;
    for (const [idx, s] of dates.entries()) {
      // كل رابع حصة امتحان
      const isExam = (idx + 1) % 4 === 0;
      lessonNo += isExam ? 0 : 1;
      const session = (await api('POST', '/sessions', {
        type: isExam ? 'lesson_exam' : 'lesson',
        title: isExam ? `امتحان شامل على الدروس ${Math.max(1, lessonNo - 2)}-${lessonNo}` : `الدرس ${lessonNo}`,
        groupId: group.id, startDate: fmt(s.d), startTime: s.start, endTime: s.end,
        ...(isExam ? { outOf: 20 } : {}),
      })).data;

      const updates = group.students.map((st) => {
        const r = rand();
        const status = r < st.attendP ? (chance(0.08) ? 'late' : 'present') : 'absent';
        const u = { studentId: st.id, status };
        if (isExam && status !== 'absent') {
          u.degree = Math.max(4, Math.min(20, Math.round(20 * st.skill + (rand() - 0.5) * 5)));
        }
        return u;
      });
      await api('PATCH', `/sessions/${session.id}/attendance`, { updates });
      await api('PATCH', `/sessions/${session.id}/start`);
      await api('PATCH', `/sessions/${session.id}/complete`);
      sessionsCount++;
      process.stdout.write('.');
    }
  }
  log(`\n✅ ${sessionsCount} حصة بالحضور والدرجات`);

  // 6) حضور بديل (تعويض) لكام طالب في المجموعة التانية لنفس الصف
  const g3 = groups.filter((g) => g.grade === 'ثالث ثانوي');
  if (g3.length === 2) {
    const lastB = (await api('GET', `/sessions?groupId=${g3[1].id}&limit=1&status=completed`)).data;
    // الحصص المنتهية مقفولة — نعمل حصة النهارده مفتوحة لمجموعة الأحد/الأربعاء ونسجل فيها بديلين
    const today = fmt(new Date());
    const open = (await api('POST', '/sessions', {
      type: 'lesson', title: 'حصة مراجعة', groupId: g3[1].id, startDate: today, startTime: '18:00', endTime: '20:00',
    })).data;
    await api('PATCH', `/sessions/${open.id}/start`);
    for (const st of g3[0].students.slice(0, 2)) {
      await api('POST', `/sessions/${open.id}/attendance/external`, { studentId: st.id }).catch(() => {});
    }
    void lastB;
    log('✅ حصة النهارده مفتوحة وفيها حضور بديل (عشان تبان في العرض)');
  }

  // 7) المالية: خزائن، فواتير الشهر اللي فات والشهر ده، تحصيل، مصروفات
  const cash = (await api('POST', '/finance/treasuries', { name: 'الخزينة الرئيسية', type: 'cash' })).data;
  const vf = (await api('POST', '/finance/treasuries', { name: 'فودافون كاش', type: 'vodafone' })).data;

  const now = new Date();
  const prevMonth = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const curMonth = monthKey(now);
  let collected = 0;
  for (const [month, payRate] of [[prevMonth, 0.9], [curMonth, 0.6]]) {
    await api('POST', '/finance/dues/generate', { month });
    let page = 1;
    for (;;) {
      const res = await api('GET', `/finance/dues?month=${month}&limit=100&page=${page}`);
      const dues = res.data || [];
      for (const due of dues) {
        if (due.status === 'paid') continue;
        const remaining = Number(due.remainingAmount ?? (due.dueAmount - due.discountApplied - due.paidAmount));
        if (remaining <= 0 || !chance(payRate)) continue;
        const partial = chance(0.1);
        await api('POST', '/finance/payments', {
          monthlyDueId: due.id,
          treasuryId: chance(0.75) ? cash.id : vf.id,
          amount: partial ? Math.round(remaining / 2) : remaining,
          paymentMethod: chance(0.75) ? 'cash' : 'vodafone',
        });
        collected++;
      }
      if (dues.length < 100) break;
      page++;
    }
  }
  const expenseDate = (day) => fmt(new Date(now.getFullYear(), now.getMonth(), Math.min(day, now.getDate())));
  for (const [category, title, amount, day] of [
    ['rent', 'إيجار القاعة', 3000, 1], ['electricity', 'كهرباء', 450, 5],
    ['supplies', 'ورق وأحبار مذكرات', 600, 8], ['salary', 'مساعد المدرس', 1500, 10],
  ]) {
    await api('POST', '/finance/expenses', { treasuryId: cash.id, category, title, amount, expenseDate: expenseDate(day) }).catch((e) => log('⚠️', e.message));
  }
  log(`✅ المالية: ${collected} إيصال + مصروفات`);

  log('\n🎉 خلص!');
  log(`   الدخول: slug = ${SLUG}  |  مستخدم = ${ADMIN_USER}  |  باسورد = (اللي حطيته في DEMO_ADMIN_PASS)`);
  log(`   عدد الطلبات على الـ API: ${calls}`);
}

main().catch((err) => {
  console.error('\n❌', err.message);
  process.exit(1);
});
