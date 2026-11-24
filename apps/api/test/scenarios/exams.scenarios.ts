import 'reflect-metadata';
import { testPool } from './support/db';
import { Kysely, PostgresDialect } from 'kysely';
import { ExamRepository } from '../../src/modules/exams/infrastructure/repositories/exam.repository';
import { ExamUseCase, applyVersion } from '../../src/modules/exams/application/use-cases/exam.usecase';
import { GenerateExamSchema, ImportTextSchema, ImportOptionsSchema, CreateQuestionSchema } from '../../src/modules/exams/application/dtos/exam.dto';
import { parseQuestionsText, parseQuestionsSheet } from '../../src/modules/exams/application/services/question-import.parser';

const pool = testPool();
const base = new Kysely<any>({ dialect: new PostgresDialect({ pool }) });
const fakeKysely: any = { getTenantDb: () => base.withSchema('tenant_t'), getTenantSchema: () => 'tenant_t' };
const repo = new ExamRepository(fakeKysely);
let rendered = '';
const pdf: any = { renderHtml: async (h: string) => { rendered = h; return Buffer.from('%PDF'); } };
const storage: any = { getFileBuffer: async () => null };
const uc = new ExamUseCase(repo as any, pdf, storage);
const T = 't';
const run = async (s: string, p: any[] = []) => { const c = await pool.connect(); try { await c.query('SET search_path TO tenant_t'); return (await c.query(s, p)).rows; } finally { await c.query('RESET search_path').catch(() => {}); c.release(); } };
let pass = 0, fail = 0;
const check = (n: string, c: boolean, x: any = '') => { if (c) { pass++; console.log('  ✅', n); } else { fail++; console.log('  ❌', n, typeof x === 'string' ? x : JSON.stringify(x)); } };
const gen = (o: any) => GenerateExamSchema.parse(o);
const fakeRes = () => { const r: any = { headers: {}, body: null, set(h: any) { Object.assign(this.headers, h); }, send(b: any) { this.body = b; } }; return r; };

