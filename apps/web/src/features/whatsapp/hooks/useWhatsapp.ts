import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { whatsappApi } from '../api/whatsapp.api';
import type { UpdateSettingsPayload, WaTemplateKey, ResolveAudienceParams } from '../types/whatsapp.types';

const KEYS = {
  status: ['wa', 'status'],
  health: ['wa', 'health'],
  settings: ['wa', 'settings'],
  templates: ['wa', 'templates'],
  messages: (params?: any) => ['wa', 'messages', params],
  inbound: (params?: any) => ['wa', 'inbound', params],
  bulk: (jobId: string) => ['wa', 'bulk', jobId],
};

export { KEYS as WA_QUERY_KEYS };

export function useWaStatus() {
  return useQuery({
    queryKey: KEYS.status,
    queryFn: () => whatsappApi.getStatus().then(r => r.data.data),
    // بولينج ذكي: سريع عند connecting، بطيء عند connected، موقوف عند disconnected
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'connecting') return 4000;
      if (status === 'connected')  return 30_000;
      // disconnected / banned: نتحقق كل دقيقتين بس منش كل 5 ثواني
      return 120_000;
    },
    refetchIntervalInBackground: false,
  });
}

export function useWaHealth() {
  return useQuery({
    queryKey: KEYS.health,
    queryFn: () => whatsappApi.getHealth().then(r => r.data.data),
  });
}

export function useWaSettings() {
  return useQuery({
    queryKey: KEYS.settings,
    queryFn: () => whatsappApi.getSettings().then(r => r.data.data),
  });
}

export function useWaTemplates() {
  return useQuery({
    queryKey: KEYS.templates,
    queryFn: () => whatsappApi.getTemplates().then(r => r.data.data),
  });
}

export function useWaInbound(params?: { unreadOnly?: boolean; limit?: number }) {
  return useQuery({
    queryKey: KEYS.inbound(params),
    queryFn: () => whatsappApi.getInbound(params).then(r => r.data.data),
  });
}

export function useWaBulkProgress(jobId: string | null) {
  return useQuery({
    queryKey: KEYS.bulk(jobId ?? ''),
    queryFn: () => whatsappApi.getBulkProgress(jobId!).then(r => r.data.data),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 2000;
      return data.status === 'running' || data.status === 'pending' ? 2000 : false;
    },
  });
}

export function useResolveAudience(params: ResolveAudienceParams | null) {
  const isReady = !!params && (
    params.type === 'all' ||
    (params.type === 'group' && !!params.groupId) ||
    (params.type === 'subjectGrade' && !!params.subjectGradeId) ||
    (params.type === 'grade' && !!params.grade) ||
    (params.type === 'teacher' && !!params.teacherId)
  );
  return useQuery({
    queryKey: ['wa', 'audience', params],
    queryFn: () => whatsappApi.resolveAudience(params!).then(r => r.data.data),
    enabled: isReady,
  });
}

export function useWaMutations() {
  const qc = useQueryClient();

  const connect = useMutation({
    mutationFn: () => whatsappApi.connect().then(r => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.status }),
  });

  const disconnect = useMutation({
    mutationFn: () => whatsappApi.disconnect(),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.status }),
  });

  const updateSettings = useMutation({
    mutationFn: (data: UpdateSettingsPayload) =>
      whatsappApi.updateSettings(data).then(r => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.settings }),
  });

  const updateTemplate = useMutation({
    mutationFn: ({ key, body }: { key: WaTemplateKey; body: string }) =>
      whatsappApi.updateTemplate(key, body).then(r => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.templates }),
  });

  const resetTemplate = useMutation({
    mutationFn: (key: WaTemplateKey) =>
      whatsappApi.resetTemplate(key).then(r => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.templates }),
  });

  const sendBulk = useMutation({
    mutationFn: (data: Parameters<typeof whatsappApi.sendBulk>[0]) =>
      whatsappApi.sendBulk(data).then(r => r.data.data),
  });

  const sendTest = useMutation({
    mutationFn: ({ phone, templateKey }: { phone: string; templateKey: WaTemplateKey }) =>
      whatsappApi.sendTest(phone, templateKey).then(r => r.data.data),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => whatsappApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wa', 'inbound'] }),
  });

  const logout = useMutation({
    mutationFn: () => whatsappApi.logout(),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.status }),
  });

  return {
    connect,
    disconnect,
    logout,
    updateSettings,
    updateTemplate,
    resetTemplate,
    sendBulk,
    sendTest,
    markRead,
  };
}
