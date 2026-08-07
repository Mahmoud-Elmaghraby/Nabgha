import { platformClient } from './platform-client';

export const platformAuthApi = {
  login: async (data: { email: string; password: string }) => {
    const res = await platformClient.post('/auth/platform/login', data);
    return res.data.data;
  },
  logout: async () => {
    const res = await platformClient.post('/auth/logout');
    return res.data;
  },
};
