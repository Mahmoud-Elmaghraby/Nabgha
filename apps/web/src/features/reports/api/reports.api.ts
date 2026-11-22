import { apiClient } from '@/shared/lib/api/client';
import type { ReportDefinition, ReportFormat, ReportPreviewData } from '../types/report.types';

interface MonthlyWhatsappProgress {
  jobId: string;
  total: number;
  sent: number;
  failed: number;
  queued: number;
  progress: number;
  status: string;
}

export const reportsApi = {
  list: async (): Promise<ReportDefinition[]> => {
    const res = await apiClient.get('/reports');
    return res.data.data;
  },
  preview: async (key: string, params: Record<string, any>): Promise<ReportPreviewData> => {
    const res = await apiClient.get(`/reports/${key}/preview`, { params });
    return res.data.data;
  },
  generate: async (
    key: string,
    params: Record<string, any>,
    format: ReportFormat,
  ): Promise<Blob> => {
    const res = await apiClient.get(`/reports/${key}/generate`, {
      params: { ...params, format },
      responseType: 'blob',
    });
    return res.data;
  },
  sendMonthlyWhatsapp: async (studentIds: string[], month: string): Promise<MonthlyWhatsappProgress> => {
    const res = await apiClient.post('/reports/monthly-whatsapp/send', { studentIds, month });
    return res.data.data;
  },
  getMonthlyWhatsappProgress: async (jobId: string): Promise<MonthlyWhatsappProgress> => {
    const res = await apiClient.get(`/reports/monthly-whatsapp/${jobId}`);
    return res.data.data;
  },
  cancelMonthlyWhatsapp: async (jobId: string): Promise<void> => {
    await apiClient.delete(`/reports/monthly-whatsapp/${jobId}`);
  },
};
