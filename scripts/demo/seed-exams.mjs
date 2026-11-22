#!/usr/bin/env node
/**
 * نبغة — بنك أسئلة وامتحانات وتسميعات للمركز التجريبي (رياضيات ثانوي).
 *
 * بيشتغل عن طريق الـ API (نفس مسار الاستيراد اللي المدرس بيستخدمه)، فبيعدّي على نفس الـ validation.
 * آمن إنك تشغّله أكتر من مرة: الأسئلة المكررة بتتخطى، والامتحانات اللي اتعملت قبل كده مابتتعملش تاني.
 *
 * الاستخدام (على السيرفر):
 *   API_URL=http://localhost:3003/api/v1 DEMO_SLUG=demo DEMO_ADMIN_USER=demo DEMO_ADMIN_PASS=Demo@2026 \
 *   node scripts/demo/seed-exams.mjs
 */

const API = (process.env.API_URL || '').replace(/\/$/, '');
const SLUG = process.env.DEMO_SLUG || 'demo';
const USER = process.env.DEMO_ADMIN_USER || 'demo';
const PASS = process.env.DEMO_ADMIN_PASS || 'Demo@2026';
if (!API) { console.error('لازم API_URL'); process.exit(1); }

let token = null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

async function api(method, path, body) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 429) { process.stdout.write('⏳'); await sleep(15000); continue; }
    if (res.status === 204) return null;
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json?.error?.message ?? json)}`);
    return json;
  }
  throw new Error(`${method} ${path} → too many 429`);
}

// ─────────────────────────────────────────────────────────────
// الأسئلة — كل بلوك: الصف + الوحدة + المستوى + الدرجة + الأسئلة بصيغة الاستيراد
// (* جنب الإجابة الصحيحة، (صح)/(خطأ) لصح وخطأ، ........ لأكمل، "الإجابة:" للمقالي)
// ─────────────────────────────────────────────────────────────
const G1 = 'الصف الأول الثانوي';
const G2 = 'الصف الثاني الثانوي';
const G3 = 'الصف الثالث الثانوي';

const BANK = [
  // ═══════════ الأول الثانوي ═══════════
  { grade: G1, unit: 'الجبر: المعادلات', difficulty: 'easy', degree: 1, text: `
1) حل المعادلة 2س + 3 = 11 هو:
أ) 3
ب) 4 *
ج) 5
د) 7

2) مجموعة حل المعادلة س² = 9 في ح هي:
أ) {3}
ب) {−3}
ج) {3 ، −3} *
د) ∅

3) مميز المعادلة س² − 4س + 4 = 0 يساوي:
أ) صفر *
ب) 4
ج) 8
د) −8

4) مجموع جذري المعادلة س² − 5س + 6 = 0 يساوي 5 (صح)

5) حاصل ضرب جذري المعادلة س² + 3س − 10 = 0 يساوي 10 (خطأ)

6) جذرا المعادلة س² − 5س + 6 = 0 هما ........
الإجابة: 2 ، 3
` },
  { grade: G1, unit: 'الجبر: المعادلات', difficulty: 'medium', degree: 1, text: `
1) إذا كان مميز المعادلة التربيعية سالباً فإن جذريها:
أ) حقيقيان مختلفان
ب) حقيقيان متساويان
ج) غير حقيقيين *
د) كلاهما صفر

2) قيمة ك الموجبة التي تجعل جذري المعادلة س² + ك س + 9 = 0 متساويين هي:
أ) 3
ب) 6 *
ج) 9
د) 18

3) إذا كان أحد جذري المعادلة س² − 7س + م = 0 هو 2 فإن م = ........
الإجابة: 10
` },
  { grade: G1, unit: 'الجبر: المعادلات', difficulty: 'hard', degree: 3, text: `
1) أوجد مجموعة حل المعادلة س² − 6س + 5 = 0 ثم تحقق من صحة الحل.
الإجابة: (س − 1)(س − 5) = 0 إذن س = 1 أو س = 5 ، والتعويض في المعادلة يعطي صفر في الحالتين.

