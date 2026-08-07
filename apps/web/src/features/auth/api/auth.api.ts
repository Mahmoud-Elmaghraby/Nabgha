import { apiClient } from '@/shared/lib/api/client';
import { LoginRequest, PlatformLoginRequest } from '@nabgha/types';

export const authApi = {
  tenantLogin: async (data: LoginRequest) => {
    const res = await apiClient.post('/auth/login', data);
    return res.data.data;
  },

  platformLogin: async (data: PlatformLoginRequest) => {
    const res = await apiClient.post('/platform/auth/login', data);
    return res.data.data;
  },

  logout: async () => {
    const res = await apiClient.post('/auth/logout');
    return res.data;
  },

  refresh: async (refreshToken: string) => {
    const res = await apiClient.post('/auth/refresh', { refreshToken });
    return res.data.data;
  },
};
