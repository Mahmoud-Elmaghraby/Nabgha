import { apiClient } from '@/shared/lib/api/client';
import type {
  CenterSettingsDto,
  UpdateCenterSettingsPayload,
  BrandingSettingsDto,
  BrandingMode,
} from '../types/settings.types';

export const settingsApi = {
  getCenterSettings: () =>
    apiClient.get<CenterSettingsDto>('/settings/center'),
  updateCenterSettings: (data: UpdateCenterSettingsPayload) =>
    apiClient.put<CenterSettingsDto>('/settings/center', data),
  getBranding: () =>
    apiClient.get<BrandingSettingsDto>('/settings/branding'),
  updateBranding: (mode: BrandingMode) =>
    apiClient.put<BrandingSettingsDto>('/settings/branding', { mode }),
};