2) كوّن المعادلة التربيعية التي جذراها 3 و −2.
الإجابة: مجموع الجذرين = 1 وحاصل ضربهما = −6 ، إذن المعادلة: س² − س − 6 = 0
` },
  { grade: G1, unit: 'حساب المثلثات', difficulty: 'easy', degree: 1, text: `
1) جا 30° تساوي:
أ) 1/2 *
ب) √3/2
ج) 1
د) √2/2

2) جتا 60° تساوي:
أ) √3/2
ب) 1/2 *
ج) صفر
د) 1

3) ظا 45° تساوي:
أ) صفر
ب) 1 *
ج) √3
د) 1/2

4) جا² س + جتا² س = 1 لأي زاوية س (صح)

5) ظا 90° = 1 (خطأ)

6) قياس الزاوية 180° بالتقدير الدائري يساوي ........
الإجابة: π
` },
  { grade: G1, unit: 'حساب المثلثات', difficulty: 'medium', degree: 1, text: `
1) الزاوية التي قياسها π/3 تساوي بالتقدير الستيني:
أ) 30°
ب) 45°
ج) 60° *
د) 90°

2) إذا كان جا س = 1 حيث 0° ≤ س ≤ 360° فإن س تساوي:
أ) صفر
ب) 90° *
ج) 180°
د) 270°

3) الزاوية التي قياسها 135° تقع في الربع الثاني (صح)
` },
  { grade: G1, unit: 'حساب المثلثات', difficulty: 'hard', degree: 3, text: `
1) إذا كان جا س = 3/5 حيث س زاوية حادة، أوجد جتا س و ظا س.
الإجابة: جتا س = 4/5 ، ظا س = 3/4

2) أثبت أن: (جا س + جتا س)² = 1 + 2 جا س جتا س
الإجابة: الطرف الأيمن = جا² س + 2 جا س جتا س + جتا² س = 1 + 2 جا س جتا س = الطرف الأيسر
` },
  { grade: G1, unit: 'الهندسة: التشابه', difficulty: 'easy', degree: 1, text: `
1) في المضلعين المتشابهين تكون أطوال الأضلاع المتناظرة:
أ) متساوية
ب) متناسبة *
ج) متعامدة
د) متوازية

2) كل مثلثين متساويي الأضلاع متشابهان (صح)

3) كل مستطيلين متشابهان (خطأ)

4) نسبة محيطي مضلعين متشابهين تساوي ........
الإجابة: نسبة التشابه
` },
  { grade: G1, unit: 'الهندسة: التشابه', difficulty: 'medium', degree: 1, text: `
1) إذا كانت نسبة التشابه بين مثلثين 2 : 3 فإن النسبة بين مساحتيهما:
أ) 2 : 3
ب) 4 : 9 *
ج) 8 : 27
د) 3 : 2

2) مثلثان متشابهان نسبة التشابه بينهما 1 : 2 ومحيط الأصغر 12 سم، فإن محيط الأكبر:
أ) 6 سم
ب) 24 سم *
ج) 48 سم
د) 14 سم
` },

  // ═══════════ الثاني الثانوي ═══════════
  { grade: G2, unit: 'الدوال الحقيقية', difficulty: 'easy', degree: 1, text: `
1) مجال الدالة د(س) = 1 ÷ (س − 2) هو:
أ) ح
ب) ح − {2} *
ج) ح − {−2}
د) {2}

2) الدالة د(س) = س² دالة زوجية (صح)

3) الدالة د(س) = س³ دالة زوجية (خطأ)

4) إذا كانت د(س) = 2س + 1 فإن د(3) = ........
الإجابة: 7
` },
  { grade: G2, unit: 'الدوال الحقيقية', difficulty: 'medium', degree: 1, text: `
1) مدى الدالة د(س) = |س| هو:
أ) ح
ب) [0 ، ∞[ *
ج) ]−∞ ، 0]
د) {0}

2) إذا كانت د(س) = س² و ر(س) = س + 1 فإن (د ∘ ر)(2) تساوي:
أ) 5
ب) 9 *
ج) 4
د) 6
` },
  { grade: G2, unit: 'الأسس واللوغاريتمات', difficulty: 'easy', degree: 1, text: `
1) لو₂ 8 تساوي:
أ) 2
ب) 3 *
ج) 4
د) 8

