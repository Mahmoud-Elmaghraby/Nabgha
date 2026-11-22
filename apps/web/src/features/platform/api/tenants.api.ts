import { platformClient } from './platform-client';
import type { TenantDto, CreateTenantPayload, UpdateTenantPayload, PlatformStatsDto } from '../types/tenant.types';

export const tenantsApi = {
  list: async (search?: string): Promise<TenantDto[]> => {
    const res = await platformClient.get('/platform/tenants', {
      params: search ? { search } : undefined,
    });
    return res.data.data;
  },

  getOne: async (id: string): Promise<TenantDto> => {
    const res = await platformClient.get(`/platform/tenants/${id}`);
    return res.data.data;
  },

  create: async (payload: CreateTenantPayload): Promise<TenantDto> => {
    const res = await platformClient.post('/platform/tenants', payload);
    return res.data.data;
  },

  update: async (id: string, payload: UpdateTenantPayload): Promise<TenantDto> => {
    const res = await platformClient.patch(`/platform/tenants/${id}`, payload);
    return res.data.data;
  },

  toggleActive: async (id: string): Promise<TenantDto> => {
    const res = await platformClient.patch(`/platform/tenants/${id}/toggle-active`);
    return res.data.data;
  },

  getStats: async (): Promise<PlatformStatsDto> => {
    const res = await platformClient.get('/platform/stats');
    return res.data.data;
  },
};
