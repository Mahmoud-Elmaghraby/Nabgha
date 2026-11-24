import 'reflect-metadata';
import { testPool } from './support/db';
import { Kysely, PostgresDialect, sql } from 'kysely';
import { AttendanceCreditRepository } from '../../src/modules/sessions/infrastructure/attendance-credit.repository';
import { AttendanceCreditService } from '../../src/modules/sessions/application/services/attendance-credit.service';

const pool = testPool();
const base = new Kysely<any>({ dialect: new PostgresDialect({ pool }) });
const T = 't';
const fakeKysely: any = {
  getTenantDb: () => base.withSchema('tenant_t'),
  getTenantSchema: () => 'tenant_t',
};
const repo = new AttendanceCreditRepository(fakeKysely);
const svc = new AttendanceCreditService(repo);
const q = (s: string, p: any[] = []) => pool.query(`SET search_path TO tenant_t; ${s}`.replace(/^SET search_path TO tenant_t; /, ''), p);
const run = async (s: string, p: any[] = []) => {
  const c = await pool.connect();
  try { await c.query('SET search_path TO tenant_t'); return (await c.query(s, p)).rows; } finally { await c.query('RESET search_path').catch(() => {}); c.release(); }
};

let pass = 0, fail = 0;
function check(name: string, cond: boolean, extra = '') {
  if (cond) { pass++; console.log(`  ✅ ${name}`); } else { fail++; console.log(`  ❌ ${name} ${extra}`); }
}

// ── بيانات أساسية ──
let sg1: string, sg2: string, gA: string, gB: string, gC: string;
async function reset() {
  await run(`TRUNCATE attendance_credits, attendance, sessions, group_students, groups, students, subject_grades, subjects CASCADE`);
  const [s] = await run(`INSERT INTO subjects(name) VALUES ('رياضيات') RETURNING id`);
  const [s2] = await run(`INSERT INTO subjects(name) VALUES ('فيزياء') RETURNING id`);
  sg1 = (await run(`INSERT INTO subject_grades(subject_id, grade) VALUES ($1, 'ثالث ثانوي') RETURNING id`, [s.id]))[0].id;
  sg2 = (await run(`INSERT INTO subject_grades(subject_id, grade) VALUES ($1, 'ثالث ثانوي') RETURNING id`, [s2.id]))[0].id;
  gA = (await run(`INSERT INTO groups(name, subject_grade_id) VALUES ('A', $1) RETURNING id`, [sg1]))[0].id;
  gB = (await run(`INSERT INTO groups(name, subject_grade_id) VALUES ('B', $1) RETURNING id`, [sg1]))[0].id;
  gC = (await run(`INSERT INTO groups(name, subject_grade_id) VALUES ('C', $1) RETURNING id`, [sg2]))[0].id;
}
let n = 0;
async function student(group: string) {
  n++;
  const [st] = await run(`INSERT INTO students(full_name, parent_phone, qr_code) VALUES ($1, '010', $2) RETURNING id`, [`طالب ${n}`, `Q${n}`]);
  await run(`INSERT INTO group_students(group_id, student_id) VALUES ($1, $2)`, [group, st.id]);
  return st.id as string;
}
async function session(group: string, date: string, status: string) {
  const [se] = await run(`INSERT INTO sessions(group_id, title, start_date, status, start_time) VALUES ($1, 'حصة', $2, $3, '16:00') RETURNING id`, [group, date, status]);
  return se.id as string;
}
async function att(sessionId: string, studentId: string, status: string) {
  const [a] = await run(`INSERT INTO attendance(session_id, student_id, status) VALUES ($1, $2, $3) RETURNING id`, [sessionId, studentId, status]);
  return a.id as string;
}
const statusOf = async (id: string) => (await run(`SELECT status FROM attendance WHERE id = $1`, [id]))[0]?.status;
const creditsOf = async (studentId: string) => run(`SELECT status, consumed_attendance_id FROM attendance_credits WHERE student_id = $1 ORDER BY created_at`, [studentId]);
async function external(sessionId: string, studentId: string, date: string, sg = sg1) {
  const id = await att(sessionId, studentId, 'present');
  const r = await svc.onExternalAttendance(T, { sessionId, sessionDate: new Date(`${date}T00:00:00`), sessionTitle: 'B', attendanceId: id, studentId, subjectGradeId: sg });
  return { id, ...r };
}
// helper: أسبوع ماضي كامل عشان CURRENT_DATE مايأثرش
const SAT = '2026-11-07', MON = '2026-11-09', WED = '2026-11-11', THU = '2026-11-12', FRI = '2026-11-13', NEXT_SAT = '2026-11-14';
const FUTURE = '2099-01-03';

