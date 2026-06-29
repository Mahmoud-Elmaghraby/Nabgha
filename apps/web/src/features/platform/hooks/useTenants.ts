import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantsApi } from '../api/tenants.api';
import type { CreateTenantPayload, UpdateTenantPayload } from '../types/tenant.types';

export const TENANTS_KEY = 'platform_tenants';
export const STATS_KEY = 'platform_stats';

export function usePlatformStats() {
  return useQuery({
    queryKey: [STATS_KEY],
    queryFn: () => tenantsApi.getStats(),
  });
}

export function useTenants(search?: string) {
  return useQuery({
    queryKey: [TENANTS_KEY, search],
    queryFn: () => tenantsApi.list(search),
  });
}

export function useTenant(id: string) {
  return useQuery({
    queryKey: [TENANTS_KEY, id],
    queryFn: () => tenantsApi.getOne(id),
    enabled: !!id,
  });
}

export function useCreateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTenantPayload) => tenantsApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TENANTS_KEY] });
      qc.invalidateQueries({ queryKey: [STATS_KEY] });
    },
  });
}

export function useUpdateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateTenantPayload }) =>
      tenantsApi.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TENANTS_KEY] });
    },
  });
}

export function useToggleTenantActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tenantsApi.toggleActive(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TENANTS_KEY] });
      qc.invalidateQueries({ queryKey: [STATS_KEY] });
    },
  });
}
