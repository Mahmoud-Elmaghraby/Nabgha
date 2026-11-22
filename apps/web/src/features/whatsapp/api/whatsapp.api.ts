import { apiClient } from '@/shared/lib/api/client';
import type {
  WaStatusDto,
  WaHealthDto,
  WaSettingsDto,
  UpdateSettingsPayload,
  WaTemplateDto,
  WaTemplateKey,
  WaBulkProgressDto,
  WaInboundMessageDto,
  SendBulkPayload,
  ResolveAudienceParams,
  AudienceStudent,
} from '../types/whatsapp.types';

export const whatsappApi = {
  // Connection
  connect: () =>
    apiClient.post<{ status: string; qrCode?: string }>('/whatsapp/connect'),
  disconnect: () =>
    apiClient.post('/whatsapp/disconnect'),
  logout: () =>
    apiClient.post('/whatsapp/logout'),
  getStatus: () =>
    apiClient.get<WaStatusDto>('/whatsapp/status'),
  getHealth: () =>
    apiClient.get<WaHealthDto>('/whatsapp/health'),

  // Settings
  getSettings: () =>
    apiClient.get<WaSettingsDto>('/whatsapp/settings'),
  updateSettings: (data: UpdateSettingsPayload) =>
    apiClient.put<WaSettingsDto>('/whatsapp/settings', data),

  // Templates
  getTemplates: () =>
    apiClient.get<WaTemplateDto[]>('/whatsapp/templates'),
  updateTemplate: (key: WaTemplateKey, body: string) =>
    apiClient.put<WaTemplateDto>(`/whatsapp/templates/${key}`, { body }),
  resetTemplate: (key: WaTemplateKey) =>
    apiClient.post<WaTemplateDto>(`/whatsapp/templates/${key}/reset`),

  // Bulk
  sendBulk: (data: SendBulkPayload) =>
    apiClient.post<WaBulkProgressDto>('/whatsapp/bulk', data),
  getBulkProgress: (jobId: string) =>
    apiClient.get<WaBulkProgressDto>(`/whatsapp/bulk/${jobId}`),
  cancelBulk: (jobId: string) =>
    apiClient.delete(`/whatsapp/bulk/${jobId}`),

  // Inbound
  getInbound: (params?: { unreadOnly?: boolean; limit?: number; offset?: number }) =>
    apiClient.get<{ data: WaInboundMessageDto[]; total: number }>('/whatsapp/inbound', { params }),
  markRead: (id: string) =>
    apiClient.put(`/whatsapp/inbound/${id}/read`),

  // Audience
  resolveAudience: (params: ResolveAudienceParams) => {
    // ننظّف الحقول الفاضية (زي groupId: '') قبل الإرسال — الباك إند بيتحقق منها
    // كـ UUID صريح، والـ string الفاضي مش UUID صالح حتى لو الحقل اختياري أصلاً
    const cleaned: Record<string, string> = {};
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') cleaned[key] = String(value);
    });
    return apiClient.get<{ data: AudienceStudent[]; total: number }>('/whatsapp/audience', { params: cleaned });
  },

  // Test
  sendTest: (phone: string, templateKey: WaTemplateKey) =>
    apiClient.post('/whatsapp/test', { phone, templateKey }),
};
