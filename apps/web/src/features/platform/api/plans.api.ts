import { platformClient } from './platform-client';
import type { PlanDto, CreatePlanPayload, UpdatePlanPayload } from '../types/plan.types';

export const plansApi = {
  list: async (): Promise<PlanDto[]> => {
    const res = await platformClient.get('/platform/plans');
    return res.data.data;
  },

  getOne: async (id: string): Promise<PlanDto> => {
    const res = await platformClient.get(`/platform/plans/${id}`);
    return res.data.data;
  },

  create: async (payload: CreatePlanPayload): Promise<PlanDto> => {
    const res = await platformClient.post('/platform/plans', payload);
    return res.data.data;
  },

  update: async (id: string, payload: UpdatePlanPayload): Promise<PlanDto> => {
    const res = await platformClient.patch(`/platform/plans/${id}`, payload);
    return res.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await platformClient.delete(`/platform/plans/${id}`);
  },
};
