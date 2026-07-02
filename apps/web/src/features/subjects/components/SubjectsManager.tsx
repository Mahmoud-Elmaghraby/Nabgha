import { useState } from 'react';
import { useSubjects, useSubjectMutations } from '../hooks/useSubjects';
import { SubjectGradeForm } from './SubjectGradeForm';
import { FormSheet } from '@/shared/components';
import { useConfirm } from '@/shared/components/Confirm';
import type { SubjectWithGradesDto, SubjectGradeDto } from '../types/subject.types';
import { SUBJECT_COLORS, PAYMENT_TYPE_LABELS } from '../types/subject.types';

interface SubjectFormProps {
  subject?: SubjectWithGradesDto;
  onClose: () => void;
}

function SubjectForm({ subject, onClose }: SubjectFormProps) {
  const { createSubject, updateSubject } = useSubjectMutations();
  const [name, setName] = useState(subject?.subject.name ?? '');
  const [color, setColor] = useState(subject?.subject.color ?? '#0E3B2E');
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) return setError('اسم المادة مطلوب');
    setError('');
    if (subject) {
      await updateSubject.mutateAsync({ id: subject.subject.id, data: { name, color } });
    } else {
      await createSubject.mutateAsync({ name, color });
    }
    onClose();
  };

  const isPending = createSubject.isPending || updateSubject.isPending;

  return (
    <FormSheet
      open
      onClose={onClose}
      title={subject ? 'تعديل مادة' : 'إضافة مادة جديدة'}
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
          <label className="text-xs text-gray-500 mb-1 block">اسم المادة *</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="مثال: الرياضيات"
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20"
          />
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-2 block">اللون</label>
          <div className="flex flex-wrap gap-2">
            {SUBJECT_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full border-2 transition-all ${
                  color === c ? 'border-gray-800 scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      </div>
    </FormSheet>
  );
}

interface GradeRowProps {
  subjectId: string;
  subjectName: string;
  grade: SubjectGradeDto;
}

function GradeRow({ subjectId, subjectName, grade }: GradeRowProps) {
  const confirm = useConfirm();
  const { deleteGrade, updateGrade } = useSubjectMutations();
  const [editing, setEditing] = useState(false);

  const handleDelete = async () => {
    if (!(await confirm(`حذف صف "${grade.grade}"؟`, { danger: true }))) return;
    deleteGrade.mutate({ subjectId, gradeId: grade.id });
  };

  const handleToggle = () => {
    updateGrade.mutate({ subjectId, gradeId: grade.id, data: { isActive: !grade.isActive } });
  };

  return (
    <>
      <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${grade.isActive ? 'bg-white border-gray-100' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-800">{grade.grade}</span>
            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
              {PAYMENT_TYPE_LABELS[grade.paymentType]}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-[#0E3B2E] font-medium">{grade.fee} ج.م</span>
            <span className="text-xs text-gray-400">{grade.sessionDuration} دقيقة</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleToggle}
            className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs transition-colors ${
              grade.isActive ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'
            }`}
            title={grade.isActive ? 'إيقاف' : 'تفعيل'}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {grade.isActive
                ? <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round"/>
                : <circle cx="12" cy="12" r="10"/>
              }
            </svg>
          </button>
          <button
            onClick={() => setEditing(true)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#0E3B2E] hover:bg-gray-100 transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button
            onClick={handleDelete}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>
      {editing && (
        <SubjectGradeForm
          subjectId={subjectId}
          subjectName={subjectName}
          grade={grade}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}

interface SubjectCardProps {
  item: SubjectWithGradesDto;
}

function SubjectCard({ item }: SubjectCardProps) {
  const confirm = useConfirm();
  const { deleteSubject } = useSubjectMutations();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [addingGrade, setAddingGrade] = useState(false);

  const handleDelete = async () => {
    if (!(await confirm(`حذف مادة "${item.subject.name}"؟`, { danger: true }))) return;
    deleteSubject.mutate(item.subject.id);
  };

  return (
    <>
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center gap-3 p-3 bg-white">
          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.subject.color }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">{item.subject.name}</p>
            <p className="text-xs text-gray-400">
              {item.grades.filter(g => g.isActive).length} صف نشط
              {item.grades.length > 0 && ` من ${item.grades.length}`}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setAddingGrade(true)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-[#0E3B2E] border border-[#0E3B2E]/20 rounded-lg hover:bg-[#0E3B2E]/5 transition-colors"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
              </svg>
              صف
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className={`w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-all ${expanded ? 'rotate-180' : ''}`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button
              onClick={() => setEditing(true)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#0E3B2E] hover:bg-gray-100 transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button
              onClick={handleDelete}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>

        {expanded && (
          <div className="border-t border-gray-100 bg-gray-50 p-3 space-y-2">
            {item.grades.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-2">
                لا توجد صفوف — اضغط "+ صف" لإضافة صف وسعر
              </p>
            ) : (
              item.grades.map(grade => (
                <GradeRow
                  key={grade.id}
                  subjectId={item.subject.id}
                  subjectName={item.subject.name}
                  grade={grade}
                />
              ))
            )}
          </div>
        )}
      </div>

      {editing && <SubjectForm subject={item} onClose={() => setEditing(false)} />}
      {addingGrade && (
        <SubjectGradeForm
          subjectId={item.subject.id}
          subjectName={item.subject.name}
          onClose={() => setAddingGrade(false)}
        />
      )}
    </>
  );
}

export function SubjectsManager() {
  const { data: subjects, isLoading } = useSubjects();
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{subjects?.length ?? 0} مادة</p>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#0E3B2E] text-white rounded-lg hover:bg-[#1F6B4E]"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
          </svg>
          إضافة مادة
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : subjects?.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <p className="text-sm">لا توجد مواد بعد</p>
          <p className="text-xs mt-1">اضغط "إضافة مادة" للبدء</p>
        </div>
      ) : (
        <div className="space-y-2">
          {subjects?.map(item => (
            <SubjectCard key={item.subject.id} item={item} />
          ))}
        </div>
      )}

      {showForm && <SubjectForm onClose={() => setShowForm(false)} />}
    </div>
  );
}
