import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { plansApi } from '../api/plans.api';
import type { CreatePlanPayload, UpdatePlanPayload } from '../types/plan.types';

export const PLANS_KEY = 'platform_plans';

export function usePlans() {
  return useQuery({
    queryKey: [PLANS_KEY],
    queryFn: () => plansApi.list(),
  });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePlanPayload) => plansApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PLANS_KEY] });
    },
  });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdatePlanPayload }) =>
      plansApi.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PLANS_KEY] });
    },
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => plansApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PLANS_KEY] });
    },
  });
}
