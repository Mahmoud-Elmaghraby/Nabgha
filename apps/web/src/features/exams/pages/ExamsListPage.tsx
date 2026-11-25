import { useState, useEffect } from 'react';
import { useExams, useExamMutations } from '../hooks/useExams';
import { ExamFormModal } from '../components/ExamFormModal';
import { ExamBuilderModal } from '../components/ExamBuilderModal';
import { SmartGenerateModal } from '../components/SmartGenerateModal';
import { PrintMenu } from '../components/PrintMenu';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { usePermissions } from '@/shared/hooks/usePermissions';
import { useSubjects } from '@/features/subjects/hooks/useSubjects';
import { GRADE_OPTIONS } from '@nabgha/types';
import type { ExamDto, ExamKind, GeneratedExam } from '../types/exam.types';

export function ExamsListPage() {
  const { hasPermission } = usePermissions();
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 300);

  const { data: subjects = [] } = useSubjects();
  const { deleteExam } = useExamMutations();
  const [kindFilter, setKindFilter] = useState<ExamKind | ''>('');

  const [editingExam, setEditingExam] = useState<ExamDto | null>(null);
  const [builderExamId, setBuilderExamId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [generateKind, setGenerateKind] = useState<ExamKind | null>(null);
  const [genNotice, setGenNotice] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, gradeFilter, subjectFilter, kindFilter]);

  const { data, isLoading } = useExams({
    search: debouncedSearch || undefined,
    grade: gradeFilter || undefined,
    subjectId: subjectFilter || undefined,
    kind: kindFilter || undefined,
    page,
    limit: 15,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / 15)) : 1;

  const handleDelete = async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا الامتحان؟')) {
      await deleteExam.mutateAsync(id);
    }
  };

  const handleGenerated = (res: GeneratedExam) => {
    setGenerateKind(null);
    const r = res.report;
    const parts: string[] = [`اتولّد ${r.picked} سؤال`];
    if (r.shortfalls.length) {
      parts.push(`ناقص ${r.requested - r.picked} لأن البنك مفيهوش كفاية (${r.shortfalls.map((s) => `صف ${s.row}: ${s.found} من ${s.requested}`).join('، ')})`);
    }
    if (r.recentlyUsed > 0) parts.push(`${r.recentlyUsed} سؤال منهم نزل في امتحان قريب`);
    setGenNotice(parts.join(' — '));
    setBuilderExamId(res.exam.id);
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* شريط الإجراءات والفلترة */}
      <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative flex-1 w-full">
            <input
              type="text"
              placeholder="بحث في الامتحانات..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm pr-9 focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20"
            />
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" />
            </svg>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
            {hasPermission('exams.create') && (
              <>
                <button
                  onClick={() => setGenerateKind('quiz')}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-sky-600 text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-sky-700 transition-colors"
                >
                  📝 تسميع سريع
                </button>
                <button
                  onClick={() => setGenerateKind('exam')}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors"
                >
                  ⚡ مولّد ذكي
                </button>
                <button
                  onClick={() => setIsCreating(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-[#0E3B2E] text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-[#0E3B2E]/90 transition-colors"
                >
                  + إنشاء امتحان جديد
                </button>
              </>
            )}
          </div>
        </div>

        {/* فلاتر */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
          {([['', 'الكل'], ['exam', 'امتحانات'], ['quiz', 'تسميعات']] as Array<[ExamKind | '', string]>).map(([k, label]) => (
            <button key={k || 'all'} onClick={() => setKindFilter(k)}
              className={`px-3 py-1 text-xs rounded-md font-medium ${kindFilter === k ? 'bg-white shadow text-[#0E3B2E]' : 'text-gray-500'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:w-1/2">
          <select
            value={subjectFilter}
            onChange={e => setSubjectFilter(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none"
          >
            <option value="">كل المواد</option>
            {subjects.map(s => <option key={s.subject.id} value={s.subject.id}>{s.subject.name}</option>)}
          </select>

          <select
            value={gradeFilter}
            onChange={e => setGradeFilter(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none"
          >
            <option value="">كل المراحل</option>
            {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>

      {genNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start justify-between gap-3">
          <span>⚡ {genNotice}</span>
          <button onClick={() => setGenNotice(null)} className="text-emerald-600">✕</button>
        </div>
      )}

      {/* قائمة الامتحانات */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">جاري تحميل الامتحانات...</div>
        ) : !data || data.data.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <p className="text-base font-semibold mb-1">لا توجد امتحانات حتى الآن</p>
            <p className="text-xs text-gray-400">أنشئ أول امتحان لك يدوياً أو استخدم التوليد التلقائي من بنك الأسئلة</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {data.data.map(exam => (
              <div key={exam.id} className="p-4 hover:bg-gray-50/70 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-gray-900">{exam.title}</h3>
                    {exam.kind === 'quiz' && (
                      <span className="text-xs px-2 py-0.5 bg-sky-50 text-sky-700 rounded font-medium">تسميع</span>
                    )}
                    {exam.grade && (
                      <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded font-medium">
                        {exam.grade}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
                    <span>المجموع: <strong>{exam.totalDegree} درجة</strong></span>
                    {exam.durationMins && <span>المدة: {exam.durationMins} دقيقة</span>}
                    {exam.examDate && <span>التاريخ: {new Date(exam.examDate).toLocaleDateString('ar-EG')}</span>}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0">
                  {/* زر منشئ الأسئلة */}
                  <button
                    onClick={() => setBuilderExamId(exam.id)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-[#0E3B2E]/10 text-[#0E3B2E] text-xs font-semibold rounded-lg hover:bg-[#0E3B2E]/20 transition-colors"
                  >
                    ✏️ تعديل الأسئلة
                  </button>

                  {/* طباعة: الورقة + نموذج الإجابة + نماذج أ/ب/ج/د */}
                  {hasPermission('exams.export') && (
                    <PrintMenu examId={exam.id} title={exam.title} disabled={exam.totalDegree <= 0} compact />
                  )}

                  {/* زر تعديل الإعدادات */}
                  {hasPermission('exams.edit') && (
                    <button
                      onClick={() => setEditingExam(exam)}
                      className="p-1.5 text-gray-500 hover:text-[#0E3B2E] hover:bg-gray-100 rounded-lg transition-colors"
                      title="إعدادات الامتحان"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                      </svg>
                    </button>
                  )}

                  {/* حذف */}
                  {hasPermission('exams.delete') && (
                    <button
                      onClick={() => handleDelete(exam.id)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="حذف الامتحان"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {data && data.total > 0 && totalPages > 1 && (
          <div className="p-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>إجمالي {data.total} امتحان</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-2.5 py-1 border border-gray-200 rounded disabled:opacity-40"
              >
                السابق
              </button>
              <span>{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-2.5 py-1 border border-gray-200 rounded disabled:opacity-40"
              >
                التالي
              </button>
            </div>
          </div>
        )}
      </div>

      <ExamFormModal
        open={isCreating || !!editingExam}
        exam={editingExam}
        onClose={() => { setEditingExam(null); setIsCreating(false); }}
      />

      <ExamBuilderModal
        open={!!builderExamId}
        examId={builderExamId}
        onClose={() => setBuilderExamId(null)}
      />

      <SmartGenerateModal
        open={generateKind !== null}
        initialKind={generateKind ?? 'exam'}
        onClose={() => setGenerateKind(null)}
        onGenerated={handleGenerated}
      />
    </div>
  );
}
