import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../api/settings.api';
import type { UpdateCenterSettingsPayload, BrandingMode } from '../types/settings.types';

const KEYS = {
  center: ['settings', 'center'],
  branding: ['settings', 'branding'],
};

export function useCenterSettings() {
  return useQuery({
    queryKey: KEYS.center,
    queryFn: () => settingsApi.getCenterSettings().then(r => r.data.data),
  });
}

export function useBrandingSettings() {
  return useQuery({
    queryKey: KEYS.branding,
    queryFn: () => settingsApi.getBranding().then(r => r.data.data),
  });
}

export function useSettingsMutations() {
  const qc = useQueryClient();

  const updateCenter = useMutation({
    mutationFn: (data: UpdateCenterSettingsPayload) =>
      settingsApi.updateCenterSettings(data).then(r => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.center }),
  });

  const updateBranding = useMutation({
    mutationFn: (mode: BrandingMode) =>
      settingsApi.updateBranding(mode).then(r => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.branding }),
  });

  return { updateCenter, updateBranding };
}
