import { useState } from 'react';
import { useUsers } from '../hooks/useUsers';
import { UsersList } from '../components/UsersList';
import { UserFormModal } from '../components/UserFormModal';
import type { UserDto } from '../types/user.types';
import { PageHeader } from '@/shared/components';

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [editingUser, setEditingUser] = useState<UserDto | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { data, isLoading } = useUsers({ search, role: roleFilter });

  const handleEdit = (user: UserDto) => setEditingUser(user);
  const handleClose = () => { setEditingUser(null); setIsCreating(false); };

  return (
    <div className="min-h-screen" dir="rtl">
      <PageHeader
        title="المستخدمون"
        subtitle="إدارة مستخدمي المركز وصلاحياتهم"
        actions={[{
          label: 'إضافة مستخدم',
          onClick: () => setIsCreating(true),
          icon: (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          ),
        }]}
      />

      {/* Filters */}
      <div className="px-4 md:px-6 py-4 bg-white border-b border-gray-100">
        <div className="flex gap-3 max-w-2xl">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="بحث بالاسم أو اسم المستخدم..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20 focus:border-[#0E3B2E]"
            />
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" />
            </svg>
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20 focus:border-[#0E3B2E]"
          >
            <option value="">كل الأدوار</option>
            <option value="tenant_admin">مدير</option>
            <option value="teacher">مدرس</option>
            <option value="secretary">سكرتارية</option>
            <option value="parent">ولي أمر</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white md:mx-4 md:my-4 md:rounded-xl md:border md:border-gray-100 md:shadow-sm overflow-hidden">
        <UsersList
          users={data?.data || []}
          onEdit={handleEdit}
          isLoading={isLoading}
        />
        {data && data.total > 0 && (
          <div className="px-5 py-3 border-t border-gray-50 text-sm text-gray-400">
            إجمالي {data.total} مستخدم
          </div>
        )}
      </div>

      {/* Modal — always mounted so Radix Dialog open/close animation works correctly */}
      <UserFormModal
        open={isCreating || !!editingUser}
        user={editingUser ?? undefined}
        onClose={handleClose}
      />
    </div>
  );
}
