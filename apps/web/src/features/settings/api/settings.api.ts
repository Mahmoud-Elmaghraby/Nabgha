import { apiClient } from '@/shared/lib/api/client';
import type { CenterSettingsDto, UpdateCenterSettingsPayload } from '../types/settings.types';

export const settingsApi = {
  getCenterSettings: () =>
    apiClient.get<CenterSettingsDto>('/settings/center'),
  updateCenterSettings: (data: UpdateCenterSettingsPayload) =>
    apiClient.put<CenterSettingsDto>('/settings/center', data),
};
