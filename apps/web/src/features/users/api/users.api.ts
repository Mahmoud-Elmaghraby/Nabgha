import { apiClient } from '@/shared/lib/api/client';
import type {
  UserDto,
  CreateUserPayload,
  UpdateUserPayload,
  PaginatedUsers,
  ListUsersParams,
} from '../types/user.types';

export const usersApi = {
  list: async (params?: ListUsersParams): Promise<PaginatedUsers> => {
    const res = await apiClient.get('/users', { params });
    return res.data.data;
  },

  getOne: async (id: string): Promise<UserDto> => {
    const res = await apiClient.get(`/users/${id}`);
    return res.data.data;
  },

  create: async (payload: CreateUserPayload): Promise<UserDto> => {
    const res = await apiClient.post('/users', payload);
    return res.data.data;
  },

  update: async (id: string, payload: UpdateUserPayload): Promise<UserDto> => {
    const res = await apiClient.put(`/users/${id}`, payload);
    return res.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/users/${id}`);
  },

  changePassword: async (id: string, currentPassword: string, newPassword: string): Promise<void> => {
    await apiClient.put(`/users/${id}/password`, { currentPassword, newPassword });
  },
};
