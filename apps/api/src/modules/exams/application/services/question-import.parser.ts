// ============================================================
// استيراد أسئلة — من نص ملصوق (Word / واتساب / ملاحظات) أو من صفوف Excel
// دوال pure من غير أي اعتماد على قاعدة البيانات عشان تتختبر لوحدها
// ============================================================

export type ImportQuestionType = 'mcq' | 'true_false' | 'fill' | 'essay';
export type ImportDifficulty   = 'easy' | 'medium' | 'hard';

export interface ParsedQuestion {
  /** رقم السؤال في الملف/النص (للعرض في المعاينة ورسائل الأخطاء) */
  ref:           number;
  type:          ImportQuestionType;
  questionText:  string;
  options:       string[] | null;
  correctAnswer: string | null;
  modelAnswer:   string | null;
  difficulty?:   ImportDifficulty;
  defaultDegree?: number;
  tags?:         string[];
}

export interface ParseError { ref: number; message: string }
export interface ParseResult { questions: ParsedQuestion[]; errors: ParseError[] }

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const toLatinDigits = (s: string) => s.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));

const OPTION_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];
// أ) / أ- / أ. / (أ) / a) / A. — "ا" و"ه" بنقبلهم لأن ناس كتير بتكتبهم كده
const OPTION_LINE = /^\s*[(\[]?\s*(أ|ا|ب|ج|د|هـ|ه|و|[a-fA-F])\s*[)\].\-:]\s*(.+)$/;
// 1) / 1- / 1. / ١) / س1: / س 1 - / Q1)
const QUESTION_NUM = /^\s*(?:س|سؤال|Q)?\s*([0-9٠-٩]{1,3})\s*[)\-.:]\s*(.+)$/i;
const ANSWER_LINE  = /^\s*(?:الإجابة|الاجابة|الإجابه|الاجابه|الجواب|ج|answer|ans)\s*(?:الصحيحة|الصحيحه)?\s*[:：\-]\s*(.+)$/i;
const EXPLAIN_LINE = /^\s*(?:الشرح|التوضيح|توضيح|شرح|السبب|explanation)\s*[:：\-]\s*(.+)$/i;
const CORRECT_MARK = /\s*(?:\*|✓|✔|\(صح\)|\(صحيح\)|\[صح\])\s*$/;
const TRUE_WORDS   = ['صح', 'صحيح', 'صحيحة', 'true', 't', '✓', '✔'];
const FALSE_WORDS  = ['خطأ', 'خطا', 'غلط', 'خاطئ', 'خاطئة', 'false', 'f', '✗', '✘', 'x'];
const BLANK        = /(\.{4,}|…{2,}|_{3,}|-{4,})/;

function letterIndex(raw: string): number {
  const l = raw.trim();
  if (l === 'ا') return 0;
  if (l === 'ه') return 4;
  const ar = OPTION_LETTERS.indexOf(l);
  if (ar >= 0) return ar;
  if (/^[a-f]$/i.test(l)) return l.toLowerCase().charCodeAt(0) - 97;
  return -1;
}

function tfValue(raw: string | null | undefined): boolean | null {
  if (!raw) return null;
  const v = raw.trim().replace(/[()[\].]/g, '').trim().toLowerCase();
  if (TRUE_WORDS.includes(v)) return true;
  if (FALSE_WORDS.includes(v)) return false;
  return null;
}

/** الإجابة ممكن تكون حرف (ب) أو رقم (2) أو نص الاختيار نفسه — بنرجّع نص الاختيار */
function resolveMcqAnswer(options: string[], raw: string): string | null {
  const a = toLatinDigits(raw.trim()).replace(/[)\].\-:]+$/, '').replace(/^[(\[]/, '').trim();
  const li = letterIndex(a);
  if (li >= 0 && li < options.length) return options[li];
  const n = Number(a);
  if (Number.isInteger(n) && n >= 1 && n <= options.length) return options[n - 1];
  const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
  const hit = options.find((o) => norm(o) === norm(a));
  return hit ?? null;
}

function splitBlocks(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/‏|‎/g, '').trimEnd());
  const blocks: string[][] = [];
  let cur: string[] = [];
  const flush = () => { if (cur.some((l) => l.trim())) blocks.push(cur.filter((l) => l.trim())); cur = []; };

  for (const line of lines) {
    if (!line.trim()) { flush(); continue; }
    // سطر مترقّم = بداية سؤال جديد (حتى من غير سطر فاضي قبله)
    if (QUESTION_NUM.test(line) && cur.length > 0 && !OPTION_LINE.test(line)) flush();
    cur.push(line);
  }
  flush();
  return blocks;
}

/**
 * نص ملصوق → أسئلة. الشكل المتوقع (مرن):
 *
 *   1) عاصمة مصر هي؟
 *   أ) القاهرة *
 *   ب) الإسكندرية
 *   الإجابة: أ            ← اختياري (بديل للنجمة)
 *
 *   2) الماء يغلي عند 100 درجة مئوية (صح)
 *   3) ناتج 7 × 8 = ......
 *   الإجابة: 56
 *   4) اشرح دورة الماء
 *   الإجابة: تبخر ثم تكاثف ثم هطول
 */
