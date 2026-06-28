import { useState } from 'react';
import { useTeachers } from '../hooks/useTeachers';
import { TeachersList } from '../components/TeachersList';
import { TeacherFormModal } from '../components/TeacherFormModal';
import type { TeacherDto } from '../types/teacher.types';
import { PageHeader } from '@/shared/components';
import { useDebounce } from '@/shared/hooks/useDebounce';

export default function TeachersPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [editingTeacher, setEditingTeacher] = useState<TeacherDto | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { data = [], isLoading } = useTeachers(debouncedSearch || undefined);

  const handleClose = () => { setEditingTeacher(null); setIsCreating(false); };

  return (
    <div className="min-h-screen" dir="rtl">
      <PageHeader
        title="المدرسون"
        subtitle="إدارة مدرسي المركز"
        actions={[{
          label: 'إضافة مدرس',
          onClick: () => setIsCreating(true),
          icon: (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          ),
        }]}
      />

      <div className="px-4 md:px-6 py-4 bg-white border-b border-gray-100">
        <div className="relative max-w-sm">
          <input
            type="text"
            placeholder="بحث بالاسم أو الهاتف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20 focus:border-[#0E3B2E]"
          />
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      <div className="bg-white md:mx-4 md:my-4 md:rounded-xl md:border md:border-gray-100 md:shadow-sm overflow-hidden">
        <TeachersList teachers={data} onEdit={setEditingTeacher} isLoading={isLoading} />
        {data.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-50 text-sm text-gray-400">
            إجمالي {data.length} مدرس
          </div>
        )}
      </div>

      <TeacherFormModal
        open={isCreating || !!editingTeacher}
        teacher={editingTeacher}
        onClose={handleClose}
      />
    </div>
  );
}