2) لو 1 تساوي:
أ) صفر *
ب) 1
ج) 10
د) غير معرّف

3) لو (س ص) = لو س + لو ص (صح)

4) إذا كان 2^س = 32 فإن س = ........
الإجابة: 5
` },
  { grade: G2, unit: 'الأسس واللوغاريتمات', difficulty: 'medium', degree: 1, text: `
1) قيمة لو₃ 81 تساوي:
أ) 3
ب) 4 *
ج) 9
د) 27

2) لو (س ÷ ص) = لو س ÷ لو ص (خطأ)

3) إذا كان 3^(س − 1) = 9 فإن س = ........
الإجابة: 3
` },
  { grade: G2, unit: 'الأسس واللوغاريتمات', difficulty: 'hard', degree: 3, text: `
1) حل المعادلة: لو₂ (س + 1) = 3
الإجابة: س + 1 = 2³ = 8 إذن س = 7

2) بدون استخدام الحاسبة أوجد قيمة: لو 25 + لو 4
الإجابة: لو (25 × 4) = لو 100 = 2
` },
  { grade: G2, unit: 'النهايات', difficulty: 'easy', degree: 1, text: `
1) نها (س ← 2) (3س + 1) تساوي:
أ) 5
ب) 6
ج) 7 *
د) 3

2) نها (س ← صفر) (جا س ÷ س) = 1 (صح)

3) نها (س ← ∞) (1 ÷ س) = ........
الإجابة: صفر
` },
  { grade: G2, unit: 'النهايات', difficulty: 'medium', degree: 1, text: `
1) نها (س ← 3) (س² − 9) ÷ (س − 3) تساوي:
أ) صفر
ب) 3
ج) 6 *
د) غير موجودة
` },
  { grade: G2, unit: 'النهايات', difficulty: 'hard', degree: 3, text: `
1) أوجد: نها (س ← 1) (س³ − 1) ÷ (س − 1)
الإجابة: = نها (س ← 1) (س² + س + 1) = 3
` },

  // ═══════════ الثالث الثانوي ═══════════
  { grade: G3, unit: 'التفاضل', difficulty: 'easy', degree: 1, text: `
1) مشتقة الدالة ص = س³ بالنسبة لـ س هي:
أ) س²
ب) 3س² *
ج) 3س
د) س⁴ ÷ 4

2) مشتقة جا س بالنسبة لـ س هي:
أ) جتا س *
ب) −جتا س
ج) −جا س
د) ظا س

3) مشتقة أي دالة ثابتة تساوي:
أ) الثابت نفسه
ب) 1
ج) صفر *
د) س

4) مشتقة الدالة هـ^س هي هـ^س (صح)

5) مشتقة لو_هـ س هي س (خطأ)

6) إذا كانت ص = 5س² فإن دص ÷ دس = ........
الإجابة: 10س
` },
  { grade: G3, unit: 'التفاضل', difficulty: 'medium', degree: 1, text: `
1) ميل المماس لمنحنى ص = س² عند س = 3 يساوي:
أ) 3
ب) 6 *
ج) 9
د) 2

2) للدالة د(س) = س² − 4س نقطة حرجة عند س تساوي:
أ) 2 *
ب) −2
ج) 4
د) صفر

3) إذا كانت ص = (2س + 1)³ فإن دص ÷ دس = 6(2س + 1)² (صح)

4) مشتقة جتا 2س بالنسبة لـ س = ........
الإجابة: −2 جا 2س
` },
  { grade: G3, unit: 'التفاضل', difficulty: 'hard', degree: 3, text: `
1) أوجد القيم العظمى والصغرى المحلية للدالة د(س) = س³ − 3س
الإجابة: د′(س) = 3س² − 3 = 0 إذن س = ±1 ؛ قيمة عظمى محلية د(−1) = 2 ، وقيمة صغرى محلية د(1) = −2

2) أوجد معادلة المماس لمنحنى ص = س² + 1 عند النقطة (1 ، 2)
الإجابة: الميل = 2س = 2 ، المعادلة: ص − 2 = 2(س − 1) أي ص = 2س
` },
  { grade: G3, unit: 'التكامل', difficulty: 'easy', degree: 1, text: `
