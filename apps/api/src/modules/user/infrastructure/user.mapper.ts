import { UserEntity, UserRole } from '../domain/entities/user.entity';

export interface UserRow {
  id: string;
  name: string;
  email: string | null;
  username: string;
  role: string;
  permissions: string[];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export class UserMapper {
  static toDomain(row: UserRow): UserEntity {
    return new UserEntity({
      id: row.id,
      name: row.name,
      email: row.email,
      username: row.username,
      role: row.role as UserRole,
      permissions: Array.isArray(row.permissions) ? row.permissions : [],
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    });
  }

  static toResponse(entity: UserEntity) {
    return {
      id: entity.id,
      name: entity.name,
      email: entity.email,
      username: entity.username,
      role: entity.role,
      permissions: entity.permissions,
      isActive: entity.isActive,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
