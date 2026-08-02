import { apiClient } from '@/shared/lib/api/client';
import type {
  StudentDto,
  StudentGroupDto,
  StudentAttendanceDto,
  CreateStudentPayload,
  UpdateStudentPayload,
  PaginatedStudents,
  ListStudentsParams,
} from '../types/student.types';

export const studentsApi = {
  list: async (params?: ListStudentsParams): Promise<PaginatedStudents> => {
    const res = await apiClient.get('/students', { params });
    return res.data.data;
  },

  getOne: async (id: string): Promise<StudentDto> => {
    const res = await apiClient.get(`/students/${id}`);
    return res.data.data;
  },

  getGroups: async (id: string): Promise<StudentGroupDto[]> => {
    const res = await apiClient.get(`/students/${id}/groups`);
    return res.data.data;
  },

  getAttendance: async (id: string): Promise<StudentAttendanceDto[]> => {
    const res = await apiClient.get(`/students/${id}/attendance`);
    return res.data.data;
  },

  create: async (payload: CreateStudentPayload): Promise<StudentDto> => {
    const res = await apiClient.post('/students', payload);
    return res.data.data;
  },

  update: async (id: string, payload: UpdateStudentPayload): Promise<StudentDto> => {
    const res = await apiClient.put(`/students/${id}`, payload);
    return res.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/students/${id}`);
  },

  export: async (
    format: 'xlsx' | 'pdf',
    params?: Omit<ListStudentsParams, 'page' | 'limit'>,
  ): Promise<Blob> => {
    const res = await apiClient.get('/students/export', {
      params: { ...params, format },
      responseType: 'blob',
    });
    return res.data;
  },
};
