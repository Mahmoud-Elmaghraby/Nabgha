import { apiClient } from '@/shared/lib/api/client';
import type { TeacherDto, CreateTeacherPayload, UpdateTeacherPayload } from '../types/teacher.types';

export const teachersApi = {
  list: async (search?: string): Promise<TeacherDto[]> => {
    const res = await apiClient.get('/teachers', { params: search ? { search } : undefined });
    return res.data.data;
  },

  getOne: async (id: string): Promise<TeacherDto> => {
    const res = await apiClient.get(`/teachers/${id}`);
    return res.data.data;
  },

  create: async (payload: CreateTeacherPayload): Promise<TeacherDto> => {
    const res = await apiClient.post('/teachers', payload);
    return res.data.data;
  },

  update: async (id: string, payload: UpdateTeacherPayload): Promise<TeacherDto> => {
    const res = await apiClient.put(`/teachers/${id}`, payload);
    return res.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/teachers/${id}`);
  },
};
