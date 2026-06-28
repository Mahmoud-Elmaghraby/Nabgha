import { SetMetadata } from '@nestjs/common';
import { PERMISSION_KEY } from './permission.guard';
import { ROLES_KEY } from './roles.guard';

export const RequirePermission = (permission: string) =>
  SetMetadata(PERMISSION_KEY, permission);

export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
