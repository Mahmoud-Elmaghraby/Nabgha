import { useState, useEffect } from 'react';
import { useQuestions, useQuestionMutations } from '../hooks/useExams';
import { QuestionFormModal } from '../components/QuestionFormModal';
import { ImportQuestionsModal } from '../components/ImportQuestionsModal';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { usePermissions } from '@/shared/hooks/usePermissions';
import { useSubjects } from '@/features/subjects/hooks/useSubjects';
import { GRADE_OPTIONS } from '@nabgha/types';
import {
  QUESTION_TYPE_LABELS,
  DIFFICULTY_LABELS,
  DIFFICULTY_COLORS,
  type QuestionDto,
  type QuestionType,
  type Difficulty,
} from '../types/exam.types';

export function QuestionsBankPage() {
  const { hasPermission } = usePermissions();
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [diffFilter, setDiffFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 300);

  const { data: subjects = [] } = useSubjects();
  const { deleteQuestion } = useQuestionMutations();

  const [editingQuestion, setEditingQuestion] = useState<QuestionDto | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, gradeFilter, subjectFilter, typeFilter, diffFilter]);

  const { data, isLoading } = useQuestions({
    search: debouncedSearch || undefined,
    grade: gradeFilter || undefined,
    subjectId: subjectFilter || undefined,
    type: (typeFilter as QuestionType) || undefined,
    difficulty: (diffFilter as Difficulty) || undefined,
    page,
    limit: 20,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / 20)) : 1;

  const handleDelete = async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا السؤال من البنك؟')) {
      await deleteQuestion.mutateAsync(id);
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
              placeholder="بحث في الأسئلة أو التاجات..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm pr-9 focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20"
            />
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" />
            </svg>
          </div>

          {hasPermission('exams.create') && (
            <button
              onClick={() => setIsImporting(true)}
              className="flex items-center gap-1.5 px-4 py-2 border border-[#0E3B2E]/30 text-[#0E3B2E] text-sm font-medium rounded-lg hover:bg-[#0E3B2E]/5 transition-colors flex-shrink-0"
            >
              ⬆ استيراد أسئلة
            </button>
          )}

          {hasPermission('exams.create') && (
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#0E3B2E] text-white text-sm font-medium rounded-lg hover:bg-[#0E3B2E]/90 transition-colors flex-shrink-0"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              إضافة سؤال للبنك
            </button>
          )}
        </div>

        {/* فلاتر إضافية */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none"
          >
            <option value="">كل الأنواع</option>
            <option value="mcq">اختيار من متعدد</option>
            <option value="true_false">صح أو خطأ</option>
            <option value="fill">أكمل الفراغ</option>
            <option value="essay">مقالي</option>
          </select>

          <select
            value={diffFilter}
            onChange={e => setDiffFilter(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none"
          >
            <option value="">كل الصعوبات</option>
            <option value="easy">سهل</option>
            <option value="medium">متوسط</option>
            <option value="hard">صعب</option>
          </select>

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

      {/* قائمة الأسئلة */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">جاري تحميل الأسئلة...</div>
        ) : !data || data.data.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <p className="text-base font-semibold mb-1">بنك الأسئلة فارغ</p>
            <p className="text-xs text-gray-400">ابدأ بإضافة أسئلتك لتتمكن من إنشاء الامتحانات بسهولة وبنقرة واحدة</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {data.data.map(q => (
              <div key={q.id} className="p-4 hover:bg-gray-50/70 transition-colors flex items-start justify-between gap-4">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
                      {QUESTION_TYPE_LABELS[q.type]}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded border ${DIFFICULTY_COLORS[q.difficulty]}`}>
                      {DIFFICULTY_LABELS[q.difficulty]}
                    </span>
                    <span className="text-xs text-gray-400 font-medium">الدرجة: {q.defaultDegree}</span>
                    <span className="text-xs text-gray-400 font-medium">مرات الاستخدام: {q.timesUsed}</span>
                    {q.grade && (
                      <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">
                        {q.grade}
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-semibold text-gray-800 leading-relaxed">{q.questionText}</p>

                  {q.options && q.options.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {q.options.map((opt, i) => (
                        <span key={i} className={`text-xs px-2.5 py-1 rounded border ${opt === q.correctAnswer ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold' : 'bg-white border-gray-200 text-gray-600'}`}>
                          {opt} {opt === q.correctAnswer && '✓'}
                        </span>
                      ))}
                    </div>
                  )}

                  {q.correctAnswer && q.type !== 'mcq' && (
                    <p className="text-xs text-emerald-700 pt-0.5">
                      <strong>الإجابة:</strong> {q.correctAnswer}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {hasPermission('exams.edit') && (
                    <button
                      onClick={() => setEditingQuestion(q)}
                      className="p-1.5 text-gray-500 hover:text-[#0E3B2E] hover:bg-gray-100 rounded-lg transition-colors"
                      title="تعديل السؤال"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                  )}
                  {hasPermission('exams.delete') && (
                    <button
                      onClick={() => handleDelete(q.id)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="حذف السؤال"
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
            <span>إجمالي {data.total} سؤال</span>
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

      <QuestionFormModal
        open={isCreating || !!editingQuestion}
        question={editingQuestion}
        onClose={() => { setEditingQuestion(null); setIsCreating(false); }}
      />

      <ImportQuestionsModal open={isImporting} onClose={() => setIsImporting(false)} />
    </div>
  );
}
