import { useState } from 'react';
import { useGroupMutations } from '../hooks/useGroups';
import { useSubjects } from '@/features/subjects/hooks/useSubjects';
import type { GroupDto } from '../types/group.types';
import { DAY_LABELS } from '../types/group.types';
import { DataTable } from '@/shared/components';
import type { Column } from '@/shared/components';

interface Props {
  groups: GroupDto[];
  onEdit: (group: GroupDto) => void;
  onViewStudents: (group: GroupDto) => void;
  isLoading?: boolean;
}

export function GroupsList({ groups, onEdit, onViewStudents, isLoading }: Props) {
  const { deleteGroup } = useGroupMutations();
  const { data: subjects = [] } = useSubjects();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const getGradeLabel = (subjectGradeId: string | null) => {
    if (!subjectGradeId) return null;
    for (const item of subjects) {
      const grade = item.grades.find(g => g.id === subjectGradeId);
      if (grade) return `${item.subject.name} — ${grade.grade}`;
    }
    return null;
  };

  const handleDelete = (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه المجموعة؟')) return;
    setDeletingId(id);
    deleteGroup.mutate(id, { onSettled: () => setDeletingId(null) });
  };

  const columns: Column<GroupDto>[] = [
    {
      key: 'group',
      header: 'المجموعة',
      render: g => (
        <div>
          <div className="font-semibold text-gray-900 text-sm">{g.name}</div>
          {g.subjectGradeId && (
            <div className="text-gray-400 text-xs mt-0.5">
              {getGradeLabel(g.subjectGradeId) || '—'}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'schedule',
      header: 'المواعيد',
      hideOnMobile: true,
      render: g =>
        g.schedule.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {g.schedule.map(s => (
              <span key={s.day} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#0E3B2E]/10 text-[#0E3B2E] text-xs rounded-md font-medium">
                {DAY_LABELS[s.day]} {s.startTime}
              </span>
            ))}
          </div>
        ) : <span className="text-gray-300 text-sm">—</span>,
    },
    {
      key: 'students',
      header: 'الطلاب',
      render: g => (
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-gray-800">{g.studentCount ?? 0}</span>
          <span className="text-gray-400 text-xs">/ {g.maxStudents}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      render: g => (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${g.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${g.isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
          {g.isActive ? 'نشطة' : 'معطلة'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'الإجراءات',
      width: '130px',
      render: g => (
        <div className="flex items-center justify-center gap-1">
          <button onClick={e => { e.stopPropagation(); onViewStudents(g); }}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="الطلاب">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </button>
          <button onClick={e => { e.stopPropagation(); onEdit(g); }}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#0E3B2E] hover:bg-gray-100 transition-colors" title="تعديل">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button onClick={e => { e.stopPropagation(); handleDelete(g.id); }}
            disabled={deletingId === g.id}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="حذف">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={groups}
      keyExtractor={g => g.id}
      isLoading={isLoading}
      emptyIcon="/Logo.png"
      emptyTitle="لا توجد مجموعات"
      emptySubtitle='اضغط "إضافة مجموعة" لإنشاء أول مجموعة'
    />
  );
}
