import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { backupApi } from '../api/backup.api';
import { backupAge } from '../lib/backupAge';
import { usePermissions } from '@/shared/hooks/usePermissions';

/**
 * BACKUP-007: تنبيه في الصفحة الرئيسية لو مفيش نسخة احتياطية سليمة من أكتر من يومين،
 * أو لو مفيش نسخة خالص وآخر محاولة فشلت. قبل كده الفشل كان بيعدّي في صمت.
 * بيظهر في الديسكتوب بس، ولمين عنده صلاحية الإعدادات.
 */
export function BackupHealthBanner() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canView = hasPermission('settings.view');

  const { data: status } = useQuery({
    queryKey: ['backup-status'],
    queryFn: () => backupApi.status(),
    enabled: canView,
    refetchInterval: 5 * 60_000,
    retry: false,
  });

  if (!status?.available || !status.stale) return null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
      <div>
        <p className="text-sm font-bold text-red-700">
          {status.lastSuccessAt
            ? `آخر نسخة احتياطية سليمة ${backupAge(status.lastSuccessAt)}`
            : 'مفيش ولا نسخة احتياطية سليمة لبيانات البرنامج'}
        </p>
        <p className="text-xs text-red-600 mt-1">
          {status.lastFailureAt
            ? 'آخر محاولة نسخ فشلت. لو الجهاز حصله مشكلة دلوقتي، البيانات ممكن تضيع.'
            : status.autoEnabled
              ? 'البرنامج هيحاول يعمل نسخة تلقائي. وتقدر تاخد نسخة بنفسك دلوقتي.'
              : 'النسخ التلقائي مقفول. فعّله من الإعدادات علشان بياناتك تبقى في أمان.'}
        </p>
      </div>
      <button
        onClick={() => navigate('/settings?tab=backup')}
        className="shrink-0 px-4 py-2 text-sm font-bold bg-red-600 text-white rounded-lg hover:bg-red-700"
      >
        افتح النسخ الاحتياطي
      </button>
    </div>
  );
}
