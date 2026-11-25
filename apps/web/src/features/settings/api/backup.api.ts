import { apiClient } from '@/shared/lib/api/client';

export interface BackupFile {
  filename: string;
  sizeBytes: number;
  createdAt: string;
  kind: 'auto' | 'manual';
}

/** BACKUP-007: حالة النسخ الاحتياطي */
export interface BackupStatus {
  available: boolean;
  autoEnabled: boolean;
  running: boolean;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
  /** مفيش نسخة ناجحة من أكتر من يومين (أو مفيش خالص وآخر محاولة فشلت) */
  stale: boolean;
}

export const backupApi = {
  /** BACKUP-006: النسخ من البرنامج متاح في الديسكتوب بس */
  isAvailable: async (): Promise<boolean> => {
    const res = await apiClient.get('/settings/backup/availability');
    return !!res.data.data.available;
  },
  status: async (): Promise<BackupStatus> => {
    const res = await apiClient.get('/settings/backup/status');
    return res.data.data;
  },
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
