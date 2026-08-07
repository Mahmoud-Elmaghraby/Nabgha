import { useAuthStore } from '../stores/auth.store';
import { UserRole, hasPermission as checkPermission } from '@nabgha/types';

export function usePermissions() {
  const user = useAuthStore((state) => state.user);

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    // tenant_admin عنده bypass تلقائي — نفس منطق PermissionGuard في الـ backend
    if (user.role === 'tenant_admin') return true;
    return checkPermission(user.permissions || [], permission);
  };

  const hasRole = (role: UserRole): boolean => {
    return user?.role === role;
  };

  return { hasPermission, hasRole, role: user?.role };
}
