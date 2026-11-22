import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FormSheet } from '@/shared/components/FormSheet';
import { useSubjects } from '@/features/subjects/hooks/useSubjects';
import { GRADE_OPTIONS } from '@nabgha/types';
import { downloadBlob } from '@/shared/lib/downloadBlob';
import { examsApi } from '../api/exams.api';
import { EXAM_KEYS } from '../hooks/useExams';
import {
  QUESTION_TYPE_LABELS,
  DIFFICULTY_LABELS,
  type Difficulty,
  type ImportOptions,
  type ImportReport,
} from '../types/exam.types';

interface Props {
  open:    boolean;
  onClose: () => void;
}

const SAMPLE = `1) عاصمة مصر هي؟
أ) القاهرة *
ب) الإسكندرية
ج) أسوان

2) الماء يغلي عند 100 درجة مئوية (صح)

3) ناتج 7 × 8 = ........
الإجابة: 56

4) اشرح دورة الماء في الطبيعة.
الإجابة: تبخر ثم تكاثف ثم هطول`;

const inputCls = 'w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20 focus:border-[#0E3B2E]';
const labelCls = 'block text-xs font-semibold text-gray-600 mb-1';

export function ImportQuestionsModal({ open, onClose }: Props) {
  const qc = useQueryClient();
  const { data: subjects = [] } = useSubjects();
  const fileRef = useRef<HTMLInputElement>(null);

  const [mode, setMode]           = useState<'text' | 'excel'>('text');
  const [text, setText]           = useState('');
  const [file, setFile]           = useState<File | null>(null);
  const [subjectId, setSubjectId] = useState('');
  const [grade, setGrade]         = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [degree, setDegree]       = useState('1');
  const [tags, setTags]           = useState('');
  const [report, setReport]       = useState<ImportReport | null>(null);
  const [busy, setBusy]           = useState(false);
  const [error, setError]         = useState('');

  useEffect(() => {
    if (!open) return;
    setReport(null); setError(''); setText(''); setFile(null);
  }, [open]);

  // أي تغيير في المدخلات بيلغي المعاينة القديمة
  useEffect(() => { setReport(null); }, [text, file, mode, subjectId, grade, difficulty, degree, tags]);

  const opts = (dryRun: boolean): ImportOptions => ({
    subjectId:     subjectId || null,
    grade:         grade || null,
    difficulty,
    defaultDegree: Number(degree) > 0 ? Number(degree) : 1,
    tags:          tags.split(/[،,]/).map((t) => t.trim()).filter(Boolean),
    dryRun,
  });

  const run = async (dryRun: boolean) => {
    setError('');
    if (mode === 'text' && text.trim().length < 3) return setError('الصق الأسئلة الأول');
    if (mode === 'excel' && !file) return setError('اختار ملف Excel');
    setBusy(true);
    try {
      const r = mode === 'text'
        ? await examsApi.importText(text, opts(dryRun))
        : await examsApi.importExcel(file!, opts(dryRun));
      setReport(r);
      if (!dryRun) {
        qc.invalidateQueries({ queryKey: EXAM_KEYS.questions() });
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.response?.data?.message || 'تعذّر قراءة الأسئلة');
    } finally {
      setBusy(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      downloadBlob(await examsApi.downloadImportTemplate(), 'قالب أسئلة نبغة.xlsx');
    } catch {
      setError('تعذّر تحميل القالب');
    }
  };

  const done = report && !report.dryRun;

  return (
    <FormSheet
      open={open}
      onClose={onClose}
      title="استيراد أسئلة"
      subtitle="من ملف Excel أو بلصق الأسئلة من Word / واتساب"
      size="lg"
      footer={
        <div className="flex gap-2 justify-end w-full">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
            {done ? 'تم' : 'إلغاء'}
          </button>
          {!done && (
            report && report.valid > 0 ? (
              <button onClick={() => run(false)} disabled={busy}
                className="px-5 py-2 text-sm bg-[#0E3B2E] text-white rounded-lg hover:bg-[#0E3B2E]/90 disabled:opacity-50 font-medium">
                {busy ? 'جاري الحفظ...' : `أضف ${report.valid} سؤال للبنك`}
              </button>
            ) : (
              <button onClick={() => run(true)} disabled={busy}
                className="px-5 py-2 text-sm bg-[#0E3B2E] text-white rounded-lg hover:bg-[#0E3B2E]/90 disabled:opacity-50 font-medium">
                {busy ? 'جاري القراءة...' : 'معاينة'}
              </button>
            )
          )}
        </div>
      }
    >
      <div className="space-y-4" dir="rtl">
        {done ? (
          <div className="text-center py-8 space-y-2">
            <div className="text-4xl">✅</div>
            <div className="text-base font-bold text-gray-900">اتضاف {report!.created} سؤال للبنك</div>
            {report!.duplicates > 0 && <div className="text-xs text-gray-500">اتخطّى {report!.duplicates} سؤال مكرر</div>}
            {report!.errors.length > 0 && <div className="text-xs text-amber-600">{report!.errors.length} سؤال فيه مشكلة ومااتضافش</div>}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-1 bg-gray-100 p-1 rounded-lg">
              {([['text', '📋 لصق نص'], ['excel', '📊 ملف Excel']] as const).map(([m, label]) => (
                <button key={m} type="button" onClick={() => setMode(m)}
                  className={`py-2 text-sm rounded-md font-medium ${mode === m ? 'bg-white shadow text-[#0E3B2E]' : 'text-gray-500'}`}>
                  {label}
                </button>
              ))}
            </div>

            {mode === 'text' ? (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={labelCls}>الأسئلة</label>
                  <button type="button" onClick={() => setText(SAMPLE)} className="text-[11px] text-[#0E3B2E] underline">
                    شوف مثال
                  </button>
                </div>
                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={10}
                  className={`${inputCls} font-mono text-[13px] leading-6`}
                  placeholder={'الصق الأسئلة هنا...\n\nرقّم كل سؤال (1) 2) 3)...)، والاختيارات بالحروف (أ) ب) ج))،\nوحط * جنب الإجابة الصحيحة أو اكتب سطر "الإجابة: ..."'} />
                <ul className="text-[11px] text-gray-500 mt-1.5 space-y-0.5 list-disc pr-4">
                  <li>اختياري: الاختيارات أ) ب) ج) د) و * جنب الصح، أو سطر "الإجابة: ب"</li>
                  <li>صح وخطأ: اكتب (صح) أو (خطأ) في آخر السؤال</li>
                  <li>أكمل: حط ........ مكان الفراغ وسطر "الإجابة: ..."</li>
                  <li>مقالي: أي سؤال تاني، والإجابة النموذجية في سطر "الإجابة: ..."</li>
                </ul>
              </div>
            ) : (
              <div className="space-y-2">
                <button type="button" onClick={downloadTemplate}
                  className="text-xs px-3 py-1.5 border border-[#0E3B2E]/30 text-[#0E3B2E] rounded-lg hover:bg-[#0E3B2E]/5">
                  ⬇ تحميل قالب Excel جاهز
                </button>
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-200 rounded-lg py-6 text-sm text-gray-500 hover:border-[#0E3B2E]/40 hover:text-[#0E3B2E]">
                  {file ? `📊 ${file.name}` : 'اختار ملف Excel (.xlsx)'}
                </button>
                <input ref={fileRef} type="file" className="hidden"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(e) => { setFile(e.target.files?.[0] ?? null); if (fileRef.current) fileRef.current.value = ''; }} />
              </div>
            )}

            {/* إعدادات افتراضية */}
            <div className="border border-gray-100 rounded-lg p-3 space-y-3 bg-gray-50/50">
              <div className="text-xs font-semibold text-gray-600">تتطبّق على كل الأسئلة (لو السؤال نفسه مفيهوش قيمة)</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={inputCls}>
                  <option value="">المادة</option>
                  {subjects.map((s: any) => <option key={s.subject.id} value={s.subject.id}>{s.subject.name}</option>)}
                </select>
                <select value={grade} onChange={(e) => setGrade(e.target.value)} className={inputCls}>
                  <option value="">المرحلة</option>
                  {GRADE_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)} className={inputCls}>
                  {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}
                </select>
                <input type="number" min={0.25} step={0.25} value={degree} onChange={(e) => setDegree(e.target.value)}
                  className={inputCls} placeholder="الدرجة" title="درجة السؤال" />
                <input value={tags} onChange={(e) => setTags(e.target.value)} className={`${inputCls} sm:col-span-2`}
                  placeholder="الوحدة / الدرس (مثال: الوحدة الأولى)" />
              </div>
            </div>

            {/* المعاينة */}
            {report && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold">جاهز: {report.valid}</span>
                  {report.duplicates > 0 && <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">مكرر: {report.duplicates}</span>}
                  {report.errors.length > 0 && <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">فيه مشكلة: {report.errors.length}</span>}
                </div>
                {report.errors.length > 0 && (
                  <div className="max-h-32 overflow-y-auto border border-amber-100 bg-amber-50/50 rounded-lg p-2 text-xs space-y-1">
                    {report.errors.map((er, i) => (
                      <div key={i} className="text-amber-800">
                        <span className="font-semibold">{mode === 'excel' ? `صف ${er.ref}` : `سؤال ${er.ref}`}:</span> {er.message}
                      </div>
                    ))}
                  </div>
                )}
                {report.preview.length > 0 && (
                  <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-lg">
                    {report.preview.map((q) => (
                      <div key={q.ref} className="p-2.5 text-xs space-y-1">
                        <div className="flex gap-2 items-start">
                          <span className="px-1.5 py-0.5 rounded bg-[#0E3B2E]/10 text-[#0E3B2E] shrink-0">{QUESTION_TYPE_LABELS[q.type]}</span>
                          <span className="text-gray-800 whitespace-pre-line">{q.questionText}</span>
                        </div>
                        {q.options && (
                          <div className="flex flex-wrap gap-1.5 pr-14">
                            {q.options.map((o, i) => (
                              <span key={i} className={`px-1.5 py-0.5 rounded ${o === q.correctAnswer ? 'bg-emerald-100 text-emerald-800 font-semibold' : 'bg-gray-50 text-gray-600'}`}>
                                {['أ', 'ب', 'ج', 'د', 'هـ', 'و'][i]}) {o}
                              </span>
                            ))}
                          </div>
                        )}
                        {!q.options && q.correctAnswer && (
                          <div className="pr-14 text-emerald-700">الإجابة: {q.correctAnswer}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
          </>
        )}
      </div>
    </FormSheet>
  );
}
