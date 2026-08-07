import { useState, useEffect } from 'react';
import { useStudents } from '../hooks/useStudents';
import { StudentsList } from '../components/StudentsList';
import { StudentFormModal } from '../components/StudentFormModal';
import { StudentQrModal } from '../components/StudentQrModal';
import type { StudentDto } from '../types/student.types';
import { PageHeader } from '@/shared/components';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { usePermissions } from '@/shared/hooks/usePermissions';
import { GRADE_OPTIONS } from '@nabgha/types';
import { studentsApi } from '../api/students.api';
import { downloadBlob } from '@/shared/lib/downloadBlob';
import { useVisibleColumns } from '@/shared/hooks/useVisibleColumns';
import { ColumnPicker } from '@/shared/components/ColumnPicker';
import { ExportDropdown } from '@/shared/components/ExportDropdown';
import { useSubjects } from '@/features/subjects/hooks/useSubjects';

const OPTIONAL_COLUMNS = [
  { key: 'studentCode', header: 'الكود' },
  { key: 'parentPhone', header: 'هاتف ولي الأمر' },
  { key: 'studentPhone', header: 'هاتف الطالب' },
  { key: 'groupNames', header: 'المجموعات' },
  { key: 'grade', header: 'المرحلة الدراسية' },
  { key: 'school', header: 'المدرسة' },
  { key: 'dateOfBirth', header: 'تاريخ الميلاد' },
  { key: 'address', header: 'العنوان' },
  { key: 'parentOccupation', header: 'وظيفة ولي الأمر' },
  { key: 'notes', header: 'ملاحظات' },
  { key: 'isActive', header: 'الحالة' },
];
const DEFAULT_VISIBLE = OPTIONAL_COLUMNS.map(c => c.key);

const PAGE_SIZE = 30;

export default function StudentsPage() {
  const { hasPermission } = usePermissions();
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const { data: subjects = [] } = useSubjects();
  const [page, setPage] = useState(1);
  const [editingStudent, setEditingStudent] = useState<StudentDto | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [qrStudent, setQrStudent] = useState<StudentDto | null>(null);

  // Reset page when search or filter changes
  useEffect(() => { setPage(1); }, [debouncedSearch, gradeFilter, subjectFilter]);

  const { data, isLoading } = useStudents({
    search: debouncedSearch || undefined,
    grade: gradeFilter || undefined,
    subjectId: subjectFilter || undefined,
    page,
    limit: PAGE_SIZE,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const handleClose = () => { setEditingStudent(null); setIsCreating(false); };

  const { visible: visibleKeys, toggle: toggleColumn, save: saveColumns } = useVisibleColumns('students', DEFAULT_VISIBLE);

  const [isExporting, setIsExporting] = useState(false);
  const handleExport = async (format: 'xlsx' | 'pdf') => {
    setIsExporting(true);
    try {
      const blob = await studentsApi.export(format, {
        search: debouncedSearch || undefined,
        grade: gradeFilter || undefined,
        subjectId: subjectFilter || undefined,
        columns: Array.from(visibleKeys).join(','),
      } as any);
      downloadBlob(blob, `students-${Date.now()}.${format}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen" dir="rtl">
      <div className="flex items-center justify-between px-4 md:px-6 pt-3 bg-white">
        <div />
        <div className="flex items-center gap-2">
          <ExportDropdown onExport={handleExport} isExporting={isExporting} />
          <ColumnPicker options={OPTIONAL_COLUMNS} visible={visibleKeys} onToggle={toggleColumn} onSave={saveColumns} />
        </div>
      </div>
      <PageHeader
        title="الطلاب"
        subtitle="إدارة طلاب المركز"
        actions={[
          ...(hasPermission('students.create') ? [{
            label: 'إضافة طالب',
            onClick: () => setIsCreating(true),
            icon: (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
            ),
          }] : []),
        ]}
      />

      <div className="px-4 md:px-6 py-4 bg-white border-b border-gray-100">
        <div className="flex gap-3 max-w-2xl">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="بحث بالاسم أو رقم الهاتف..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20 focus:border-[#0E3B2E]"
            />
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/>
            </svg>
          </div>
          <select
            value={gradeFilter}
            onChange={e => setGradeFilter(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20 focus:border-[#0E3B2E]"
          >
            <option value="">كل المراحل</option>
            {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select
            value={subjectFilter}
            onChange={e => setSubjectFilter(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20 focus:border-[#0E3B2E]"
          >
            <option value="">كل المواد</option>
            <option value="none">بدون مجموعة</option>
            {subjects.map(s => <option key={s.subject.id} value={s.subject.id}>{s.subject.name}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white md:mx-4 md:my-4 md:rounded-xl md:border md:border-gray-100 md:shadow-sm overflow-hidden">
        <StudentsList
          students={data?.data || []}
          onEdit={setEditingStudent}
          onViewQr={setQrStudent}
          isLoading={isLoading}
          visibleKeys={visibleKeys}
        />
        {data && data.total > 0 && (
          <div className="px-5 py-4 border-t border-gray-50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-sm text-gray-400">
              إجمالي {data.total} طالب
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))} 
                  disabled={page <= 1}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  السابق
                </button>
                <span className="text-sm text-gray-500 font-medium">
                  {page} / {totalPages}
                </span>
                <button 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  التالي
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <StudentFormModal
        open={isCreating || !!editingStudent}
        student={editingStudent}
        onClose={handleClose}
      />

      <StudentQrModal
        student={qrStudent}
        onClose={() => setQrStudent(null)}
      />
    </div>
  );
}
