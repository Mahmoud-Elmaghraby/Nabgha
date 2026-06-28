import { apiClient } from '@/shared/lib/api/client';
import type {
  Session, AttendanceRecord, CreateSessionPayload,
  UpdateAttendancePayload, BulkUpdateAttendancePayload, ListSessionsParams,
} from '../types/session.types';

export const sessionsApi = {
  list: async (params?: ListSessionsParams): Promise<{ data: Session[]; total: number }> => {
    const res = await apiClient.get('/sessions', { params });
    return res.data.data;
  },

  getById: async (id: string): Promise<Session> => {
    const res = await apiClient.get(`/sessions/${id}`);
    return res.data.data;
  },

  create: async (payload: CreateSessionPayload): Promise<Session> => {
    const res = await apiClient.post('/sessions', payload);
    return res.data.data;
  },

  update: async (id: string, payload: Partial<CreateSessionPayload>): Promise<Session> => {
    const res = await apiClient.put(`/sessions/${id}`, payload);
    return res.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/sessions/${id}`);
  },

  start: async (id: string): Promise<Session> => {
    const res = await apiClient.patch(`/sessions/${id}/start`);
    return res.data.data;
  },

  complete: async (id: string): Promise<Session> => {
    const res = await apiClient.patch(`/sessions/${id}/complete`);
    return res.data.data;
  },

  cancel: async (id: string): Promise<Session> => {
    const res = await apiClient.patch(`/sessions/${id}/cancel`);
    return res.data.data;
  },

  getAttendance: async (sessionId: string): Promise<AttendanceRecord[]> => {
    const res = await apiClient.get(`/sessions/${sessionId}/attendance`);
    return res.data.data;
  },

  updateAttendance: async (
    sessionId: string, studentId: string, payload: UpdateAttendancePayload,
  ): Promise<AttendanceRecord> => {
    const res = await apiClient.patch(`/sessions/${sessionId}/attendance/${studentId}`, payload);
    return res.data.data;
  },

  bulkUpdateAttendance: async (
    sessionId: string, payload: BulkUpdateAttendancePayload,
  ): Promise<void> => {
    await apiClient.patch(`/sessions/${sessionId}/attendance`, payload);
  },

  scanQr: async (sessionId: string, qrCode: string): Promise<AttendanceRecord> => {
    const res = await apiClient.post(`/sessions/${sessionId}/scan`, { qrCode });
    return res.data.data;
  },

  getPreviousAbsent: async (sessionId: string): Promise<string[]> => {
    const res = await apiClient.get(`/sessions/${sessionId}/previous-absent`);
    return res.data.data;
  },

  uploadImage: async (sessionId: string, file: File): Promise<Session> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post(`/sessions/${sessionId}/image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },
};