(async () => {
  await run(`TRUNCATE exam_items, exams, exam_questions, attendance, sessions, group_students, groups, students, subject_grades, subjects CASCADE`);
  await run(`DELETE FROM users`);
  const [u1] = await run(`INSERT INTO users(username,password_hash,name) VALUES ('teacher','x','المدرس') RETURNING id`);
  const [u2] = await run(`INSERT INTO users(username,password_hash,name,role) VALUES ('asst','x','المساعد','assistant') RETURNING id`);
  const [sub] = await run(`INSERT INTO subjects(name) VALUES ('علوم') RETURNING id`);

  console.log('\n— بنك مشترك + JSONB options');
  const mk = (type: string, i: number, extra: any = {}) => CreateQuestionSchema.parse({
    type, questionText: `سؤال ${type} رقم ${i}`, subjectId: sub.id, grade: 'الأول الثانوي',
    options: type === 'mcq' ? ['أ1', 'ب1', 'ج1', 'كل ما سبق'] : null, correctAnswer: type === 'mcq' ? 'ب1' : type === 'true_false' ? 'صح' : 'x',
    difficulty: i % 3 === 0 ? 'hard' : i % 2 === 0 ? 'medium' : 'easy', tags: [i <= 6 ? 'الوحدة 1' : 'الوحدة 2'], defaultDegree: type === 'essay' ? 3 : 1, ...extra,
  });
  let q1: any;
  try { q1 = await uc.createQuestion(T, u1.id, mk('mcq', 1)); check('create MCQ with options (JSONB)', Array.isArray(q1.options) && q1.options.length === 4); }
  catch (e: any) { check('create MCQ with options (JSONB)', false, e.message); }
  for (let i = 2; i <= 12; i++) await uc.createQuestion(T, u1.id, mk(['mcq', 'true_false', 'fill', 'essay'][i % 4], i));
  const asAsst = await uc.listQuestions(T, u2.id, { page: 1, limit: 50 } as any);
  check('assistant sees teacher questions (shared bank)', asAsst.total === 12, asAsst.total);
  const byTag = await uc.listQuestions(T, u2.id, { page: 1, limit: 50, tags: ['الوحدة 2'] } as any);
  check('tags filter works (was JSON.stringify bug)', byTag.total === 6, byTag.total);
  const qq = await uc.getQuestion(T, u2.id, q1.id);
  check('assistant can open teacher question', qq.id === q1.id);

  console.log('\n— availability');
  const av = await uc.getAvailability(T, { subjectId: sub.id });
  check('availability total', av.total === 12, av);
  check('availability tags listed', av.tags.length === 2 && av.tags.every(t => t.count === 6), av.tags);
  const avT = await uc.getAvailability(T, { tags: ['الوحدة 1'] });
  check('availability with tag filter', avT.total === 6 && avT.tags.length === 2, avT);

  console.log('\n— smart generate (blueprint)');
  const r1 = await uc.generateExamAuto(T, u1.id, gen({
    title: 'امتحان الشهر', kind: 'exam', subjectId: sub.id, durationMins: 45,
    blueprint: [
      { type: 'mcq', count: 2, degree: 2, sectionTitle: 'أولاً: اختر' },
      { type: 'essay', count: 1, sectionTitle: 'ثانياً: أجب' },
      { type: 'true_false', count: 10 },
    ],
  }));
  check('picked rows', r1.items.length === 2 + 1 + 2, r1.items.length);
  check('row degree applied', r1.items.slice(0, 2).every(i => i.degree === 2));
  check('bank default degree when no row degree', r1.items[2].degree === 3, r1.items[2].degree);
  check('section titles on first item of row', r1.items[0].sectionTitle === 'أولاً: اختر' && r1.items[1].sectionTitle === null && r1.items[2].sectionTitle === 'ثانياً: أجب');
  check('shortfall reported', r1.report.shortfalls.length === 1 && r1.report.shortfalls[0].found === 2 && r1.report.shortfalls[0].row === 3, r1.report);
  check('no duplicate questions', new Set(r1.items.map(i => i.questionId)).size === r1.items.length);
  check('total degree', r1.exam.totalDegree === 2 * 2 + 3 + 2, r1.exam.totalDegree);
  check('duration saved', r1.exam.durationMins === 45);

  const mcqIds = new Set(r1.items.filter(i => i.type === 'mcq').map(i => i.questionId));
  const r2 = await uc.generateExamAuto(T, u1.id, gen({ title: 'تسميع', kind: 'quiz', blueprint: [{ type: 'mcq', count: 2 }], avoidRecentDays: 30 }));
  check('avoid recent: picks unused mcqs first', r2.items.every(i => !mcqIds.has(i.questionId)) && r2.report.recentlyUsed === 0, r2.items.map(i => i.questionId));
  check('quiz kind stored', (await repo.findExamById(T, r2.exam.id))!.kind === 'quiz');
  const r3 = await uc.generateExamAuto(T, u1.id, gen({ title: 'تسميع 2', kind: 'quiz', blueprint: [{ type: 'mcq', count: 3 }], avoidRecentDays: 30 }));
  check('falls back to recently used when bank is short', r3.items.length === 3 && r3.report.recentlyUsed === 3, r3.report);
  const quizzes = await uc.listExams(T, u2.id, { page: 1, limit: 50, kind: 'quiz' } as any);
  check('list filter kind=quiz', quizzes.total === 2, quizzes.total);
  const legacy = await uc.generateExamAuto(T, u1.id, gen({ title: 'قديم', count: 4, questionTypes: ['fill'] }));
  check('legacy single-row generate still works', legacy.items.length === 3 && legacy.items.every(i => i.type === 'fill'));
  try { await uc.generateExamAuto(T, u1.id, gen({ title: 'xx', blueprint: [{ type: 'mcq', count: 2 }], tags: ['مش موجود'] })); check('empty result -> 404', false); }
  catch (e: any) { check('empty result -> 404', e.code === 'NOT_FOUND' || e.status === 404, e.message); }

  console.log('\n— versions');
  const { items } = await uc.getExam(T, u1.id, r1.exam.id);
  const vA = applyVersion(items, r1.exam.id, 0), vB = applyVersion(items, r1.exam.id, 1), vB2 = applyVersion(items, r1.exam.id, 1);
  check('version A = original order', vA.map(i => i.id).join() === [...items].sort((a, b) => a.sortOrder - b.sortOrder).map(i => i.id).join());
  check('version deterministic', vB.map(i => i.id + (i.options ?? []).join('|')).join() === vB2.map(i => i.id + (i.options ?? []).join('|')).join());
  check('sections stay in place', vB[0].sectionTitle === 'أولاً: اختر' && vB[2].sectionTitle === 'ثانياً: أجب' && vB.slice(0, 2).every(i => i.type === 'mcq'));
  check('mcq correct answer preserved', vB.filter(i => i.type === 'mcq').every(i => i.correctAnswer === 'ب1' && i.options!.includes('ب1')));
  check('"كل ما سبق" pinned last', vB.filter(i => i.type === 'mcq').every(i => i.options![3] === 'كل ما سبق'));
  let anyDiff = false;
  for (let v = 1; v <= 3; v++) { const x = applyVersion(items, r1.exam.id, v); if (x.map(i => i.id + (i.options ?? []).join()).join() !== vA.map(i => i.id + (i.options ?? []).join()).join()) anyDiff = true; }
  check('versions B-D differ from A', anyDiff);
  const res = fakeRes();
  await uc.generatePdf(T, u2.id, r1.exam.id, res, { answerKey: true, version: 2 });
  check('pdf version+key filename', /answer-key-.*-C\.pdf/.test(res.headers['Content-Disposition']), res.headers);
  check('pdf html has version label', rendered.includes('نموذج (ج)') && rendered.includes('نموذج الإجابة'));

  console.log('\n— session link');
  const [sg] = await run(`INSERT INTO subject_grades(subject_id, grade) VALUES ($1,'الأول الثانوي') RETURNING id`, [sub.id]);
  const [g] = await run(`INSERT INTO groups(name, subject_grade_id) VALUES ('G', $1) RETURNING id`, [sg.id]);
  const [lesson] = await run(`INSERT INTO sessions(type, group_id, title, start_date) VALUES ('lesson',$1,'حصة','2026-11-22') RETURNING id`, [g.id]);
  const [ex] = await run(`INSERT INTO sessions(type, group_id, title, out_of, start_date) VALUES ('exam',$1,'امتحان',20,'2026-11-22') RETURNING id`, [g.id]);
  try { await uc.linkSession(T, u1.id, r1.exam.id, lesson.id); check('reject link to plain lesson', false); }
  catch (e: any) { check('reject link to plain lesson', e.code === 'INVALID_SESSION_TYPE', e.code); }
  const [st] = await run(`INSERT INTO students(full_name, parent_phone, qr_code) VALUES ('طالب','01000000000','QR-EX-1') RETURNING id`);
  await run(`INSERT INTO attendance(session_id, student_id, status, degree) VALUES ($1,$2,'present',15)`, [ex.id, st.id]);
  try { await uc.linkSession(T, u1.id, r1.exam.id, ex.id); check('reject when existing grade > exam total', false); }
  catch (e: any) { check('reject when existing grade > exam total', e.code === 'DEGREE_CONFLICT', e.code); }
  await run(`UPDATE attendance SET degree = 8 WHERE session_id = $1`, [ex.id]);
  const link = await uc.linkSession(T, u1.id, r1.exam.id, ex.id);
  const [s1] = await run(`SELECT out_of, exam_id FROM sessions WHERE id=$1`, [ex.id]);
  check('link sets exam_id + out_of = total', s1.exam_id === r1.exam.id && Number(s1.out_of) === 9 && link.outOf === 9, s1);
  const se = await uc.getSessionExam(T, ex.id);
  check('getSessionExam', se?.id === r1.exam.id && se?.totalDegree === 9, se);
  // change exam items → total 12.5 → synced
  await uc.saveExamItems(T, u2.id, r1.exam.id, { items: items.map((i, k) => ({ ...i, degree: k === 0 ? 4.5 : i.degree, sortOrder: k })) } as any);
  const [s2] = await run(`SELECT out_of FROM sessions WHERE id=$1`, [ex.id]);
  check('editing exam syncs open session out_of (decimal)', Number(s2.out_of) === 11.5, s2);
  // shrink below a recorded grade → not synced
  await uc.saveExamItems(T, u2.id, r1.exam.id, { items: items.slice(0, 2).map((i, k) => ({ ...i, degree: 1, sortOrder: k })) } as any);
  const [s3] = await run(`SELECT out_of FROM sessions WHERE id=$1`, [ex.id]);
  check('no sync when a grade exceeds new total', Number(s3.out_of) === 11.5, s3);
  const linked = await uc.getLinkedSessions(T, r1.exam.id);
  check('linked sessions list', linked.length === 1 && linked[0].groupName === 'G', linked);
  await uc.unlinkSession(T, ex.id);
  const [s4] = await run(`SELECT out_of, exam_id FROM sessions WHERE id=$1`, [ex.id]);
  check('unlink keeps out_of, clears exam_id', s4.exam_id === null && Number(s4.out_of) === 11.5, s4);

  console.log('\n— import');
  const text = `1) عاصمة مصر هي؟
أ) القاهرة *
ب) الإسكندرية
ج) أسوان

٢- الماء يغلي عند 100 درجة (صح)
3. ناتج 7 × 8 = ........
الإجابة: 56
4) اختر الإجابة الصحيحة: أكبر كوكب
أ- المريخ
ب- المشتري
ج- زحل
الإجابة: ب
5) اشرح دورة الماء
الإجابة: تبخر ثم تكاثف
6) سؤال اختياري من غير إجابة
أ) واحد
ب) اتنين
س7: الشمس نجم
الإجابة: خطأ`;
  const p = parseQuestionsText(text);
  check('text parse count', p.questions.length === 6 && p.errors.length === 1, { q: p.questions.map(q => q.type), e: p.errors });
  check('text: mcq star', p.questions[0].type === 'mcq' && p.questions[0].correctAnswer === 'القاهرة' && p.questions[0].questionText === 'عاصمة مصر هي؟');
  check('text: tf tail', p.questions[1].type === 'true_false' && p.questions[1].correctAnswer === 'صح' && !p.questions[1].questionText.includes('(صح)'));
  check('text: fill', p.questions[2].type === 'fill' && p.questions[2].correctAnswer === '56');
  check('text: mcq letter answer', p.questions[3].correctAnswer === 'المشتري' && p.questions[3].options!.length === 3);
  check('text: essay model', p.questions[4].type === 'essay' && p.questions[4].modelAnswer === 'تبخر ثم تكاثف');
  check('text: tf answer line (wrong)', p.questions[5].type === 'true_false' && p.questions[5].correctAnswer === 'خطأ', p.questions[5]);
  const opts = ImportTextSchema.parse({ text, subjectId: sub.id, grade: 'الأول الثانوي', tags: 'الوحدة 3، مراجعة', dryRun: 'true' });
  const dry = await uc.importFromText(T, u2.id, text, opts);
  check('dry run creates nothing', dry.created === 0 && dry.valid === 6 && dry.errors.length === 1, dry);
  const before = (await uc.listQuestions(T, u1.id, { page: 1, limit: 1 } as any)).total;
  const real = await uc.importFromText(T, u2.id, text, { ...opts, dryRun: false });
  const after = (await uc.listQuestions(T, u1.id, { page: 1, limit: 1 } as any)).total;
  check('import creates', real.created === 6 && after - before === 6, { real, before, after });
  const again = await uc.importFromText(T, u2.id, text, { ...opts, dryRun: false });
  check('re-import skips duplicates', again.created === 0 && again.duplicates === 6, again);
  const tagged = await uc.listQuestions(T, u1.id, { page: 1, limit: 50, tags: ['مراجعة'] } as any);
  check('default tags applied', tagged.total === 6);

  const tpl = await uc.buildImportTemplate();
  check('template is xlsx', tpl.slice(0, 2).toString() === 'PK' && tpl.length > 3000, tpl.length);
  const ex1 = await uc.importFromExcel(T, u1.id, tpl, ImportOptionsSchema.parse({ dryRun: '1' }));
  check('template example rows parse cleanly', ex1.valid + ex1.duplicates === 4 && ex1.duplicates === 1 && ex1.errors.length === 0, ex1);
  const sheet = parseQuestionsSheet([
    ['نوع السؤال', 'نص السؤال', 'اختيار أ', 'اختيار ب', 'اختيار ج', 'اختيار د', 'الإجابة الصحيحة', 'الشرح', 'المستوى', 'الدرجة', 'الوحدة'],
    ['', 'سؤال من غير نوع وفيه اختيارات', 'x', 'y', '', '', '2', '', 'صعب', '٢', 'و1, و2'],
    ['اختياري', 'إجابة غلط', 'x', 'y', '', '', 'ق', '', '', '', ''],
    ['', '', '', '', '', '', '', '', '', '', ''],
    ['صح وخطأ', 'من غير إجابة', '', '', '', '', '', '', '', '', ''],
    ['أكمل', 'درجة غلط ....', '', '', '', '', 'a', '', '', 'abc', ''],
  ]);
  check('sheet: inferred mcq + arabic digit degree + tags', sheet.questions.length === 1 && sheet.questions[0].type === 'mcq' && sheet.questions[0].correctAnswer === 'y' && sheet.questions[0].defaultDegree === 2 && sheet.questions[0].tags!.length === 2 && sheet.questions[0].difficulty === 'hard', sheet.questions[0]);
  check('sheet: errors with row numbers', sheet.errors.map(e => e.ref).join() === '3,5,6', sheet.errors);

  console.log(`\n${pass} passed, ${fail} failed`);
  await pool.end();
  process.exit(fail ? 1 : 0);
})().catch(async (e) => { console.error('CRASH', e); await pool.end(); process.exit(1); });
