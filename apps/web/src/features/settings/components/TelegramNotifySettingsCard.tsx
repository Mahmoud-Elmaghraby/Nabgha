import { useState, useEffect } from 'react';
import { apiClient } from '@/shared/lib/api/client';
import { usePermissions } from '@/shared/hooks/usePermissions';

// مرآة لـ WaSettingsCard (apps/web/src/features/whatsapp/components/WaSettingsCard.tsx)
// بس من غير حقول الحماية من الحظر (daily limit / delay / warmup) — إعدادات
// تليجرام مستقلة تمامًا عن إعدادات الواتساب، مش بتتحكم في بعض خالص.

interface TelegramNotifySettings {
  telegramEnabled: boolean;
  sendHoursFrom: string;
  sendHoursTo: string;
  notifyAbsent: boolean;
  notifyPresent: boolean;
  notifyLate: boolean;
  notify3Absences: boolean;
  notifyPaymentConfirm: boolean;
  notifyPaymentDue7d: boolean;
  notifyPaymentDue1d: boolean;
  notifyPaymentOverdue: boolean;
  notifyNewStudent: boolean;
  notifyGroupAdded: boolean;
  notifyGroupRemoved: boolean;
  notifyAbsenceExcused: boolean;
  notifyGradeRecorded: boolean;
}

interface ToggleRowProps {
  label: string;
  subtitle?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

function ToggleRow({ label, subtitle, checked, onChange, disabled }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      <button
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={`relative w-10 h-5 rounded-full transition-colors shrink-0 mr-3 ${
          checked ? 'bg-[#0E3B2E]' : 'bg-gray-200'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`} />
      </button>
    </div>
  );
}

export function TelegramNotifySettingsCard() {
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission('settings.edit');
  const [local, setLocal] = useState<Partial<TelegramNotifySettings>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get('/telegram/notify-settings');
        setLocal(res.data.data);
      } catch {
        setError('تعذّر تحميل إعدادات إشعارات تليجرام');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const update = (key: keyof TelegramNotifySettings, value: any) => {
    setLocal(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await apiClient.put('/telegram/notify-settings', local);
      setLocal(res.data.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'حدث خطأ أثناء حفظ الإعدادات، حاول تاني');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="h-4 bg-gray-100 rounded animate-pulse w-1/3 mb-4" />
      {[1, 2, 3, 4].map(i => <div key={i} className="h-10 bg-gray-50 rounded animate-pulse mb-2" />)}
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-5" dir="rtl">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-[#0E3B2E] text-base">إعدادات إشعارات تليجرام</h3>
        {canEdit && (
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-4 py-1.5 text-sm rounded-lg transition-all ${
              saved ? 'bg-emerald-50 text-emerald-700' : 'bg-[#0E3B2E] text-white hover:bg-[#1F6B4E]'
            } disabled:opacity-50`}
          >
            {saved ? '✓ تم الحفظ' : saving ? 'جاري...' : 'حفظ'}
          </button>
        )}
      </div>

      <ToggleRow
        label="تفعيل إشعارات تليجرام"
        subtitle="مفتاح رئيسي — لو متعطل، مفيش أي إشعار هيتبعت على تليجرام خالص"
        checked={local.telegramEnabled ?? false}
        onChange={v => update('telegramEnabled', v)}
        disabled={!canEdit}
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">من الساعة</label>
          <input
            type="time"
            value={local.sendHoursFrom ?? '08:00'}
            onChange={e => update('sendHoursFrom', e.target.value)}
            disabled={!canEdit}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20 disabled:opacity-50"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">لحد الساعة</label>
          <input
            type="time"
            value={local.sendHoursTo ?? '22:00'}
            onChange={e => update('sendHoursTo', e.target.value)}
            disabled={!canEdit}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20 disabled:opacity-50"
          />
        </div>
      </div>
      <p className="text-xs text-gray-400 -mt-2">ساعات هدوء اختيارية — مش حماية من حظر (تليجرام قناة رسمية آمنة)</p>

      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">إشعارات الحضور</p>
        <ToggleRow label="إشعار الغياب" subtitle="للأهل فور إغلاق الكشف" checked={local.notifyAbsent ?? true} onChange={v => update('notifyAbsent', v)} disabled={!canEdit} />
        <ToggleRow label="إشعار الحضور" subtitle="تأكيد وصول الطالب" checked={local.notifyPresent ?? false} onChange={v => update('notifyPresent', v)} disabled={!canEdit} />
        <ToggleRow label="إشعار التأخير" checked={local.notifyLate ?? true} onChange={v => update('notifyLate', v)} disabled={!canEdit} />
        <ToggleRow label="تنبيه 3 غيابات متتالية" checked={local.notify3Absences ?? true} onChange={v => update('notify3Absences', v)} disabled={!canEdit} />
        <ToggleRow label="إشعار التعويض (الحضور البديل)" checked={local.notifyAbsenceExcused ?? true} onChange={v => update('notifyAbsenceExcused', v)} disabled={!canEdit} />
      </div>

      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">إشعارات المدفوعات</p>
        <ToggleRow label="إيصال الدفع الفوري" checked={local.notifyPaymentConfirm ?? true} onChange={v => update('notifyPaymentConfirm', v)} disabled={!canEdit} />
        <ToggleRow label="تذكير قبل الاستحقاق (7 أيام)" checked={local.notifyPaymentDue7d ?? true} onChange={v => update('notifyPaymentDue7d', v)} disabled={!canEdit} />
        <ToggleRow label="تذكير قبل الاستحقاق (يوم)" checked={local.notifyPaymentDue1d ?? true} onChange={v => update('notifyPaymentDue1d', v)} disabled={!canEdit} />
        <ToggleRow label="تنبيه التأخر في السداد" checked={local.notifyPaymentOverdue ?? true} onChange={v => update('notifyPaymentOverdue', v)} disabled={!canEdit} />
      </div>

      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">إشعارات الطلاب</p>
        <ToggleRow label="ترحيب بالطالب الجديد" checked={local.notifyNewStudent ?? true} onChange={v => update('notifyNewStudent', v)} disabled={!canEdit} />
        <ToggleRow label="إضافة لمجموعة" checked={local.notifyGroupAdded ?? true} onChange={v => update('notifyGroupAdded', v)} disabled={!canEdit} />
        <ToggleRow label="إزالة من مجموعة" checked={local.notifyGroupRemoved ?? false} onChange={v => update('notifyGroupRemoved', v)} disabled={!canEdit} />
      </div>

      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">إشعارات الدرجات</p>
        <ToggleRow label="إشعار تسجيل الدرجة" checked={local.notifyGradeRecorded ?? true} onChange={v => update('notifyGradeRecorded', v)} disabled={!canEdit} />
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
    </div>
  );
}
