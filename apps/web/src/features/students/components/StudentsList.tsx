import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStudentMutations } from '../hooks/useStudents';
import { usePermissions } from '@/shared/hooks/usePermissions';
import { useConfirm } from '@/shared/components/Confirm';
import type { StudentDto } from '../types/student.types';
import { DataTable } from '@/shared/components';
import type { Column } from '@/shared/components';

interface Props {
  students: StudentDto[];
  onEdit: (student: StudentDto) => void;
  onViewQr: (student: StudentDto) => void;
  isLoading?: boolean;
  visibleKeys?: Set<string>;
}

export function StudentsList({ students, onEdit, onViewQr, isLoading, visibleKeys }: Props) {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const confirm = useConfirm();
  const { deleteStudent, toggleActive } = useStudentMutations();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!(await confirm('هل أنت متأكد من حذف هذا الطالب؟', { danger: true }))) return;
    setDeletingId(id);
    setDeleteError(null);
    deleteStudent.mutate(id, {
      onError: (err: any) => {
        setDeleteError(err?.response?.data?.error?.message || 'لا يمكن حذف الطالب');
        setTimeout(() => setDeleteError(null), 5000);
      },
      onSettled: () => setDeletingId(null),
    });
  };

  const columns: Column<StudentDto>[] = [
    {
      key: 'student',
      header: 'الطالب',
      render: s => (
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${s.isActive ? 'bg-[#0E3B2E]/10 text-[#0E3B2E]' : 'bg-gray-100 text-gray-400'}`}>
            {s.fullName.charAt(0)}
          </div>
          <div className="min-w-0">
            <div className={`font-semibold text-sm truncate ${s.isActive ? 'text-gray-900' : 'text-gray-400'}`}>
              {s.fullName}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'studentCode',
      header: 'الكود',
      render: s => (
        <span className="text-sm font-bold text-[#0E3B2E] tracking-widest font-mono">
          {s.studentCode || '—'}
        </span>
      ),
    },
    {
      key: 'grade',
      header: 'المرحلة الدراسية',
      render: s => s.grade
        ? <span className="text-sm text-gray-600">{s.grade}</span>
        : <span className="text-gray-300 text-sm">—</span>,
    },
    {
      key: 'parentPhone',
      header: 'هاتف ولي الأمر',
      render: s => <span className="text-sm text-gray-600 font-mono">{s.parentPhone}</span>,
    },
    {
      key: 'studentPhone',
      header: 'هاتف الطالب',
      render: s => s.studentPhone
        ? <span className="text-sm text-gray-600 font-mono">{s.studentPhone}</span>
        : <span className="text-gray-300 text-sm">—</span>,
    },
    {
      key: 'groupNames',
      header: 'المجموعات',
      render: s => {
        const list = s.groupNames ? s.groupNames.split(', ').filter(Boolean) : [];
        if (list.length === 0) return <span className="text-gray-300 text-sm">—</span>;
        if (list.length === 1) return <span className="text-sm text-gray-600">{list[0]}</span>;
        const label = list.length === 2 ? 'مجموعتين' : `${list.length} مجموعات`;
        return (
          <span
            title={list.join('\n')}
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 cursor-help"
          >
            {label}
          </span>
        );
      },
    },
    {
      key: 'school',
      header: 'المدرسة',
      render: s => s.school
        ? <span className="text-sm text-gray-600">{s.school}</span>
        : <span className="text-gray-300 text-sm">—</span>,
    },
    {
      key: 'dateOfBirth',
      header: 'تاريخ الميلاد',
      render: s => s.dateOfBirth
        ? <span className="text-sm text-gray-600">{new Date(s.dateOfBirth).toLocaleDateString('en-GB')}</span>
        : <span className="text-gray-300 text-sm">—</span>,
    },
    {
      key: 'address',
      header: 'العنوان',
      render: s => s.address
        ? <span className="text-sm text-gray-600">{s.address}</span>
        : <span className="text-gray-300 text-sm">—</span>,
    },
    {
      key: 'parentOccupation',
      header: 'وظيفة ولي الأمر',
      render: s => s.parentOccupation
        ? <span className="text-sm text-gray-600">{s.parentOccupation}</span>
        : <span className="text-gray-300 text-sm">—</span>,
    },
    {
      key: 'notes',
      header: 'ملاحظات',
      render: s => s.notes
        ? <span className="text-sm text-gray-600 truncate max-w-[200px] block">{s.notes}</span>
        : <span className="text-gray-300 text-sm">—</span>,
    },
    {
      key: 'isActive',
      header: 'الحالة',
      render: s => (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${s.isActive ? 'bg-emerald-500' : 'bg-gray-400'}`} />
          {s.isActive ? 'نشط' : 'معطل'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'الإجراءات',
      width: '140px',
      render: s => (
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={e => { e.stopPropagation(); onViewQr(s); }}
            title="كود QR"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/>
              <rect x="18" y="14" width="3" height="3"/><rect x="14" y="18" width="3" height="3"/>
              <rect x="18" y="18" width="3" height="3"/>
            </svg>
          </button>
          {hasPermission('students.edit') && (
            <button
              onClick={e => { e.stopPropagation(); toggleActive.mutate(s.id); }}
              title={s.isActive ? 'تعطيل' : 'تفعيل'}
              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                s.isActive
                  ? 'text-gray-400 hover:text-amber-600 hover:bg-amber-50'
                  : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'
              }`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {s.isActive
                  ? <path d="M18.36 6.64A9 9 0 0 1 20.77 15M6.16 6.16a9 9 0 1 0 12.68 12.68M2 2l20 20" strokeLinecap="round"/>
                  : <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round"/>
                }
              </svg>
            </button>
          )}
          {hasPermission('students.edit') && (
            <button
              onClick={e => { e.stopPropagation(); onEdit(s); }}
              title="تعديل"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#0E3B2E] hover:bg-gray-100 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          )}
          {hasPermission('students.delete') && (
            <button
              onClick={e => { e.stopPropagation(); handleDelete(s.id); }}
              disabled={deletingId === s.id}
              title="حذف"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          )}
        </div>
      ),
    },
  ];

  const filteredColumns = visibleKeys
    ? columns.filter(c => c.key === 'student' || c.key === 'actions' || visibleKeys.has(c.key))
    : columns;

  return (
    <div>
      {deleteError && (
        <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {deleteError}
        </div>
      )}
      <DataTable
        columns={filteredColumns}
        data={students}
        keyExtractor={s => s.id}
        isLoading={isLoading}
        onRowClick={s => navigate(`/students/${s.id}`)}
        emptyIcon="/Logo-icon-192.png"
        emptyTitle="لا يوجد طلاب"
        emptySubtitle='اضغط "إضافة طالب" لإضافة أول طالب'
      />
    </div>
  );
}
