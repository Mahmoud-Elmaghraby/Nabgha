export interface UserDto {
  id: string;
  name: string;
  email: string | null;
  username: string;
  role: string;
  permissions: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserPayload {
  name: string;
  email?: string | null;
  username: string;
  password: string;
  role: string;
  permissions: string[];
}

export interface UpdateUserPayload {
  name?: string;
  email?: string | null;
  role?: string;
  permissions?: string[];
  isActive?: boolean;
}

export interface PaginatedUsers {
  data: UserDto[];
  total: number;
  page: number;
  limit: number;
}

export interface ListUsersParams {
  search?: string;
  role?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}