(async () => {
  await reset();

  console.log('1) غاب الأول وبعدين حضر بديل في نفس الأسبوع');
  { const s = await student(gA); const a = await session(gA, SAT, 'completed'); const x = await att(a, s, 'absent');
    const others = await student(gA); await att(a, others, 'present');
    const b = await session(gB, MON, 'ongoing'); const r = await external(b, s, MON);
    check('الغياب اتعذر', (await statusOf(x)) === 'excused');
    check('الدالة رجعت الغياب الصح', r.excusedAbsenceId === x);
    check('الرصيد اتصرف', (await creditsOf(s))[0]?.status === 'consumed'); }

  console.log('2) حضر بديل الأول، وبعدين غاب عن حصته وانتهت');
  { const s = await student(gA); const b = await session(gB, SAT, 'completed'); await external(b, s, SAT);
    check('الرصيد متاح ومستني', (await creditsOf(s))[0]?.status === 'available');
    const a = await session(gA, WED, 'ongoing'); const x = await att(a, s, 'absent');
    await run(`UPDATE sessions SET status='completed' WHERE id=$1`, [a]);
    const ok = await svc.excuseAbsenceIfCredit(T, { absenceAttendanceId: x, studentId: s, subjectGradeId: sg1, sessionDate: new Date(`${WED}T00:00:00`) });
    check('الغياب اتعذر عند إنهاء الحصة', ok && (await statusOf(x)) === 'excused'); }

  console.log('3) حضر بديل الأول، وحصته عدّت والمدرّس ما داسش إنهاء (المطابقة اليومية)');
  { const s = await student(gA); const b = await session(gB, SAT, 'completed'); await external(b, s, SAT);
    const a = await session(gA, THU, 'ongoing'); const x = await att(a, s, 'absent'); const o = await student(gA); await att(a, o, 'present');
    // المطابقة اليومية بتبص على آخر أسبوعين — نخلي الأسبوع حديث
    await run(`UPDATE attendance_credits SET week_start = date_trunc('week', CURRENT_DATE)::date - 2 WHERE student_id=$1`, [s]);
    await run(`UPDATE sessions SET start_date = date_trunc('week', CURRENT_DATE)::date - 2 WHERE id IN ($1,$2)`, [a, b]);
    const yesterdayInWeek = (await run(`SELECT (date_trunc('week', CURRENT_DATE)::date - 2) < CURRENT_DATE AS ok`))[0].ok;
    const excused = await svc.matchPendingCredits(T);
    check('اتعذر في المطابقة اليومية', yesterdayInWeek && excused.includes(x) && (await statusOf(x)) === 'excused'); }

  console.log('4) حصته لسه ماحصلتش (مجدولة) — مايتعذرش بدري');
  { const s = await student(gA); const a = await session(gA, FUTURE, 'scheduled'); const x = await att(a, s, 'absent');
    const b = await session(gB, FUTURE, 'ongoing'); await external(b, s, FUTURE);
    check('الغياب الافتراضي في حصة لسه جاية مااتعذرش', (await statusOf(x)) === 'absent');
    check('الرصيد فضل متاح', (await creditsOf(s))[0]?.status === 'available'); }

  console.log('5) غياب معذور اتعدّل لحاضر → الرصيد يروح لغياب تاني في نفس الأسبوع');
  { const s = await student(gA); const a1 = await session(gA, SAT, 'completed'); const x1 = await att(a1, s, 'absent');
    const a2 = await session(gA, WED, 'completed'); const x2 = await att(a2, s, 'absent');
    const b = await session(gB, MON, 'ongoing'); await external(b, s, MON);
    check('أقدم غياب اتعذر الأول', (await statusOf(x1)) === 'excused' && (await statusOf(x2)) === 'absent');
    await run(`UPDATE attendance SET status='present' WHERE id=$1`, [x1]);
    const re = await svc.onExcusedRecordChanged(T, x1);
    check('الرصيد راح للغياب التاني', re[0] === x2 && (await statusOf(x2)) === 'excused'); }

  console.log('6) الحضور البديل اتشال بالغلط → الغياب يرجع غايب');
  { const s = await student(gA); const a = await session(gA, SAT, 'completed'); const x = await att(a, s, 'absent');
    const b = await session(gB, MON, 'ongoing'); const ext = await external(b, s, MON);
    await svc.removeExternalAttendance(T, ext.id);
    check('الغياب رجع غايب', (await statusOf(x)) === 'absent');
    check('سجل البديل اتمسح من الحصة', (await statusOf(ext.id)) === undefined);
    check('الرصيد اتلغى', (await creditsOf(s))[0]?.status === 'revoked'); }

  console.log('7) اتشال بديل، بس عنده بديل تاني في نفس الأسبوع → الغياب يفضل معذور');
  { const s = await student(gA); const a = await session(gA, SAT, 'completed'); const x = await att(a, s, 'absent');
    const b1 = await session(gB, MON, 'ongoing'); const e1 = await external(b1, s, MON);
    const b2 = await session(gB, THU, 'ongoing'); await external(b2, s, THU);
    await svc.removeExternalAttendance(T, e1.id);
    check('الغياب لسه معذور بالرصيد التاني', (await statusOf(x)) === 'excused');
    const cs = await creditsOf(s);
    check('رصيد ملغي ورصيد مصروف', cs[0]?.status === 'revoked' && cs[1]?.status === 'consumed'); }

  console.log('8) حصة البديل اتلغت');
  { const s = await student(gA); const a = await session(gA, SAT, 'completed'); const x = await att(a, s, 'absent');
    const b = await session(gB, MON, 'ongoing'); await external(b, s, MON);
    await run(`UPDATE sessions SET status='cancelled' WHERE id=$1`, [b]);
    await svc.onSessionVoided(T, b);
    check('الغياب رجع غايب', (await statusOf(x)) === 'absent'); }

  console.log('9) حصة الغياب نفسها اتلغت → الرصيد يروح لغياب تاني');
  { const s = await student(gA); const a1 = await session(gA, SAT, 'completed'); const x1 = await att(a1, s, 'absent');
    const a2 = await session(gA, WED, 'completed'); const x2 = await att(a2, s, 'absent');
    const b = await session(gB, MON, 'ongoing'); await external(b, s, MON);
    await run(`UPDATE sessions SET status='cancelled' WHERE id=$1`, [a1]);
    const re = await svc.onSessionVoided(T, a1);
    check('الرصيد اتنقل للغياب التاني', re[0] === x2 && (await statusOf(x2)) === 'excused'); }

  console.log('10) أسبوع مختلف → مفيش تعويض');
  { const s = await student(gA); const a = await session(gA, THU, 'completed'); const x = await att(a, s, 'absent');
    const b = await session(gB, NEXT_SAT, 'ongoing'); await external(b, s, NEXT_SAT);
    check('غياب الخميس مااتعذرش بحضور السبت اللي بعده', (await statusOf(x)) === 'absent'); }

  console.log('11) حصة يوم الجمعة بتتحسب في نفس الأسبوع');
  { const s = await student(gA); const a = await session(gA, FRI, 'completed'); const x = await att(a, s, 'absent');
    const b = await session(gB, MON, 'ongoing'); await external(b, s, MON);
    check('غياب الجمعة اتعذر', (await statusOf(x)) === 'excused'); }

  console.log('12) رصيدين وغياب واحد');
  { const s = await student(gA); const a = await session(gA, SAT, 'completed'); const x = await att(a, s, 'absent');
    const b1 = await session(gB, MON, 'ongoing'); await external(b1, s, MON);
    const b2 = await session(gB, WED, 'ongoing'); await external(b2, s, WED);
    const cs = await creditsOf(s);
    check('واحد اتصرف وواحد متاح', cs[0]?.status === 'consumed' && cs[1]?.status === 'available' && (await statusOf(x)) === 'excused'); }

  console.log('13) رصيد واحد وغيابين بيتقفلوا في نفس اللحظة (سباق)');
  { const s = await student(gA); const b = await session(gB, SAT, 'completed'); await external(b, s, SAT);
    const a1 = await session(gA, MON, 'completed'); const x1 = await att(a1, s, 'absent');
    const a2 = await session(gA, WED, 'completed'); const x2 = await att(a2, s, 'absent');
    const args = (x: string, d: string) => ({ absenceAttendanceId: x, studentId: s, subjectGradeId: sg1, sessionDate: new Date(`${d}T00:00:00`) });
    const [r1, r2] = await Promise.all([svc.excuseAbsenceIfCredit(T, args(x1, MON)), svc.excuseAbsenceIfCredit(T, args(x2, WED))]);
    const st = [await statusOf(x1), await statusOf(x2)].filter(v => v === 'excused').length;
    check('غياب واحد بس اتعذر', (r1 !== r2) && st === 1); }

  console.log('14) مادة تانية مالهاش دعوة');
  { const s = await student(gA); await run(`INSERT INTO group_students(group_id, student_id) VALUES ($1, $2)`, [gC, s]);
    const a = await session(gA, SAT, 'completed'); const x = await att(a, s, 'absent');
    const c = await session(gC, MON, 'ongoing'); await external(c, s, MON, sg2);
    check('حضور فيزياء مايعذرش غياب رياضيات', (await statusOf(x)) === 'absent'); }

  console.log('15) حصة الغياب يومها عدّى بس محدش أخد فيها حضور خالص → مش غياب حقيقي');
  { const s = await student(gA); const a = await session(gA, SAT, 'scheduled'); const x = await att(a, s, 'absent');
    const b = await session(gB, MON, 'ongoing'); await external(b, s, MON);
    check('مااتعذرش (الحصة غالبًا ماتعملتش)', (await statusOf(x)) === 'absent'); }

  console.log(`\nالنتيجة: ${pass} نجح، ${fail} فشل`);
  await base.destroy();
  process.exit(fail ? 1 : 0);
})().catch(async (e) => { console.error(e); await base.destroy(); process.exit(1); });
