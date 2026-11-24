import 'reflect-metadata';
import { testPool } from './support/db';
import { Kysely, PostgresDialect } from 'kysely';
import { normalizeScannedCode } from '../../src/shared/utils/student-code.util';
import { SessionRepository } from '../../src/modules/sessions/infrastructure/session.repository';

// محاكاة كتابة السكانر بكيبورد عربي (101) — Shift للكابيتال
const PLAIN: Record<string,string> = { q:'ض',w:'ص',e:'ث',r:'ق',t:'ف',y:'غ',u:'ع',i:'ه',o:'خ',p:'ح',a:'ش',s:'س',d:'ي',f:'ب',g:'ل',h:'ا',j:'ت',k:'ن',l:'م',z:'ئ',x:'ء',c:'ؤ',v:'ر',b:'لا',n:'ى',m:'ة' };
const SHIFT: Record<string,string> = { Q:'َ',W:'ً',E:'ُ',R:'ٌ',T:'لإ',Y:'إ',U:'‘',I:'÷',O:'×',P:'؛',A:'ِ',S:'ٍ',D:']',F:'[',G:'لأ',H:'أ',J:'ـ',K:'،',L:'/',Z:'~',X:'ْ',C:'}',V:'{',B:'لآ',N:'آ',M:'’' };
const typeAr = (s: string) => [...s].map(c => SHIFT[c] ?? PLAIN[c] ?? c).join('');
let pass = 0, fail = 0;
const check = (n: string, c: boolean, x: any = '') => { if (c) { pass++; console.log('  ✅', n); } else { fail++; console.log('  ❌', n, x); } };

(async () => {
  console.log('— normalizers');
  for (const code of ['STU-00012', 'STU-98765', 'stu-00012']) {
    const ar = typeAr(code);
    check(`api ${code} via Arabic layout`, normalizeScannedCode(ar) === code.toUpperCase(), normalizeScannedCode(ar));
  }
  const uuidCode = 'STU-3f2a9c1e-7b4d-4e8a-9f00-abcdef123456';
  check('api secret qr_code via Arabic layout', normalizeScannedCode(typeAr(uuidCode)) === uuidCode.toUpperCase(), normalizeScannedCode(typeAr(uuidCode)));
  check('old JSON QR', normalizeScannedCode('{"code":"STU-00012","name":"أحمد","id":"x"}') === 'STU-00012');
  check('old JSON QR typed in Arabic layout', normalizeScannedCode(typeAr('{"code":"STU-00012"}')) === 'STU-00012', normalizeScannedCode(typeAr('{"code":"STU-00012"}')));
  check('arabic digits', normalizeScannedCode('STU-٠٠٠١٢') === 'STU-00012');
  check('english untouched', normalizeScannedCode('STU-00012') === 'STU-00012');
  check('zero-width + spaces', normalizeScannedCode(' ‏STU-00012 \n') === 'STU-00012');

  console.log('— repository (Postgres)');
  const pool = testPool();
  const base = new Kysely<any>({ dialect: new PostgresDialect({ pool }) });
  const repo = new SessionRepository({ getTenantDb: () => base.withSchema('tenant_t'), getTenantSchema: () => 'tenant_t' } as any);
  const run = async (s: string, p: any[] = []) => { const c = await pool.connect(); try { await c.query('SET search_path TO tenant_t'); return (await c.query(s, p)).rows; } finally { await c.query('RESET search_path').catch(() => {}); c.release(); } };
  await run(`TRUNCATE attendance, sessions, group_students, groups, students, subject_grades, subjects CASCADE`);
  const [sub] = await run(`INSERT INTO subjects(name) VALUES ('x') RETURNING id`);
  const [sg] = await run(`INSERT INTO subject_grades(subject_id, grade) VALUES ($1,'g') RETURNING id`, [sub.id]);
  const [g] = await run(`INSERT INTO groups(name, subject_grade_id) VALUES ('G',$1) RETURNING id`, [sg.id]);
  const [st] = await run(`INSERT INTO students(full_name, parent_phone, qr_code, student_code) VALUES ('طالب','01000000000',$1,'STU-00012') RETURNING id`, [uuidCode.toLowerCase().replace('stu-','STU-')]);
  const [ses] = await run(`INSERT INTO sessions(type, group_id, title, start_date) VALUES ('lesson',$1,'t','2026-11-22') RETURNING id`, [g.id]);
  await run(`INSERT INTO attendance(session_id, student_id, status) VALUES ($1,$2,'absent')`, [ses.id, st.id]);
  for (const raw of ['STU-00012', 'stu-00012', typeAr('STU-00012'), '{"code":"STU-00012"}', typeAr(uuidCode)]) {
    const r = await repo.findAttendanceByQr('t', ses.id, normalizeScannedCode(raw));
    check(`find by "${raw.slice(0, 20)}"`, r?.studentId === st.id);
  }
  check('resolveStudentIdByCode lowercase', (await repo.resolveStudentIdByCode('t', normalizeScannedCode('stu-00012'))) === st.id);
  check('unknown code -> null', (await repo.findAttendanceByQr('t', ses.id, 'STU-99999')) === null);
  console.log(`\n${pass} passed, ${fail} failed`);
  await pool.end(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
