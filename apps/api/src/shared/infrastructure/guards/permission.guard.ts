import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hasPermission } from '../auth/permissions';

export const PERMISSION_KEY = 'permission';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermission = this.reflector.getAllAndOverride<string>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermission) return true;

    const { user } = context.switchToHttp().getRequest();

    // tenant_admin بيعدي كل الصلاحيات
    if (user?.role === 'tenant_admin') return true;

    const permissions: string[] = user?.permissions || [];

    if (!hasPermission(permissions, requiredPermission)) {
      throw new ForbiddenException('ليس لديك صلاحية لهذا الإجراء');
    }

    return true;
  }
}
