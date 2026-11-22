import { apiClient } from '@/shared/lib/api/client';
import type {
  GroupDto,
  GroupStudentDto,
  CreateGroupPayload,
  UpdateGroupPayload,
  AddStudentPayload,
  PaginatedGroups,
  ListGroupsParams,
} from '../types/group.types';

export const groupsApi = {
  list: async (params?: ListGroupsParams): Promise<PaginatedGroups> => {
    const res = await apiClient.get('/groups', { params });
    return res.data.data;
  },

  getOne: async (id: string): Promise<GroupDto> => {
    const res = await apiClient.get(`/groups/${id}`);
    return res.data.data;
  },

  create: async (payload: CreateGroupPayload): Promise<GroupDto> => {
    const res = await apiClient.post('/groups', payload);
    return res.data.data;
  },

  update: async (id: string, payload: UpdateGroupPayload): Promise<GroupDto> => {
    const res = await apiClient.put(`/groups/${id}`, payload);
    return res.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/groups/${id}`);
  },

  getStudents: async (groupId: string): Promise<GroupStudentDto[]> => {
    const res = await apiClient.get(`/groups/${groupId}/students`);
    return res.data.data;
  },

  addStudent: async (groupId: string, payload: AddStudentPayload): Promise<GroupStudentDto> => {
    const res = await apiClient.post(`/groups/${groupId}/students`, payload);
    return res.data.data;
  },

  updateStudentDiscount: async (groupId: string, studentId: string, discount: number): Promise<void> => {
    await apiClient.patch(`/groups/${groupId}/students/${studentId}/discount`, { discount });
  },

  removeStudent: async (groupId: string, studentId: string): Promise<void> => {
    await apiClient.delete(`/groups/${groupId}/students/${studentId}`);
  },
};
