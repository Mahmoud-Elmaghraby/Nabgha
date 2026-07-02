import { useState } from 'react';
import { useDeleteUser } from '../hooks/useUserMutations';
import { useConfirm } from '@/shared/components/Confirm';
import type { UserDto } from '../types/user.types';
import { getAvatarColor } from './avatarColor';
import { getRoleLabel } from '@nabgha/types';
import { DataTable } from '@/shared/components';
import type { Column } from '@/shared/components';

const ROLE_COLORS: Record<string, string> = {
  tenant_admin: 'bg-purple-50 text-purple-700 ring-purple-600/10',
  teacher: 'bg-amber-50 text-amber-700 ring-amber-600/10',
  secretary: 'bg-blue-50 text-blue-700 ring-blue-600/10',
  parent: 'bg-gray-50 text-gray-700 ring-gray-600/10',
};

interface UsersListProps {
  users: UserDto[];
  onEdit: (user: UserDto) => void;
  isLoading?: boolean;
}

export function UsersList({ users, onEdit, isLoading }: UsersListProps) {
  const confirm = useConfirm();
  const { mutate: deleteUser } = useDeleteUser();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!(await confirm('هل أنت متأكد من حذف هذا المستخدم؟', { danger: true }))) return;
    setDeletingId(id);
    deleteUser(id, { onSettled: () => setDeletingId(null) });
  };

  const columns: Column<UserDto>[] = [
    {
      key: 'user',
      header: 'المستخدم',
      render: (user) => {
        const color = getAvatarColor(user.name);
        return (
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full ${color.bg} ${color.text} flex items-center justify-center font-bold text-sm shrink-0`}>
              {user.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-gray-900 text-sm truncate">{user.name}</div>
              {user.email && <div className="text-gray-400 text-xs truncate">{user.email}</div>}
            </div>
          </div>
        );
      },
    },
    {
      key: 'username',
      header: 'اسم المستخدم',
      hideOnMobile: true,
      render: (user) => (
        <span className="text-sm text-gray-600 font-mono bg-gray-50 px-2 py-0.5 rounded">
          {user.username}
        </span>
      ),
    },
    {
      key: 'role',
      header: 'الدور',
      render: (user) => (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ring-1 ring-inset ${ROLE_COLORS[user.role] ?? ROLE_COLORS.parent}`}>
          {getRoleLabel(user.role)}
        </span>
      ),
    },
    {
      key: 'permissions',
      header: 'الصلاحيات',
      hideOnMobile: true,
      render: (user) =>
        // tenant_admin عنده bypass كامل حتى لو permissions فاضية في الداتابيز — نفس منطق PermissionGuard
        user.role === 'tenant_admin' || user.permissions.includes('*') ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[#D4AB53]">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            كل الصلاحيات
          </span>
        ) : (
          <span className="text-sm text-gray-500">{user.permissions.length} صلاحية</span>
        ),
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (user) => (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${user.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${user.isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
          {user.isActive ? 'نشط' : 'معطل'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'الإجراءات',
      width: '100px',
      render: (user) => (
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(user); }}
            title="تعديل"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#0E3B2E] hover:bg-gray-100 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(user.id); }}
            disabled={deletingId === user.id}
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
      data={users}
      keyExtractor={(u) => u.id}
      isLoading={isLoading}
      emptyIcon="/Logo.png"
      emptyTitle="لا يوجد مستخدمون"
      emptySubtitle='اضغط "إضافة مستخدم" لإنشاء أول مستخدم'
    />
  );
}