export function parseQuestionsText(text: string, maxQuestions = 500): ParseResult {
  const questions: ParsedQuestion[] = [];
  const errors: ParseError[] = [];
  const blocks = splitBlocks(text ?? '');

  blocks.forEach((block, bi) => {
    const ref = bi + 1;
    if (questions.length >= maxQuestions) {
      if (bi === maxQuestions) errors.push({ ref, message: `أقصى عدد في المرة الواحدة ${maxQuestions} سؤال` });
      return;
    }
    let first = block[0];
    const qm = first.match(QUESTION_NUM);
    if (qm && !OPTION_LINE.test(first)) first = qm[2];

    const stemLines: string[] = [first.trim()];
    const options: string[] = [];
    let markedCorrect = -1;
    let answerRaw: string | null = null;
    let explain: string | null = null;

    for (const raw of block.slice(1)) {
      const om = raw.match(OPTION_LINE);
      // "ج- زحل" ممكن يتقري كسطر إجابة (ج: ...) — لو الحرف هو الاختيار اللي عليه الدور يبقى اختيار
      const isNextOption = !!om && letterIndex(om[1]) === options.length;
      if (!isNextOption) {
        const ans = raw.match(ANSWER_LINE);
        if (ans) { answerRaw = ans[1].trim(); continue; }
        const ex = raw.match(EXPLAIN_LINE);
        if (ex) { explain = ex[1].trim(); continue; }
      }
      if (om && (isNextOption || options.length > 0)) {
        let opt = om[2].trim();
        if (CORRECT_MARK.test(opt)) { markedCorrect = options.length; opt = opt.replace(CORRECT_MARK, '').trim(); }
        options.push(opt);
        continue;
      }
      if (options.length > 0) {
        // سطر تكملة لآخر اختيار
        options[options.length - 1] += ' ' + raw.trim();
      } else if (answerRaw !== null) {
        answerRaw += '\n' + raw.trim();
      } else {
        stemLines.push(raw.trim());
      }
    }

    let stem = stemLines.join('\n').trim();

    if (options.length >= 2) {
      let correct = markedCorrect >= 0 ? options[markedCorrect] : null;
      if (!correct && answerRaw) correct = resolveMcqAnswer(options, answerRaw);
      if (!correct) {
        errors.push({ ref, message: `السؤال "${stem.slice(0, 40)}" اختياري ومفيهوش إجابة صحيحة (حط * جنب الصح أو سطر "الإجابة: ب")` });
        return;
      }
      questions.push({ ref, type: 'mcq', questionText: stem, options, correctAnswer: correct, modelAnswer: explain });
      return;
    }
    if (options.length === 1) {
      errors.push({ ref, message: `السؤال "${stem.slice(0, 40)}" فيه اختيار واحد بس` });
      return;
    }

    // صح وخطأ: (صح)/(خطأ) في آخر السؤال، أو سطر إجابة صح/خطأ
    const tail = stem.match(/\(\s*(صح|صحيح|خطأ|خطا|غلط|✓|✗)\s*\)\s*$/);
    const tfFromTail = tail ? tfValue(tail[1]) : null;
    const tfFromAns  = tfValue(answerRaw);
    if (tfFromTail !== null || tfFromAns !== null) {
      if (tail) stem = stem.slice(0, tail.index).trim();
      const v = tfFromAns ?? tfFromTail;
      questions.push({ ref, type: 'true_false', questionText: stem, options: null, correctAnswer: v ? 'صح' : 'خطأ', modelAnswer: explain });
      return;
    }

    if (stem.length < 3) {
      errors.push({ ref, message: 'نص السؤال قصير جداً' });
      return;
    }

    if (BLANK.test(stem)) {
      questions.push({ ref, type: 'fill', questionText: stem, options: null, correctAnswer: answerRaw, modelAnswer: explain });
      return;
    }

    questions.push({ ref, type: 'essay', questionText: stem, options: null, correctAnswer: null, modelAnswer: answerRaw ?? explain });
  });

  return { questions, errors };
}

// ─────────────────────────────────────────────────────────────
// Excel
// ─────────────────────────────────────────────────────────────

export const SHEET_HEADERS = [
  'نوع السؤال', 'نص السؤال', 'اختيار أ', 'اختيار ب', 'اختيار ج', 'اختيار د',
  'الإجابة الصحيحة', 'الإجابة النموذجية / الشرح', 'المستوى', 'الدرجة', 'الوحدة / التاجات',
] as const;

export const TYPE_LABELS: Record<ImportQuestionType, string> = {
  mcq: 'اختياري', true_false: 'صح وخطأ', fill: 'أكمل', essay: 'مقالي',
};
export const DIFFICULTY_LABELS: Record<ImportDifficulty, string> = { easy: 'سهل', medium: 'متوسط', hard: 'صعب' };

function parseType(raw: string): ImportQuestionType | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (/اختيار|متعدد|mcq|choice/.test(v)) return 'mcq';
  if (/صح|خطأ|خطا|true|false|tf/.test(v)) return 'true_false';
  if (/أكمل|اكمل|املأ|املا|fill|blank/.test(v)) return 'fill';
  if (/مقال|اشرح|essay|open/.test(v)) return 'essay';
  return null;
}