1) ∫ 2س ء س يساوي:
أ) س² + ث *
ب) 2س² + ث
ج) س + ث
د) 2 + ث

2) ∫ جتا س ء س يساوي:
أ) −جا س + ث
ب) جا س + ث *
ج) جتا س + ث
د) −جتا س + ث

3) ∫ ء س = س + ث (صح)

4) ∫ من 0 إلى 2 للدالة 3س² ء س = ........
الإجابة: 8
` },
  { grade: G3, unit: 'التكامل', difficulty: 'medium', degree: 1, text: `
1) ∫ (1 ÷ س) ء س حيث س ≠ 0 يساوي:
أ) لو_هـ |س| + ث *
ب) −1 ÷ س² + ث
ج) س + ث
د) هـ^س + ث

2) ∫ هـ^س ء س = هـ^س + ث (صح)
` },
  { grade: G3, unit: 'التكامل', difficulty: 'hard', degree: 3, text: `
1) أوجد مساحة المنطقة المحصورة بين منحنى ص = س² ومحور السينات والمستقيمين س = 0 ، س = 3
الإجابة: المساحة = ∫ من 0 إلى 3 س² ء س = 9 وحدات مربعة

2) أوجد: ∫ (3س² + 2س − 1) ء س
الإجابة: س³ + س² − س + ث
` },
  { grade: G3, unit: 'التباديل والتوافيق', difficulty: 'easy', degree: 1, text: `
1) قيمة ل(5 ، 2) تساوي:
أ) 10
ب) 20 *
ج) 60
د) 25

2) قيمة ق(5 ، 2) تساوي:
أ) 10 *
ب) 20
ج) 5
د) 120

3) مضروب الصفر (0!) يساوي 1 (صح)

4) ق(ن ، ر) = ق(ن ، ن − ر) (صح)

5) عدد طرق ترتيب 4 كتب مختلفة على رف واحد = ........
الإجابة: 24
` },
  { grade: G3, unit: 'التباديل والتوافيق', difficulty: 'medium', degree: 1, text: `
1) عدد الحدود في مفكوك (س + ص)⁷ يساوي:
أ) 6
ب) 7
ج) 8 *
د) 14

2) عدد طرق اختيار لجنة من 3 طلاب من بين 6 طلاب = ........
الإجابة: 20
` },
  { grade: G3, unit: 'التباديل والتوافيق', difficulty: 'hard', degree: 3, text: `
