import { useAuthStore } from '../stores/auth.store';
import { UserRole } from '@nabgha/types';

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  tenant_admin: ['*'],
  accountant: ['payments.*', 'reports.*', 'financial.*'],
  receptionist: ['students.*', 'attendance.*', 'payments.view', 'payments.create'],
  teacher: ['students.view', 'groups.view', 'attendance.*', 'reports.view'],
  parent: ['students.view'],
};

export function usePermissions() {
  const user = useAuthStore((state) => state.user);

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;

    const permissions = ROLE_PERMISSIONS[user.role] || [];

    if (permissions.includes('*')) return true;

    if (permissions.includes(permission)) return true;

    const [resource, action] = permission.split('.');
    if (permissions.includes(`${resource}.*`)) return true;

    return false;
  };

  const hasRole = (role: UserRole): boolean => {
    return user?.role === role;
  };

  return { hasPermission, hasRole, role: user?.role };
}
