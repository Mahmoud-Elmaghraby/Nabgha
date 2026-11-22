import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FormSheet } from '@/shared/components/FormSheet';
import { useSubjects } from '@/features/subjects/hooks/useSubjects';
import { GRADE_OPTIONS } from '@nabgha/types';
import { examsApi } from '../api/exams.api';
import { useExamMutations } from '../hooks/useExams';
import {
  QUESTION_TYPE_LABELS,
  DIFFICULTY_LABELS,
  type BlueprintRow,
  type Difficulty,
  type ExamKind,
  type GeneratedExam,
  type QuestionType,
} from '../types/exam.types';

interface Props {
  open:        boolean;
  onClose:     () => void;
  /** بيتنادى بعد التوليد — عادةً بيفتح محرر الأسئلة على الامتحان الجديد */
  onGenerated: (result: GeneratedExam) => void;
  initialKind?: ExamKind;
}

type Row = { type: QuestionType | ''; difficulty: Difficulty | ''; count: number; degree: string; sectionTitle: string };

const SECTION_NAMES = ['أولاً', 'ثانياً', 'ثالثاً', 'رابعاً', 'خامساً', 'سادساً'];
const SECTION_BY_TYPE: Record<QuestionType, string> = {
  mcq: 'اختر الإجابة الصحيحة', true_false: 'ضع علامة (✓) أو (✗)', fill: 'أكمل ما يأتي', essay: 'أجب عما يأتي',
};

const PRESETS: Record<'quiz' | 'exam' | 'final', { label: string; kind: ExamKind; duration: number; rows: Row[] }> = {
  quiz: {
    label: 'تسميع سريع', kind: 'quiz', duration: 10,
    rows: [
      { type: 'mcq', difficulty: '', count: 5, degree: '1', sectionTitle: '' },
      { type: 'true_false', difficulty: '', count: 5, degree: '1', sectionTitle: '' },
    ],
  },
  exam: {
    label: 'امتحان شهري', kind: 'exam', duration: 45,
    rows: [
      { type: 'mcq', difficulty: '', count: 10, degree: '1', sectionTitle: 'أولاً: اختر الإجابة الصحيحة' },
      { type: 'true_false', difficulty: '', count: 5, degree: '1', sectionTitle: 'ثانياً: ضع علامة (✓) أو (✗)' },
      { type: 'fill', difficulty: '', count: 5, degree: '1', sectionTitle: 'ثالثاً: أكمل ما يأتي' },
      { type: 'essay', difficulty: '', count: 2, degree: '', sectionTitle: 'رابعاً: أجب عما يأتي' },
    ],
  },
  final: {
    label: 'شامل بمستويات', kind: 'exam', duration: 90,
    rows: [
      { type: 'mcq', difficulty: 'easy', count: 8, degree: '1', sectionTitle: 'أولاً: اختر الإجابة الصحيحة' },
      { type: 'mcq', difficulty: 'medium', count: 8, degree: '1', sectionTitle: '' },
      { type: 'mcq', difficulty: 'hard', count: 4, degree: '2', sectionTitle: '' },
      { type: 'essay', difficulty: '', count: 3, degree: '', sectionTitle: 'ثانياً: أجب عما يأتي' },
    ],
  },
};

const inputCls = 'w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20 focus:border-[#0E3B2E]';
const labelCls = 'block text-xs font-semibold text-gray-600 mb-1';

