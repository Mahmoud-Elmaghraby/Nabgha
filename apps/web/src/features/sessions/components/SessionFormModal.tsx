import { useState } from 'react';
import { useGroups } from '@/features/groups/hooks/useGroups';
import { useSubjects } from '@/features/subjects/hooks/useSubjects';
import { GRADE_OPTIONS } from '@nabgha/types';
import { useSessionMutations } from '../hooks/useSessions';
import type { SessionType, CreateSessionPayload } from '../types/session.types';
import { SESSION_TYPE_LABELS } from '../types/session.types';

interface Props {
  open: boolean;
  onClose: () => void;
}

const TYPES_NEED_GROUP: SessionType[] = ['lesson', 'lesson_revision', 'lesson_exam', 'exam'];
const TYPES_NEED_GRADES: SessionType[] = ['lesson_revision', 'lesson_exam', 'exam', 'grade_exam'];

export function SessionFormModal({ open, onClose }: Props) {
  const { create } = useSessionMutations();
  const { data: groupsData } = useGroups({ limit: 1000 });
  const { data: subjects = [] } = useSubjects();

  const [type, setType] = useState<SessionType>('lesson');
  const [title, setTitle] = useState('');
  const [groupId, setGroupId] = useState('');
  const [grade, setGrade] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [outOf, setOutOf] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  if (!open) return null;

  const isGradeExam = type === 'grade_exam';
  const needsGroup = TYPES_NEED_GROUP.includes(type);
  const needsGrades = TYPES_NEED_GRADES.includes(type);
  const groups = groupsData?.data || [];

  const handleSubmit = async () => {
    setError('');
    if (!title.trim()) return setError('العنوان مطلوب');
    if (isGradeExam && (!grade || !subjectId || !endDate)) return setError('المرحلة والمادة وتاريخ الانتهاء مطلوبة');
    if (needsGroup && !groupId) return setError('المجموعة مطلوبة');

    const payload: CreateSessionPayload = {
      type, title: title.trim(),
      startDate,
      ...(isGradeExam ? { grade, subjectId, endDate } : { groupId }),
      ...(needsGrades && outOf ? { outOf: Number(outOf) } : {}),
      ...(startTime ? { startTime } : {}),
      ...(endTime ? { endTime } : {}),
      ...(notes ? { notes } : {}),
    };

    try {
      await create.mutateAsync(payload);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'حدث خطأ');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40" dir="rtl">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">حصة جديدة</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
            <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* نوع الحصة */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">نوع الحصة</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(SESSION_TYPE_LABELS) as [SessionType, string][]).map(([key, label]) => (
                <button key={key} onClick={() => setType(key)}
                  className={`py-2 px-3 rounded-xl text-sm border transition-all text-right ${
                    type === key
                      ? 'bg-[#0E3B2E] text-white border-[#0E3B2E]'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* العنوان */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">العنوان</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="مثال: حصة الأربعاء — الفصل الأول"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20" />
          </div>

          {/* المجموعة */}
          {needsGroup && (
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">المجموعة</label>
              <select value={groupId} onChange={e => setGroupId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20">
                <option value="">اختر مجموعة</option>
                {groups.filter(g => g.isActive).map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* grade_exam — المرحلة والمادة */}
          {isGradeExam && (
            <>
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">المرحلة الدراسية</label>
                <select value={grade} onChange={e => setGrade(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20">
                  <option value="">اختر المرحلة</option>
                  {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">المادة</label>
                <select value={subjectId} onChange={e => setSubjectId(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20">
                  <option value="">اختر المادة</option>
                  {subjects.map(s => <option key={s.subject.id} value={s.subject.id}>{s.subject.name}</option>)}
                </select>
              </div>
            </>
          )}

          {/* الدرجة القصوى */}
          {needsGrades && (
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">الدرجة من</label>
              <input type="number" min={1} value={outOf} onChange={e => setOutOf(e.target.value)}
                placeholder="مثال: 100"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20" />
            </div>
          )}

          {/* التواريخ */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">تاريخ البداية</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20" />
            </div>
            {isGradeExam && (
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">تاريخ الانتهاء</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20" />
              </div>
            )}
          </div>

          {/* الأوقات */}
          {!isGradeExam && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">وقت البداية</label>
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">وقت الانتهاء</label>
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20" />
              </div>
            </div>
          )}

          {/* ملاحظات */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">ملاحظات (اختياري)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20 resize-none" />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose}
              className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50">
              إلغاء
            </button>
            <button onClick={handleSubmit} disabled={create.isPending}
              className="flex-1 py-2.5 text-sm bg-[#0E3B2E] text-white rounded-xl hover:bg-[#1F6B4E] disabled:opacity-50">
              {create.isPending ? 'جاري...' : 'إنشاء'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
