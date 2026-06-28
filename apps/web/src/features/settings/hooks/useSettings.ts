import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../api/settings.api';
import type { UpdateCenterSettingsPayload } from '../types/settings.types';

const KEYS = {
  center: ['settings', 'center'],
};

export function useCenterSettings() {
  return useQuery({
    queryKey: KEYS.center,
    queryFn: () => settingsApi.getCenterSettings().then(r => r.data.data),
  });
}

export function useSettingsMutations() {
  const qc = useQueryClient();

  const updateCenter = useMutation({
    mutationFn: (data: UpdateCenterSettingsPayload) =>
      settingsApi.updateCenterSettings(data).then(r => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.center }),
  });

  return { updateCenter };
}