export function SmartGenerateModal({ open, onClose, onGenerated, initialKind = 'exam' }: Props) {
  const { data: subjects = [] } = useSubjects();
  const { generateExam } = useExamMutations();

  const [title, setTitle]         = useState('');
  const [kind, setKind]           = useState<ExamKind>(initialKind);
  const [subjectId, setSubjectId] = useState('');
  const [grade, setGrade]         = useState('');
  const [tags, setTags]           = useState<string[]>([]);
  const [duration, setDuration]   = useState('');
  const [avoidRecent, setAvoidRecent] = useState(true);
  const [rows, setRows]           = useState<Row[]>(PRESETS.exam.rows);
  const [error, setError]         = useState('');

  useEffect(() => {
    if (!open) return;
    const p = initialKind === 'quiz' ? PRESETS.quiz : PRESETS.exam;
    setTitle(''); setKind(p.kind); setRows(p.rows); setDuration(String(p.duration));
    setTags([]); setError('');
  }, [open, initialKind]);

  const { data: availability } = useQuery({
    queryKey: ['exams', 'questions', 'availability', subjectId, grade, tags.join('|')],
    queryFn:  () => examsApi.getAvailability({ subjectId, grade, tags }),
    enabled:  open,
    staleTime: 30_000,
  });

  /** عدد الأسئلة المتاحة لصف معيّن (بعد خصم اللي صفوف قبله هتاخده من نفس الخانة تقريباً) */
  const availableFor = (r: Row) =>
    (availability?.matrix ?? [])
      .filter((m) => (!r.type || m.type === r.type) && (!r.difficulty || m.difficulty === r.difficulty))
      .reduce((s, m) => s + m.count, 0);

  const totals = useMemo(() => {
    const count = rows.reduce((s, r) => s + (Number(r.count) || 0), 0);
    const degreeKnown = rows.every((r) => r.degree !== '');
    const degree = rows.reduce((s, r) => s + (Number(r.count) || 0) * (Number(r.degree) || 0), 0);
    return { count, degree, degreeKnown };
  }, [rows]);

  const applyPreset = (key: keyof typeof PRESETS) => {
    const p = PRESETS[key];
    setKind(p.kind); setRows(p.rows.map((r) => ({ ...r }))); setDuration(String(p.duration));
  };

  const updateRow = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  const addRow = () => {
    const used = rows.filter((r) => r.sectionTitle).length;
    setRows((rs) => [...rs, {
      type: 'mcq', difficulty: '', count: 5, degree: '1',
      sectionTitle: `${SECTION_NAMES[used] ?? ''}: ${SECTION_BY_TYPE.mcq}`,
    }]);
  };

  const toggleTag = (t: string) => setTags((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]));

  const handleSubmit = async () => {
    setError('');
    if (title.trim().length < 2) return setError('اكتب عنوان للامتحان');
    if (rows.length === 0 || totals.count === 0) return setError('ضيف صف واحد على الأقل في المواصفات');
    if (totals.count > 150) return setError('أقصى عدد 150 سؤال');

    const blueprint: BlueprintRow[] = rows
      .filter((r) => Number(r.count) > 0)
      .map((r) => ({
        type:         r.type || null,
        difficulty:   r.difficulty || null,
        count:        Number(r.count),
        degree:       r.degree !== '' && Number(r.degree) > 0 ? Number(r.degree) : null,
        sectionTitle: r.sectionTitle.trim() || null,
      }));

    try {
      const res = await generateExam.mutateAsync({
        title: title.trim(),
        kind,
        subjectId:       subjectId || null,
        grade:           grade || null,
        durationMins:    Number(duration) > 0 ? Number(duration) : null,
        tags:            tags.length ? tags : undefined,
        avoidRecentDays: avoidRecent ? 30 : 0,
        blueprint,
      });
      onGenerated(res);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.response?.data?.message || 'تعذّر التوليد — تأكد إن البنك فيه أسئلة مطابقة');
    }
  };

  return (
    <FormSheet
      open={open}
      onClose={onClose}
      title="⚡ مولّد الامتحانات الذكي"
      subtitle="حدد مواصفات الامتحان والبرنامج يختار الأسئلة من البنك"
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <div className="text-xs text-gray-500">
            {totals.count} سؤال
            {totals.degreeKnown ? ` • ${totals.degree} درجة` : ' • الدرجة حسب البنك'}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">إلغاء</button>
            <button
              onClick={handleSubmit}
              disabled={generateExam.isPending}
              className="px-5 py-2 text-sm bg-[#0E3B2E] text-white rounded-lg hover:bg-[#0E3B2E]/90 disabled:opacity-50 font-medium"
            >
              {generateExam.isPending ? 'جاري التوليد...' : kind === 'quiz' ? 'ولّد التسميع' : 'ولّد الامتحان'}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4" dir="rtl">
        {/* قوالب جاهزة */}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PRESETS) as Array<keyof typeof PRESETS>).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => applyPreset(k)}
              className="px-3 py-1.5 text-xs rounded-full border border-[#0E3B2E]/20 text-[#0E3B2E] bg-[#0E3B2E]/5 hover:bg-[#0E3B2E]/10"
            >
              {PRESETS[k].label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className={labelCls}>العنوان *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls}
              placeholder={kind === 'quiz' ? 'مثال: تسميع الدرس الثالث' : 'مثال: امتحان شهر نوفمبر'} />
          </div>
          <div>
            <label className={labelCls}>النوع</label>
            <div className="grid grid-cols-2 gap-1 bg-gray-100 p-1 rounded-lg">
              {(['exam', 'quiz'] as ExamKind[]).map((k) => (
                <button key={k} type="button" onClick={() => setKind(k)}
                  className={`py-1.5 text-xs rounded-md font-medium ${kind === k ? 'bg-white shadow text-[#0E3B2E]' : 'text-gray-500'}`}>
                  {k === 'exam' ? 'امتحان' : 'تسميع'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>المادة</label>
            <select value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setTags([]); }} className={inputCls}>
              <option value="">كل المواد</option>
              {subjects.map((s) => <option key={s.subject.id} value={s.subject.id}>{s.subject.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>المرحلة</label>
            <select value={grade} onChange={(e) => { setGrade(e.target.value); setTags([]); }} className={inputCls}>
              <option value="">كل المراحل</option>
              {GRADE_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>المدة (دقيقة)</label>
            <input type="number" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} className={inputCls} />
          </div>
        </div>

        {/* الوحدات */}
        {availability && availability.tags.length > 0 && (
          <div>
            <label className={labelCls}>الوحدات / الدروس {tags.length === 0 && <span className="font-normal text-gray-400">(الكل)</span>}</label>
            <div className="flex flex-wrap gap-1.5">
              {availability.tags.map((t) => (
                <button key={t.tag} type="button" onClick={() => toggleTag(t.tag)}
                  className={`px-2.5 py-1 text-xs rounded-full border ${
                    tags.includes(t.tag) ? 'bg-[#0E3B2E] text-white border-[#0E3B2E]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#0E3B2E]/40'
                  }`}>
                  {t.tag} <span className="opacity-60">({t.count})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* المواصفات */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-gray-600">مواصفات الأسئلة</label>
            <span className="text-[11px] text-gray-400">
              المتاح في البنك: {availability?.total ?? '…'} سؤال
            </span>
          </div>
          <div className="space-y-2">
            {rows.map((r, i) => {
              const avail = availableFor(r);
              const short = availability && Number(r.count) > avail;
              return (
                <div key={i} className="border border-gray-100 rounded-lg p-2.5 bg-gray-50/50 space-y-2">
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-4 sm:col-span-3">
                      <label className="text-[10px] text-gray-400">النوع</label>
                      <select value={r.type} onChange={(e) => {
                        const type = e.target.value as QuestionType | '';
                        const patch: Partial<Row> = { type };
                        // لو العنوان لسه افتراضي غيّره مع النوع
                        if (type && /:/.test(r.sectionTitle)) {
                          patch.sectionTitle = `${r.sectionTitle.split(':')[0]}: ${SECTION_BY_TYPE[type]}`;
                        }
                        if (type === 'essay' && r.degree === '1') patch.degree = '';
                        updateRow(i, patch);
                      }} className={inputCls}>
                        <option value="">أي نوع</option>
                        {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) =>
                          <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>)}
                      </select>
                    </div>
                    <div className="col-span-4 sm:col-span-3">
                      <label className="text-[10px] text-gray-400">المستوى</label>
                      <select value={r.difficulty} onChange={(e) => updateRow(i, { difficulty: e.target.value as Difficulty | '' })} className={inputCls}>
                        <option value="">أي مستوى</option>
                        {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) =>
                          <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] text-gray-400">العدد</label>
                      <input type="number" min={1} max={100} value={r.count}
                        onChange={(e) => updateRow(i, { count: Number(e.target.value) })}
                        className={`${inputCls} ${short ? 'border-amber-400 bg-amber-50' : ''}`} />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] text-gray-400">درجة السؤال</label>
                      <input type="number" min={0.25} step={0.25} value={r.degree} placeholder="من البنك"
                        onChange={(e) => updateRow(i, { degree: e.target.value })} className={inputCls} />
                    </div>
                    <div className="col-span-12 sm:col-span-2 flex items-center justify-between sm:justify-end gap-2">
                      <span className={`text-[11px] ${short ? 'text-amber-600 font-semibold' : 'text-gray-400'}`}>
                        متاح {availability ? avail : '…'}
                      </span>
                      <button type="button" onClick={() => setRows((rs) => rs.filter((_, k) => k !== i))}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="حذف الصف">✕</button>
                    </div>
                  </div>
                  <input value={r.sectionTitle} onChange={(e) => updateRow(i, { sectionTitle: e.target.value })}
                    placeholder="عنوان القسم في الورقة (اختياري) — مثال: أولاً: اختر الإجابة الصحيحة"
                    className="w-full border-0 border-b border-dashed border-gray-200 bg-transparent px-1 py-1 text-xs focus:outline-none focus:border-[#0E3B2E]" />
                </div>
              );
            })}
          </div>
          <button type="button" onClick={addRow}
            className="mt-2 w-full border-2 border-dashed border-gray-200 rounded-lg py-2 text-xs text-gray-500 hover:border-[#0E3B2E]/40 hover:text-[#0E3B2E]">
            + صف جديد
          </button>
        </div>

        <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
          <input type="checkbox" checked={avoidRecent} onChange={(e) => setAvoidRecent(e.target.checked)} className="mt-0.5" />
          <span>
            تجنّب الأسئلة اللي نزلت في امتحانات آخر 30 يوم
            <span className="block text-gray-400">لو البنك مش كفاية بيكمّل منها عشان الامتحان مايطلعش ناقص</span>
          </span>
        </label>

        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
      </div>
    </FormSheet>
  );
}