1) أوجد الحد الخالي من س في مفكوك (س + 1 ÷ س)⁴
الإجابة: الحد الثالث = ق(4 ، 2) = 6
` },
];

// امتحانات وتسميعات جاهزة بتتولّد بالمولّد الذكي من البنك
const EXAMS = [
  {
    title: 'امتحان شهر نوفمبر — التفاضل والتكامل', kind: 'exam', grade: G3, durationMins: 60,
    tags: ['التفاضل', 'التكامل'], link: true,
    instructions: 'أجب عن جميع الأسئلة — الآلة الحاسبة غير مسموح بها',
    blueprint: [
      { type: 'mcq', count: 6, degree: 1, sectionTitle: 'أولاً: اختر الإجابة الصحيحة' },
      { type: 'true_false', count: 3, degree: 1, sectionTitle: 'ثانياً: ضع علامة (✓) أو (✗)' },
      { type: 'fill', count: 2, degree: 1, sectionTitle: 'ثالثاً: أكمل ما يأتي' },
      { type: 'essay', count: 2, sectionTitle: 'رابعاً: أجب عما يأتي' },
    ],
  },
  {
    title: 'تسميع — التباديل والتوافيق', kind: 'quiz', grade: G3, durationMins: 10,
    tags: ['التباديل والتوافيق'],
    blueprint: [{ type: 'mcq', count: 3, degree: 1 }, { type: 'true_false', count: 2, degree: 1 }],
  },
  {
    title: 'اختبار الوحدة — الأسس واللوغاريتمات', kind: 'exam', grade: G2, durationMins: 30,
    tags: ['الأسس واللوغاريتمات'],
    blueprint: [
      { type: 'mcq', count: 3, degree: 1, sectionTitle: 'أولاً: اختر الإجابة الصحيحة' },
      { type: 'true_false', count: 2, degree: 1, sectionTitle: 'ثانياً: ضع علامة (✓) أو (✗)' },
      { type: 'fill', count: 2, degree: 1, sectionTitle: 'ثالثاً: أكمل' },
      { type: 'essay', count: 1, sectionTitle: 'رابعاً: أجب' },
    ],
  },
  {
    title: 'تسميع — حساب المثلثات', kind: 'quiz', grade: G1, durationMins: 10,
    tags: ['حساب المثلثات'],
    blueprint: [{ type: 'mcq', count: 3, degree: 1 }, { type: 'true_false', count: 2, degree: 1 }],
  },
];

const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

async function main() {
  log(`🚀 بنك أسئلة وامتحانات للمركز "${SLUG}" على ${API}`);
  token = (await api('POST', '/auth/login', { slug: SLUG, username: USER, password: PASS })).data.accessToken;

  // المادة
  const subjectsRes = (await api('GET', '/subjects')).data ?? [];
  const subjects = subjectsRes.map((s) => s.subject ?? s);
  const math = subjects.find((s) => s.name === 'رياضيات') ?? subjects[0];
  if (!math) throw new Error('مفيش مواد في المركز — شغّل seed-demo الأول');

  // 1) البنك
  let created = 0, dup = 0, errors = 0;
  for (const b of BANK) {
    const r = (await api('POST', '/exams/questions/import/text', {
      text: b.text, subjectId: math.id, grade: b.grade, difficulty: b.difficulty,
      defaultDegree: b.degree, tags: [b.unit], dryRun: false,
    })).data;
    created += r.created; dup += r.duplicates; errors += r.errors.length;
    if (r.errors.length) log(`   ⚠️ ${b.grade} / ${b.unit}:`, r.errors.map((e) => `${e.ref}: ${e.message}`).join(' | '));
  }
  log(`✅ البنك: اتضاف ${created} سؤال${dup ? ` (اتخطّى ${dup} مكرر)` : ''}${errors ? ` — ${errors} فيه مشكلة` : ''}`);

  // 2) الامتحانات
  const existing = new Set(((await api('GET', '/exams?limit=100')).data?.data ?? []).map((e) => e.title));
  const made = [];
  for (const ex of EXAMS) {
    if (existing.has(ex.title)) { log(`   ⏭  موجود: ${ex.title}`); continue; }
    const res = (await api('POST', '/exams/generate', {
      title: ex.title, kind: ex.kind, subjectId: math.id, grade: ex.grade,
      durationMins: ex.durationMins, instructions: ex.instructions, tags: ex.tags,
      avoidRecentDays: 0, blueprint: ex.blueprint,
    })).data;
    made.push({ ...ex, id: res.exam.id, total: res.exam.totalDegree });
    const short = res.report.shortfalls.length ? ` (ناقص ${res.report.requested - res.report.picked})` : '';
    log(`✅ ${ex.kind === 'quiz' ? 'تسميع' : 'امتحان'}: ${ex.title} — ${res.items.length} سؤال / ${res.exam.totalDegree} درجة${short}`);
  }

  // 3) ربط امتحان بحصة امتحان جاية لمجموعة تالتة ثانوي (عشان يبان الربط في رصد الدرجات)
  const toLink = made.find((m) => m.link);
  if (toLink) {
    const groups = (await api('GET', '/groups?limit=100')).data?.data ?? [];
    const g3 = groups.find((g) => (g.subjectGradeLabel ?? g.name ?? '').includes('ثالث'));
    if (g3) {
      const d = new Date(); d.setDate(d.getDate() + 3);
      const session = (await api('POST', '/sessions', {
        type: 'exam', title: toLink.title, groupId: g3.id, startDate: fmt(d),
        startTime: '18:00', endTime: '19:00', outOf: toLink.total,
      })).data;
      await api('POST', `/exams/${toLink.id}/link-session`, { sessionId: session.id });
      log(`✅ اتربط "${toLink.title}" بحصة امتحان يوم ${fmt(d)} لمجموعة ${g3.name}`);
    } else {
      log('⚠️ مالقيتش مجموعة تالتة ثانوي للربط');
    }
  }

  log('\n🎉 خلص');
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
