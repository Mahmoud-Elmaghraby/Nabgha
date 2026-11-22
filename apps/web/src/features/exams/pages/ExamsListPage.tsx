import { useState, useEffect } from 'react';
import { useExams, useExamMutations } from '../hooks/useExams';
import { ExamFormModal } from '../components/ExamFormModal';
import { ExamBuilderModal } from '../components/ExamBuilderModal';
import { examsApi } from '../api/exams.api';
import { downloadBlob } from '@/shared/lib/downloadBlob';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { usePermissions } from '@/shared/hooks/usePermissions';
import { useSubjects } from '@/features/subjects/hooks/useSubjects';
import { GRADE_OPTIONS } from '@nabgha/types';
import type { ExamDto } from '../types/exam.types';

export function ExamsListPage() {
  const { hasPermission } = usePermissions();
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 300);

  const { data: subjects = [] } = useSubjects();
  const { deleteExam, generateExam } = useExamMutations();

  const [editingExam, setEditingExam] = useState<ExamDto | null>(null);
  const [builderExamId, setBuilderExamId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [autoTitle, setAutoTitle] = useState('');
  const [autoCount, setAutoCount] = useState(10);
  const [autoSubject, setAutoSubject] = useState('');
  const [autoGrade, setAutoGrade] = useState('');
  const [exportingId, setExportingId] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, gradeFilter, subjectFilter]);

  const { data, isLoading } = useExams({
    search: debouncedSearch || undefined,
    grade: gradeFilter || undefined,
    subjectId: subjectFilter || undefined,
    page,
    limit: 15,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / 15)) : 1;

  const handleDelete = async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا الامتحان؟')) {
      await deleteExam.mutateAsync(id);
    }
  };

  const handleExportPdf = async (exam: ExamDto, answerKey = false) => {
    setExportingId(answerKey ? `${exam.id}:key` : exam.id);
    try {
      const blob = await examsApi.exportPdf(exam.id, answerKey);
      downloadBlob(blob, answerKey ? `${exam.title} - نموذج الإجابة.pdf` : `${exam.title}.pdf`);
    } catch (err: any) {
      alert('حدث خطأ أثناء تصدير الامتحان، تأكد من وجود أسئلة في الامتحان أولاً.');
    } finally {
      setExportingId(null);
    }
  };

  const handleAutoGenerateSubmit = async () => {
    if (!autoTitle) {
      alert('يرجى كتابة عنوان للامتحان');
      return;
    }
    try {
      const res = await generateExam.mutateAsync({
        title: autoTitle,
        count: Number(autoCount),
        subjectId: autoSubject || null,
        grade: autoGrade || null,
      });
      setIsAutoGenerating(false);
      setAutoTitle('');
      // فتح الـ builder مباشرة لرؤية الامتحان والأسئلة المولدة
      setBuilderExamId(res.exam.id);
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'فشل التوليد التلقائي — تأكد من وجود أسئلة كافية في البنك.');
    }
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
                  onClick={() => setIsAutoGenerating(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors"
                >
                  ⚡ توليد تلقائي ذكي
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

      {/* مودال التوليد التلقائي */}
      {isAutoGenerating && (
        <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3">
          <h4 className="text-sm font-bold text-amber-900 flex items-center gap-2">
            ⚡ توليد امتحان تلقائي من بنك الأسئلة
          </h4>
          <p className="text-xs text-amber-700">
            سيقوم النظام باختيار أسئلة عشوائية من بنكك الخاص بحسب المادة والمرحلة المحددة.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <input
              type="text"
              placeholder="عنوان الامتحان *"
              value={autoTitle}
              onChange={e => setAutoTitle(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg"
            />
            <input
              type="number"
              min="1"
              max="50"
              placeholder="عدد الأسئلة"
              value={autoCount}
              onChange={e => setAutoCount(Number(e.target.value))}
              className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg"
            />
            <select
              value={autoSubject}
              onChange={e => setAutoSubject(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg"
            >
              <option value="">المادة (اختياري)</option>
              {subjects.map(s => <option key={s.subject.id} value={s.subject.id}>{s.subject.name}</option>)}
            </select>
            <select
              value={autoGrade}
              onChange={e => setAutoGrade(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg"
            >
              <option value="">المرحلة (اختياري)</option>
              {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsAutoGenerating(false)}
              className="px-3 py-1.5 text-xs border border-gray-200 bg-white rounded-lg hover:bg-gray-50"
            >
              إلغاء
            </button>
            <button
              onClick={handleAutoGenerateSubmit}
              disabled={generateExam.isPending}
              className="px-4 py-1.5 text-xs bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50"
            >
              {generateExam.isPending ? 'جاري التوليد...' : 'ابدأ التوليد'}
            </button>
          </div>
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
              <div key={exam.id} className="p-4 hover:bg-gray-50/70 transition-colors flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-gray-900">{exam.title}</h3>
                    {exam.grade && (
                      <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded font-medium">
                        {exam.grade}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>المجموع: <strong>{exam.totalDegree} درجة</strong></span>
                    {exam.durationMins && <span>المدة: {exam.durationMins} دقيقة</span>}
                    {exam.examDate && <span>التاريخ: {new Date(exam.examDate).toLocaleDateString('ar-EG')}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* زر منشئ الأسئلة */}
                  <button
                    onClick={() => setBuilderExamId(exam.id)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-[#0E3B2E]/10 text-[#0E3B2E] text-xs font-semibold rounded-lg hover:bg-[#0E3B2E]/20 transition-colors"
                  >
                    ✏️ تعديل الأسئلة
                  </button>

                  {/* زر تصدير PDF */}
                  {hasPermission('exams.export') && (
                    <button
                      onClick={() => handleExportPdf(exam)}
                      disabled={exportingId === exam.id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 text-xs font-semibold rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      {exportingId === exam.id ? 'جاري...' : 'طباعة PDF'}
                    </button>
                  )}

                  {/* زر نموذج الإجابة */}
                  {hasPermission('exams.export') && (
                    <button
                      onClick={() => handleExportPdf(exam, true)}
                      disabled={exportingId === `${exam.id}:key`}
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold rounded-lg hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                    >
                      ✓ {exportingId === `${exam.id}:key` ? 'جاري...' : 'نموذج الإجابة'}
                    </button>
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
    </div>
  );
}
