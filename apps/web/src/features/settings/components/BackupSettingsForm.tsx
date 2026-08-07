import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { backupApi } from '../api/backup.api';
import { downloadBlob } from '@/shared/lib/downloadBlob';
import { useToast } from '@/shared/components/Toast';

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} كيلوبايت`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} ميجابايت`;
}

export function BackupSettingsForm() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);

  const { data: backups = [], isLoading } = useQuery({
    queryKey: ['backups-list'],
    queryFn: () => backupApi.list(),
  });

  const { data: autoBackupEnabled = false } = useQuery({
    queryKey: ['auto-backup-enabled'],
    queryFn: () => backupApi.getAutoBackupEnabled(),
  });

  const handleCreate = async () => {
    setCreating(true);
    try {
      await backupApi.create();
      toast.success('تم إنشاء نسخة احتياطية بنجاح');
      queryClient.invalidateQueries({ queryKey: ['backups-list'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'حدث خطأ أثناء إنشاء النسخة الاحتياطية');
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = async (filename: string) => {
    try {
      const blob = await backupApi.download(filename);
      downloadBlob(blob, filename);
    } catch {
      toast.error('حدث خطأ أثناء تحميل النسخة الاحتياطية');
    }
  };

  const handleToggleAuto = async (enabled: boolean) => {
    try {
      await backupApi.setAutoBackupEnabled(enabled);
      queryClient.invalidateQueries({ queryKey: ['auto-backup-enabled'] });
      toast.success(enabled ? 'تم تفعيل النسخ التلقائي اليومي' : 'تم إيقاف النسخ التلقائي');
    } catch {
      toast.error('حدث خطأ أثناء تحديث الإعداد');
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-bold text-gray-800 mb-1">نسخة احتياطية فورية</h3>
        <p className="text-xs text-gray-400 mb-3">
          يتم أخذ نسخة كاملة من بيانات البرنامج (الطلاب، المدفوعات، الحصص) وملفات التخزين (الشعار، الكروت)
        </p>
        <button onClick={handleCreate} disabled={creating}
          className="px-5 py-2.5 text-sm font-bold bg-[#0E3B2E] text-white rounded-xl hover:bg-[#1F6B4E] disabled:opacity-50">
          {creating ? 'جاري إنشاء النسخة...' : 'خد نسخة احتياطية دلوقتي'}
        </button>
      </div>

      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-800">النسخ التلقائي اليومي</h3>
            <p className="text-xs text-gray-400 mt-0.5">نسخة احتياطية تلقائية كل يوم الساعة 3 صباحاً (يحتفظ بآخر 7 نسخ)</p>
          </div>
          <button
            onClick={() => handleToggleAuto(!autoBackupEnabled)}
            className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${autoBackupEnabled ? 'bg-[#0E3B2E]' : 'bg-gray-200'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${autoBackupEnabled ? 'right-0.5' : 'right-6'}`} />
          </button>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-4">
        <h3 className="text-sm font-bold text-gray-800 mb-3">النسخ المتاحة</h3>
        {isLoading ? (
          <p className="text-sm text-gray-400">جاري التحميل...</p>
        ) : backups.length === 0 ? (
          <p className="text-sm text-gray-400">لا توجد نسخ احتياطية بعد</p>
        ) : (
          <div className="border border-gray-100 rounded-lg divide-y divide-gray-50">
            {backups.map((b) => (
              <div key={b.filename} className="flex items-center justify-between px-3 py-2.5">
                <div>
                  <p className="text-sm text-gray-700">{new Date(b.createdAt).toLocaleString('ar-EG')}</p>
                  <p className="text-xs text-gray-400">{formatSize(b.sizeBytes)}</p>
                </div>
                <button onClick={() => handleDownload(b.filename)} className="text-xs font-medium text-[#0E3B2E] hover:underline px-3 py-1.5">تحميل</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
