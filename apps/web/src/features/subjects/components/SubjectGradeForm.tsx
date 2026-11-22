import { useState } from 'react';
import { FormSheet } from '@/shared/components';
import type { SubjectGradeDto, CreateSubjectGradePayload, PaymentType } from '../types/subject.types';
import { GRADE_OPTIONS, PAYMENT_TYPE_LABELS } from '../types/subject.types';
import { useSubjectMutations } from '../hooks/useSubjects';

interface Props {
  subjectId: string;
  subjectName: string;
  grade?: SubjectGradeDto;
  onClose: () => void;
}

export function SubjectGradeForm({ subjectId, subjectName, grade, onClose }: Props) {
  const { addGrade, updateGrade } = useSubjectMutations();
  const [form, setForm] = useState<CreateSubjectGradePayload>({
    grade: grade?.grade ?? '',
    fee: grade?.fee ?? 0,
    paymentType: grade?.paymentType ?? 'monthly',
    sessionDuration: grade?.sessionDuration ?? 60,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.grade) e.grade = 'الصف مطلوب';
    if (form.fee < 0) e.fee = 'السعر لا يمكن أن يكون سالباً';
    if (form.sessionDuration < 15) e.sessionDuration = 'أقل مدة 15 دقيقة';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    if (grade) {
      await updateGrade.mutateAsync({ subjectId, gradeId: grade.id, data: form });
    } else {
      await addGrade.mutateAsync({ subjectId, data: form });
    }
    onClose();
  };

  const isPending = addGrade.isPending || updateGrade.isPending;

  return (
    <FormSheet
      open
      onClose={onClose}
      title={grade ? 'تعديل الصف' : `إضافة صف — ${subjectName}`}
      footer={
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
            إلغاء
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="flex-1 py-2 text-sm bg-[#0E3B2E] text-white rounded-lg hover:bg-[#1F6B4E] disabled:opacity-50"
          >
            {isPending ? 'جاري الحفظ...' : 'حفظ'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">الصف الدراسي *</label>
          <select
            value={form.grade}
            onChange={e => setForm(f => ({ ...f, grade: e.target.value }))}
            disabled={!!grade}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20 disabled:opacity-60"
          >
            <option value="">اختر الصف</option>
            {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          {errors.grade && <p className="text-xs text-red-500 mt-1">{errors.grade}</p>}
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">نوع الدفع *</label>
          <div className="grid grid-cols-3 gap-2">
            {(Object.entries(PAYMENT_TYPE_LABELS) as [PaymentType, string][]).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setForm(f => ({ ...f, paymentType: value }))}
                className={`py-2 text-sm rounded-lg border transition-colors ${
                  form.paymentType === value
                    ? 'bg-[#0E3B2E] text-white border-[#0E3B2E]'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-[#0E3B2E]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">
            السعر *
            <span className="text-gray-400 mr-1">
              ({form.paymentType === 'monthly' ? 'شهرياً' : form.paymentType === 'per_session' ? 'لكل حصة' : 'لكل ترم'})
            </span>
          </label>
          <div className="relative">
            <input
              type="number"
              min="0"
              value={form.fee}
              onChange={e => setForm(f => ({ ...f, fee: Number(e.target.value) }))}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">ج.م</span>
          </div>
          {errors.fee && <p className="text-xs text-red-500 mt-1">{errors.fee}</p>}
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">مدة الحصة (بالدقيقة) *</label>
          <input
            type="number"
            min="15"
            max="480"
            step="15"
            value={form.sessionDuration}
            onChange={e => setForm(f => ({ ...f, sessionDuration: Number(e.target.value) }))}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20"
          />
          {errors.sessionDuration && <p className="text-xs text-red-500 mt-1">{errors.sessionDuration}</p>}
        </div>
      </div>
    </FormSheet>
  );
}
