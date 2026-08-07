import { useState } from 'react';
import { useWaStatus, useWaMutations } from '../hooks/useWhatsapp';
import { usePermissions } from '@/shared/hooks/usePermissions';

const STATUS_CONFIG = {
  connected: { label: 'متصل', dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700' },
  connecting: { label: 'جاري الاتصال...', dot: 'bg-amber-500 animate-pulse', badge: 'bg-amber-50 text-amber-700' },
  disconnected: { label: 'غير متصل', dot: 'bg-gray-300', badge: 'bg-gray-50 text-gray-600' },
  banned: { label: 'محظور مؤقتاً', dot: 'bg-red-500', badge: 'bg-red-50 text-red-700' },
};

export function WaConnectionCard() {
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission('settings.edit');
  const { data: status, isLoading } = useWaStatus();
  const { connect, disconnect } = useWaMutations();
  const [showQr, setShowQr] = useState(false);

  const cfg = STATUS_CONFIG[status?.status ?? 'disconnected'];

  const handleConnect = async () => {
    const result = await connect.mutateAsync();
    if (result?.qrCode) setShowQr(true);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="font-bold text-[#0E3B2E] text-base mb-1">اتصال الواتساب</h3>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}>
              {cfg.label}
            </span>
          </div>
          {status?.phone && (
            <p className="text-sm text-gray-500 mt-1">+{status.phone}</p>
          )}
        </div>

        {canEdit && (
          <div className="flex gap-2">
            {status?.status === 'connected' ? (
              <button
                onClick={() => disconnect.mutate()}
                disabled={disconnect.isPending}
                className="px-3 py-1.5 text-sm text-red-600 border border-red-100 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                قطع الاتصال
              </button>
            ) : (
              <button
                onClick={handleConnect}
                disabled={connect.isPending || status?.status === 'connecting'}
                className="px-3 py-1.5 text-sm bg-[#0E3B2E] text-white rounded-lg hover:bg-[#1F6B4E] transition-colors disabled:opacity-50"
              >
                {connect.isPending ? 'جاري...' : 'ربط جهاز'}
              </button>
            )}
          </div>
        )}
      </div>

      {status?.status === 'connected' && status.warmupDay !== undefined && (
        <div className="bg-gray-50 rounded-lg p-3 text-sm">
          <div className="flex justify-between text-gray-500 mb-1.5">
            <span>Warm-up</span>
            <span>يوم {status.warmupDay} — حد {status.dailyLimit} رسالة/يوم</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-[#4FBF9F] h-1.5 rounded-full transition-all"
              style={{ width: `${Math.min((status.warmupDay / 14) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {(showQr || status?.qrCode) && status?.status !== 'connected' && (
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-500 mb-3">
            افتح واتساب ← الأجهزة المرتبطة ← ربط جهاز ← امسح الكود
          </p>
          {status?.qrCode ? (
            <img
              src={status.qrCode}
              alt="QR Code"
              className="w-48 h-48 mx-auto rounded-xl border border-gray-200"
            />
          ) : (
            <div className="w-48 h-48 mx-auto rounded-xl bg-gray-100 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-[#0E3B2E] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <p className="text-xs text-gray-400 mt-2">الكود صالح لمدة 60 ثانية</p>
        </div>
      )}
    </div>
  );
}