function parseDifficulty(raw: string): ImportDifficulty | undefined {
  const v = raw.trim().toLowerCase();
  if (!v) return undefined;
  if (/سهل|easy/.test(v)) return 'easy';
  if (/صعب|hard/.test(v)) return 'hard';
  if (/متوسط|medium|mid/.test(v)) return 'medium';
  return undefined;
}

/** يلاقي عمود كل حقل من الهيدر (لو المدرس غيّر الترتيب) — ولو مالقاش بيستخدم الترتيب الافتراضي */
function mapColumns(header: string[]): number[] {
  const norm = (s: string) => (s ?? '').toString().replace(/\s+/g, ' ').trim();
  const h = header.map(norm);
  const find = (re: RegExp, fallback: number) => {
    const i = h.findIndex((x) => re.test(x));
    return i >= 0 ? i : fallback;
  };
  return [
    find(/نوع/, 0),
    find(/نص/, 1),
    find(/اختيار\s*(أ|ا)$|^أ$/, 2),
    find(/اختيار\s*ب$|^ب$/, 3),
    find(/اختيار\s*ج$|^ج$/, 4),
    find(/اختيار\s*د$|^د$/, 5),
    find(/الصحيحة|الصحيحه/, 6),
    find(/النموذجية|النموذجيه|الشرح/, 7),
    find(/المستوى|الصعوبة/, 8),
    find(/الدرجة|الدرجه/, 9),
    find(/الوحدة|التاج/, 10),
  ];
}

/** صفوف الشيت (أول صف هيدر) → أسئلة. ref = رقم الصف في Excel */
export function parseQuestionsSheet(rows: string[][], maxQuestions = 1000): ParseResult {
  const questions: ParsedQuestion[] = [];
  const errors: ParseError[] = [];
  if (rows.length === 0) return { questions, errors: [{ ref: 1, message: 'الملف فاضي' }] };

  const col = mapColumns(rows[0]);
  const cell = (r: string[], i: number) => (r[col[i]] ?? '').toString().trim();

  for (let ri = 1; ri < rows.length; ri++) {
    const r = rows[ri] ?? [];
    const ref = ri + 1;
    const text = cell(r, 1);
    if (!text && r.every((c) => !String(c ?? '').trim())) continue; // صف فاضي
    if (questions.length >= maxQuestions) {
      errors.push({ ref, message: `أقصى عدد في الملف الواحد ${maxQuestions} سؤال` });
      break;
    }
    if (text.length < 3) { errors.push({ ref, message: 'نص السؤال فاضي أو قصير' }); continue; }

    const options = [2, 3, 4, 5].map((i) => cell(r, i)).filter(Boolean);
    let type = parseType(cell(r, 0));
    const ansRaw = cell(r, 6);
    if (!type) {
      // استنتاج النوع لو العمود فاضي
      type = options.length >= 2 ? 'mcq' : tfValue(ansRaw) !== null ? 'true_false' : BLANK.test(text) ? 'fill' : 'essay';
    }

    const degreeRaw = toLatinDigits(cell(r, 9)).replace(',', '.');
    const degree = degreeRaw ? Number(degreeRaw) : undefined;
    if (degreeRaw && !(degree! > 0)) { errors.push({ ref, message: `الدرجة "${cell(r, 9)}" مش رقم صحيح` }); continue; }

    const tags = cell(r, 10).split(/[،,;|]/).map((t) => t.trim()).filter(Boolean).slice(0, 20);
    const base = {
      ref,
      questionText: text,
      difficulty: parseDifficulty(cell(r, 8)),
      defaultDegree: degree,
      tags: tags.length ? tags : undefined,
    };
    const model = cell(r, 7) || null;

    if (type === 'mcq') {
      if (options.length < 2) { errors.push({ ref, message: 'السؤال الاختياري محتاج اختيارين على الأقل' }); continue; }
      const correct = ansRaw ? resolveMcqAnswer(options, ansRaw) : null;
      if (!correct) { errors.push({ ref, message: `الإجابة الصحيحة "${ansRaw}" مش مطابقة لأي اختيار (اكتب أ/ب/ج/د أو نص الاختيار)` }); continue; }
      questions.push({ ...base, type, options, correctAnswer: correct, modelAnswer: model });
    } else if (type === 'true_false') {
      const v = tfValue(ansRaw);
      if (v === null) { errors.push({ ref, message: 'إجابة صح وخطأ لازم تكون "صح" أو "خطأ"' }); continue; }
      questions.push({ ...base, type, options: null, correctAnswer: v ? 'صح' : 'خطأ', modelAnswer: model });
    } else if (type === 'fill') {
      questions.push({ ...base, type, options: null, correctAnswer: ansRaw || null, modelAnswer: model });
    } else {
      questions.push({ ...base, type, options: null, correctAnswer: null, modelAnswer: model || ansRaw || null });
    }
  }
  return { questions, errors };
}
