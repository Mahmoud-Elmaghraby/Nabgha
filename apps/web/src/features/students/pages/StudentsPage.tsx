import { useState } from 'react';
import { useStudents } from '../hooks/useStudents';
import { StudentsList } from '../components/StudentsList';
import { StudentFormModal } from '../components/StudentFormModal';
import { StudentQrModal } from '../components/StudentQrModal';
import type { StudentDto } from '../types/student.types';
import { PageHeader } from '@/shared/components';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { GRADE_OPTIONS } from '@nabgha/types';

export default function StudentsPage() {
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [editingStudent, setEditingStudent] = useState<StudentDto | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [qrStudent, setQrStudent] = useState<StudentDto | null>(null);

  const { data, isLoading } = useStudents({
    search: debouncedSearch || undefined,
    grade: gradeFilter || undefined,
  });

  const handleClose = () => { setEditingStudent(null); setIsCreating(false); };

  return (
    <div className="min-h-screen" dir="rtl">
      <PageHeader
        title="الطلاب"
        subtitle="إدارة طلاب المركز"
        actions={[{
          label: 'إضافة طالب',
          onClick: () => setIsCreating(true),
          icon: (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          ),
        }]}
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
        </div>
      </div>

      <div className="bg-white md:mx-4 md:my-4 md:rounded-xl md:border md:border-gray-100 md:shadow-sm overflow-hidden">
        <StudentsList
          students={data?.data || []}
          onEdit={setEditingStudent}
          onViewQr={setQrStudent}
          isLoading={isLoading}
        />
        {data && data.total > 0 && (
          <div className="px-5 py-3 border-t border-gray-50 text-sm text-gray-400">
            إجمالي {data.total} طالب
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
