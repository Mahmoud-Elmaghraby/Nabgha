import { useState } from 'react';
import { useDeleteTeacher } from '../hooks/useTeacherMutations';
import type { TeacherDto } from '../types/teacher.types';
import { DataTable } from '@/shared/components';
import type { Column } from '@/shared/components';

interface TeachersListProps {
  teachers: TeacherDto[];
  onEdit: (teacher: TeacherDto) => void;
  isLoading?: boolean;
}

export function TeachersList({ teachers, onEdit, isLoading }: TeachersListProps) {
  const { mutate: deleteTeacher } = useDeleteTeacher();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المدرس؟')) return;
    setDeletingId(id);
    deleteTeacher(id, { onSettled: () => setDeletingId(null) });
  };

  const columns: Column<TeacherDto>[] = [
    {
      key: 'teacher',
      header: 'المدرس',
      render: (t) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#0E3B2E]/10 text-[#0E3B2E] flex items-center justify-center font-bold text-sm shrink-0">
            {t.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-gray-900 text-sm truncate">{t.name}</div>
            {t.email && <div className="text-gray-400 text-xs truncate">{t.email}</div>}
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'رقم الهاتف',
      render: (t) =>
        t.phone ? (
          <span className="text-sm text-gray-600 font-mono">{t.phone}</span>
        ) : (
          <span className="text-gray-300 text-sm">—</span>
        ),
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (t) => (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${t.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${t.isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
          {t.isActive ? 'نشط' : 'غير نشط'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'الإجراءات',
      width: '100px',
      render: (t) => (
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(t); }}
            title="تعديل"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#0E3B2E] hover:bg-gray-100 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
            disabled={deletingId === t.id}
            title="حذف"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={teachers}
      keyExtractor={(t) => t.id}
      isLoading={isLoading}
      emptyIcon="/Logo.png"
      emptyTitle="لا يوجد مدرسون"
      emptySubtitle='اضغط "إضافة مدرس" لإضافة أول مدرس'
    />
  );
}
