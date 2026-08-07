import { apiClient } from '@/shared/lib/api/client';

export interface BackupFile {
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

export const backupApi = {
  create: async (): Promise<{ filename: string }> => {
    const res = await apiClient.post('/settings/backup/create');
    return res.data.data;
  },
  list: async (): Promise<BackupFile[]> => {
    const res = await apiClient.get('/settings/backup/list');
    return res.data.data;
  },
  download: async (filename: string): Promise<Blob> => {
    const res = await apiClient.get(`/settings/backup/download/${encodeURIComponent(filename)}`, {
      responseType: 'blob',
    });
    return res.data;
  },
  getAutoBackupEnabled: async (): Promise<boolean> => {
    const res = await apiClient.get('/settings/backup/auto-backup');
    return res.data.data.enabled;
  },
  setAutoBackupEnabled: async (enabled: boolean): Promise<void> => {
    await apiClient.put('/settings/backup/auto-backup', { enabled });
  },
};
