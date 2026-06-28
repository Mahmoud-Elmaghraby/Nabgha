import { useState } from 'react';
import { useGroupStudents, useGroupMutations, useGroups } from '../hooks/useGroups';
import { useSubjects } from '@/features/subjects/hooks/useSubjects';
import { useStudents } from '@/features/students/hooks/useStudents';
import { FormSheet } from '@/shared/components';
import type { GroupDto, GroupStudentDto } from '../types/group.types';
import { useDebounce } from '@/shared/hooks/useDebounce';

interface Props {
  group: GroupDto | null;
  onClose: () => void;
}

function DiscountEditor({ student, groupId }: { student: GroupStudentDto; groupId: string }) {
  const { updateDiscount } = useGroupMutations();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(student.discount);

  const handleSave = () => {
    updateDiscount.mutate({ groupId, studentId: student.studentId, discount: value });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="number" min={0} value={value}
          onChange={e => setValue(Number(e.target.value))}
          className="w-20 border border-gray-200 rounded px-2 py-0.5 text-xs"
          autoFocus
        />
        <button onClick={handleSave} className="text-xs text-green-600 font-medium">✓</button>
        <button onClick={() => setEditing(false)} className="text-xs text-gray-400">✕</button>
      </div>
    );
  }

  return (
    <button onClick={() => setEditing(true)}
      className="text-xs text-gray-500 hover:text-[#0E3B2E] transition-colors">
      {student.discount > 0 ? `خصم: ${student.discount} ج.م` : 'بدون خصم'}
    </button>
  );
}

export function GroupStudentsDrawer({ group, onClose }: Props) {
  const [search, setSearch] = useState('');
  const [discount, setDiscount] = useState(0);
  const debouncedSearch = useDebounce(search, 300);

  const { data: enrolled = [], isLoading } = useGroupStudents(group?.id || '');
  const { data: subjects = [] } = useSubjects();
  const { addStudent, removeStudent } = useGroupMutations();

  const getGroupGrade = () => {
    if (!group?.subjectGradeId) return null;
    for (const item of subjects) {
      const grade = item.grades.find(g => g.id === group.subjectGradeId);
      if (grade) return grade.grade;
    }
    return null;
  };

  const groupGrade = getGroupGrade();
  const { data: allStudents } = useStudents({
    search: debouncedSearch || undefined,
    grade: groupGrade || undefined,
    limit: 20,
  });

  const enrolledIds = new Set(enrolled.map(s => s.studentId));

  // الطلاب المسجلين في مجموعات تانية بنفس المادة والصف
  const { data: siblingGroups = [] } = useGroups(
    group?.subjectGradeId ? { subjectGradeId: group.subjectGradeId } : undefined
  );
  const siblingGroupIds = (siblingGroups as any)?.data
    ?.filter((g: any) => g.id !== group?.id)
    ?.map((g: any) => g.id) || [];

  const { data: allSiblingStudents } = useGroupStudents(
    siblingGroupIds.length === 1 ? siblingGroupIds[0] : ''
  );
  const siblingStudentIds = new Set((allSiblingStudents || []).map((s: any) => s.studentId));

  const available = (allStudents?.data || []).filter(s => !enrolledIds.has(s.id));

  // الطلاب المتاحين بدون تعارض
  const safeAvailable = available.filter(s => !siblingStudentIds.has(s.id));
  // الطلاب اللي في مجموعة تانية بنفس المادة (هيظهر warning)
  const warnAvailable = available.filter(s => siblingStudentIds.has(s.id));

  const handleAdd = (studentId: string) => {
    if (!group) return;
    addStudent.mutate({ groupId: group.id, payload: { studentId, discount } },
      { onSuccess: () => { setSearch(''); setDiscount(0); } }
    );
  };

  const handleRemove = (studentId: string) => {
    if (!group || !confirm('هل تريد إزالة هذا الطالب من المجموعة؟')) return;
    removeStudent.mutate({ groupId: group.id, studentId });
  };

  return (
    <FormSheet
      open={!!group}
      onClose={onClose}
      title={`طلاب: ${group?.name || ''}`}
      subtitle={`${enrolled.length} / ${group?.maxStudents || 0} طالب`}
      size="lg"
    >
      <div className="space-y-5">

        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">الطلاب المسجلون</h3>
          {isLoading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : enrolled.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">لا يوجد طلاب في هذه المجموعة</p>
          ) : (
            <div className="space-y-2">
              {enrolled.map(s => (
                <div key={s.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{s.fullName}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">{s.parentPhone}</span>
                      {s.grade && <span className="text-xs text-gray-300">·</span>}
                      {s.grade && <span className="text-xs text-gray-400">{s.grade}</span>}
                    </div>
                    <DiscountEditor student={s} groupId={group?.id || ''} />
                  </div>
                  <button onClick={() => handleRemove(s.studentId)}
                    className="text-xs text-red-500 hover:text-red-700 px-2 py-1 hover:bg-red-50 rounded-lg transition-colors">
                    إزالة
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 pt-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">إضافة طالب</h3>

          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1">
              <label className="text-xs text-gray-400 mb-1 block">خصم الطالب (ج.م)</label>
              <input type="number" min={0} value={discount}
                onChange={e => setDiscount(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20"
                placeholder="0" />
            </div>
          </div>

          <div className="relative mb-3">
            <input type="text" placeholder="ابحث عن طالب..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm pr-9 focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20" />
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/>
            </svg>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {available.length === 0 && search ? (
              <p className="text-sm text-gray-400 text-center py-3">لا توجد نتائج</p>
            ) : (
              <>
                {safeAvailable.map(s => (
                  <div key={s.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-2.5">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{s.fullName}</div>
                      <div className="text-xs text-gray-400">{s.grade || 'بدون مرحلة'} — {s.parentPhone}</div>
                    </div>
                    <button onClick={() => handleAdd(s.id)} disabled={addStudent.isPending}
                      className="text-xs text-[#0E3B2E] hover:text-[#1F6B4E] px-2 py-1 hover:bg-[#0E3B2E]/10 rounded-lg transition-colors font-medium disabled:opacity-50">
                      {discount > 0 ? `إضافة (خصم ${discount})` : 'إضافة'}
                    </button>
                  </div>
                ))}

              </>
            )}
          </div>
        </div>
      </div>
    </FormSheet>
  );
}
