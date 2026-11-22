import { useState, useEffect } from 'react';
import { useExam, useExamMutations, useQuestions } from '../hooks/useExams';
import { examsApi } from '../api/exams.api';
import { downloadBlob } from '@/shared/lib/downloadBlob';
import { FormSheet } from '@/shared/components/FormSheet';
import {
  QUESTION_TYPE_LABELS,
  DIFFICULTY_LABELS,
  DIFFICULTY_COLORS,
  type ExamItemDto,
  type QuestionDto,
  type SaveExamItemPayload,
} from '../types/exam.types';

interface Props {
  open:   boolean;
  onClose: () => void;
  examId: string | null;
}

export function ExamBuilderModal({ open, onClose, examId }: Props) {
  const { data: examData, isLoading: isLoadingExam } = useExam(examId || '');
  const { saveItems } = useExamMutations();

  // جلب أسئلة البنك لاختيار منها
  const [bankSearch, setBankSearch] = useState('');
  const [bankType, setBankType] = useState<string>('');
  const { data: bankData, isLoading: isLoadingBank } = useQuestions({
    search: bankSearch || undefined,
    type: (bankType as any) || undefined,
    subjectId: examData?.exam.subjectId || undefined,
    grade: examData?.exam.grade || undefined,
    limit: 50,
  });

  const [items, setItems] = useState<SaveExamItemPayload[]>([]);
  const [activeTab, setActiveTab] = useState<'current' | 'pick'>('current');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (examData?.items) {
      setItems(
        examData.items.map((it, idx) => ({
          questionId:   it.questionId,
          questionText: it.questionText,
          type:         it.type,
          options:      it.options,
          correctAnswer: it.correctAnswer,
          modelAnswer:  it.modelAnswer,
          imageUrl:     it.imageUrl,
          degree:       it.degree,
          sortOrder:    it.sortOrder ?? idx,
          sectionTitle: it.sectionTitle,
        }))
      );
    } else {
      setItems([]);
    }
  }, [examData]);

  // إضافة سؤال من البنك
  const handleAddFromBank = (q: QuestionDto) => {
    // التحقق من عدم التكرار
    if (items.some(i => i.questionId === q.id)) return;

    setItems(prev => [
      ...prev,
      {
        questionId:   q.id,
        questionText: q.questionText,
        type:         q.type,
        options:      q.options,
        correctAnswer: q.correctAnswer,
        modelAnswer:  q.modelAnswer,
        imageUrl:     q.imageUrl,
        degree:       q.defaultDegree,
        sortOrder:    prev.length,
        sectionTitle: null,
      },
    ]);
  };

  // حذف سؤال من الامتحان
  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index).map((item, idx) => ({ ...item, sortOrder: idx })));
  };

  // تعديل درجة السؤال
  const handleDegreeChange = (index: number, deg: number) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, degree: deg } : item));
  };

  // تحريك السؤال لأعلى أو لأسفل
  const handleMove = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === items.length - 1) return;
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    setItems(prev => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy.map((it, idx) => ({ ...it, sortOrder: idx }));
    });
  };

  // حفظ التغييرات
  const handleSave = async () => {
    if (!examId) return;
    await saveItems.mutateAsync({ examId, items });
    onClose();
  };

  // تصدير PDF مباشر
  const handleExportPdf = async (answerKey = false) => {
    if (!examId) return;
    setIsExporting(true);
    try {
      // حفظ الأسئلة أولاً لضمان أحدث نسخة
      await saveItems.mutateAsync({ examId, items });
      const blob = await examsApi.exportPdf(examId, answerKey);
      const base = examData?.exam.title || 'exam';
      downloadBlob(blob, answerKey ? `${base} - نموذج الإجابة.pdf` : `${base}.pdf`);
    } finally {
      setIsExporting(false);
    }
  };

  const totalDegrees = items.reduce((sum, it) => sum + (Number(it.degree) || 0), 0);

  return (
    <FormSheet
      open={open}
      onClose={onClose}
      title={`إعداد أسئلة: ${examData?.exam.title || ''}`}
      subtitle={`إجمالي الأسئلة: ${items.length} | المجموع: ${totalDegrees} درجة`}
      size="lg"
      footer={
        <div className="flex gap-2 justify-between items-center w-full">
          <button
            onClick={() => handleExportPdf(false)}
            disabled={isExporting || items.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors font-medium"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            {isExporting ? 'جاري التحميل...' : 'تصدير PDF'}
          </button>
          <button
            onClick={() => handleExportPdf(true)}
            disabled={isExporting || items.length === 0}
            className="px-3 py-2 text-sm bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-50 transition-colors font-medium"
          >
            ✓ نموذج الإجابة
          </button>

          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              إلغاء
            </button>
            <button
              onClick={handleSave}
              disabled={saveItems.isPending}
              className="px-5 py-2 text-sm bg-[#0E3B2E] text-white rounded-lg hover:bg-[#0E3B2E]/90 disabled:opacity-50 transition-colors font-medium"
            >
              {saveItems.isPending ? 'جاري الحفظ...' : 'حفظ الأسئلة'}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4" dir="rtl">
        {/* شريط التبويب */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('current')}
            className={`py-2 px-4 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'current'
                ? 'border-[#0E3B2E] text-[#0E3B2E]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            أسئلة الامتحان الحالية ({items.length})
          </button>
          <button
            onClick={() => setActiveTab('pick')}
            className={`py-2 px-4 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'pick'
                ? 'border-[#0E3B2E] text-[#0E3B2E]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            إضافة من بنك الأسئلة
          </button>
        </div>

        {/* التبويب الأول: الأسئلة الحالية */}
        {activeTab === 'current' && (
          <div className="space-y-3">
            {items.length === 0 ? (
              <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <p className="text-gray-500 text-sm mb-2">لا توجد أسئلة في هذا الامتحان حتى الآن</p>
                <button
                  onClick={() => setActiveTab('pick')}
                  className="px-3 py-1.5 text-xs bg-[#0E3B2E] text-white rounded-lg hover:bg-[#0E3B2E]/90 font-medium"
                >
                  اختر أسئلة من البنك
                </button>
              </div>
            ) : (
              items.map((item, index) => (
                <div
                  key={index}
                  className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl flex items-start gap-3 hover:border-gray-300 transition-colors"
                >
                  {/* أزرار الترتيب */}
                  <div className="flex flex-col gap-1 items-center">
                    <button
                      onClick={() => handleMove(index, 'up')}
                      disabled={index === 0}
                      className="p-1 text-gray-400 hover:text-[#0E3B2E] disabled:opacity-20"
                      title="تحريك لأعلى"
                    >
                      ▲
                    </button>
                    <span className="text-xs font-bold text-gray-500">{index + 1}</span>
                    <button
                      onClick={() => handleMove(index, 'down')}
                      disabled={index === items.length - 1}
                      className="p-1 text-gray-400 hover:text-[#0E3B2E] disabled:opacity-20"
                      title="تحريك لأسفل"
                    >
                      ▼
                    </button>
                  </div>

                  {/* نص السؤال والنوع */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 bg-white border border-gray-200 rounded text-gray-600 font-medium">
                        {QUESTION_TYPE_LABELS[item.type]}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-800 line-clamp-2">{item.questionText}</p>
                    {item.options && item.options.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {item.options.map((opt, oi) => (
                          <span key={oi} className="text-xs bg-white px-2 py-0.5 rounded border border-gray-200 text-gray-600">
                            {opt}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* درجة السؤال والزر الحذف */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0.5"
                        step="0.5"
                        value={item.degree}
                        onChange={e => handleDegreeChange(index, Number(e.target.value))}
                        className="w-14 px-2 py-1 text-xs border border-gray-200 rounded text-center bg-white focus:outline-none focus:ring-1 focus:ring-[#0E3B2E]"
                      />
                      <span className="text-xs text-gray-500">درجة</span>
                    </div>
                    <button
                      onClick={() => handleRemoveItem(index)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="إزالة السؤال"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* التبويب الثاني: اختيار من البنك */}
        {activeTab === 'pick' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="بحث في أسئلة البنك..."
                value={bankSearch}
                onChange={e => setBankSearch(e.target.value)}
                className="flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20"
              />
              <select
                value={bankType}
                onChange={e => setBankType(e.target.value)}
                className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20"
              >
                <option value="">كل الأنواع</option>
                <option value="mcq">اختيار من متعدد</option>
                <option value="true_false">صح أو خطأ</option>
                <option value="fill">أكمل الفراغ</option>
                <option value="essay">مقالي</option>
              </select>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-2">
              {isLoadingBank ? (
                <p className="text-center text-sm text-gray-400 py-6">جاري تحميل الأسئلة...</p>
              ) : bankData?.data.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-6">لا توجد أسئلة تطابق البحث</p>
              ) : (
                bankData?.data.map(q => {
                  const isAdded = items.some(i => i.questionId === q.id);
                  return (
                    <div
                      key={q.id}
                      className={`p-3 border rounded-xl flex items-center justify-between gap-3 transition-colors ${
                        isAdded ? 'bg-green-50/50 border-green-200' : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs px-2 py-0.5 bg-white border border-gray-200 rounded text-gray-600">
                            {QUESTION_TYPE_LABELS[q.type]}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded border ${DIFFICULTY_COLORS[q.difficulty]}`}>
                            {DIFFICULTY_LABELS[q.difficulty]}
                          </span>
                          <span className="text-xs text-gray-400">{q.defaultDegree} درجة</span>
                        </div>
                        <p className="text-sm font-semibold text-gray-800 line-clamp-1">{q.questionText}</p>
                      </div>

                      <button
                        onClick={() => handleAddFromBank(q)}
                        disabled={isAdded}
                        className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                          isAdded
                            ? 'bg-green-100 text-green-700 cursor-default'
                            : 'bg-[#0E3B2E] text-white hover:bg-[#0E3B2E]/90'
                        }`}
                      >
                        {isAdded ? 'تمت الإضافة ✓' : '+ إضافة للامتحان'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </FormSheet>
  );
}
