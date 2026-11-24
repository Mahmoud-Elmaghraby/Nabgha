import { ExamUseCase, esc, findCorrectOptionIndex, normalizeTrueFalse, safeColor } from '../../src/modules/exams/application/use-cases/exam.usecase';
import { ExamEntity, ExamItemEntity } from '../../src/modules/exams/domain/entities/exam.entity';
import * as fs from 'fs';
const assert = (c: any, m: string) => { if (!c) { console.log('FAIL', m); process.exitCode = 1; } else console.log('ok', m); };
assert(esc('<script>"x"&\'') === '&lt;script&gt;&quot;x&quot;&amp;&#39;', 'escape');
assert(safeColor('red;}body{display:none', '#0E3B2E') === '#0E3B2E', 'color injection blocked');
assert(safeColor('#123abc', 'x') === '#123abc', 'hex accepted');
assert(findCorrectOptionIndex(['القاهرة','الجيزة','أسوان'], ' الجيزة ') === 1, 'mcq by text');
assert(findCorrectOptionIndex(['a','b','c'], 'ج') === 2, 'mcq by letter');
assert(findCorrectOptionIndex(['a','b','c'], '1') === 0, 'mcq by number');
assert(findCorrectOptionIndex(['a','b'], 'z') === -1, 'mcq not found');
assert(normalizeTrueFalse('صح') === true && normalizeTrueFalse('خطأ') === false && normalizeTrueFalse('?') === null, 'tf');
const uc: any = new (ExamUseCase as any)({}, {}, {});
const exam = new ExamEntity({ id: 'e1', title: 'امتحان الوحدة الأولى <b>x</b>', grade: 'الصف الأول الثانوي', durationMins: 30, totalDegree: 7.5, instructions: 'اقرأ الأسئلة جيداً\nأجب عن جميع الأسئلة', designConfig: { header_color: 'red;}' } as any, examDate: new Date('2026-12-01') });
const items = [
  new ExamItemEntity({ id:'1', sortOrder:0, type:'mcq', questionText:'عاصمة مصر هي <img src=x onerror=alert(1)>', options:['القاهرة','الإسكندرية','أسوان','الأقصر'], correctAnswer:'القاهرة', degree:1, sectionTitle:'السؤال الأول: اختر', modelAnswer:'لأنها مقر الحكومة' }),
  new ExamItemEntity({ id:'2', sortOrder:1, type:'true_false', questionText:'الماء يغلي عند 100 درجة مئوية', correctAnswer:'صح', degree:1 }),
  new ExamItemEntity({ id:'3', sortOrder:2, type:'fill', questionText:'ناتج 7 × 8 = ......', correctAnswer:'56', degree:2.5 }),
  new ExamItemEntity({ id:'4', sortOrder:3, type:'essay', questionText:'اشرح دورة الماء في الطبيعة', modelAnswer:'تبخر ← تكاثف ← هطول', degree:3, imageUrl:'/storage/x.png' }),
];
const images = new Map<string,string>([['/storage/x.png', 'data:image/png;base64,' + 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==']]);
const h1 = uc._buildExamHtml(exam, items, images, { answerKey: false });
const h2 = uc._buildExamHtml(exam, items, images, { answerKey: true });
assert(!h1.includes('<img src=x') && !h1.includes('<b>x</b>'), 'no raw injection');
assert(!h1.includes('fonts.googleapis'), 'no google fonts');
assert(h1.includes('#0E3B2E') && !h1.includes('red;}'), 'brand color fallback');
assert(!h1.includes('class="option-circle correct"'), 'student copy has no answers');
assert(h2.includes('نموذج الإجابة') && h2.includes('class="option-circle correct"') && h2.includes('56') && h2.includes('تبخر'), 'answer key marks answers');
assert(h1.includes('<img class="question-image" src="data:image/png'), 'image inlined');
assert(!h2.includes('اسم الطالب'), 'answer key hides student fields');
if (process.env.EXAM_HTML_OUT) { fs.writeFileSync(`${process.env.EXAM_HTML_OUT}/exam.html`, h1); fs.writeFileSync(`${process.env.EXAM_HTML_OUT}/key.html`, h2); }
