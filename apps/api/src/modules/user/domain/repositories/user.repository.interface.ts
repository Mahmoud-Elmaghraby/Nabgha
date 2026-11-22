import { UserEntity } from '../entities/user.entity';

export interface CreateUserData {
  name: string;
  email: string | null;
  username: string;
  passwordHash: string;
  role: string;
  permissions: string[];
}

export interface UpdateUserData {
  name?: string;
  email?: string | null;
  role?: string;
  permissions?: string[];
  isActive?: boolean;
}

export interface ListUsersOptions {
  search?: string;
  role?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface PaginatedUsers {
  data: UserEntity[];
  total: number;
  page: number;
  limit: number;
}

export interface IUserRepository {
  findById(id: string, tenantId: string): Promise<UserEntity | null>;
  findByUsername(username: string, tenantId: string): Promise<UserEntity | null>;
  list(options: ListUsersOptions, tenantId: string): Promise<PaginatedUsers>;
  create(data: CreateUserData, tenantId: string): Promise<UserEntity>;
  update(id: string, data: UpdateUserData, tenantId: string): Promise<UserEntity>;
  delete(id: string, tenantId: string): Promise<void>;
  updatePassword(id: string, passwordHash: string, tenantId: string): Promise<void>;
}

export const USER_REPOSITORY = Symbol('IUserRepository');
