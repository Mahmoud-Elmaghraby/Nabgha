import { parentClient } from './parent-client';
import type { ParentStudent } from '../stores/parent-auth.store';
import type { ParentStudentDetail } from '../types/parent-portal.types';

export const parentPortalApi = {
  requestOtp: async (slug: string, phone: string): Promise<{ sent: true }> => {
    const res = await parentClient.post(`/parent-portal/${slug}/auth/request-otp`, { phone });
    return res.data.data;
  },

  verifyOtp: async (
    slug: string,
    phone: string,
    code: string,
  ): Promise<{ accessToken: string; students: ParentStudent[] }> => {
    const res = await parentClient.post(`/parent-portal/${slug}/auth/verify-otp`, { phone, code });
    return res.data.data;
  },

  getMe: async (slug: string): Promise<{ students: (ParentStudent & { studentCode: string | null })[] }> => {
    const res = await parentClient.get(`/parent-portal/${slug}/me`);
    return res.data.data;
  },

  getStudentDetail: async (slug: string, studentId: string): Promise<ParentStudentDetail> => {
    const res = await parentClient.get(`/parent-portal/${slug}/students/${studentId}`);
    return res.data.data;
  },
};
