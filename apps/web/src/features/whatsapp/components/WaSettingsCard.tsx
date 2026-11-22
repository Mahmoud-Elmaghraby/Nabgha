import { useState, useEffect } from 'react';
import { useWaSettings, useWaMutations } from '../hooks/useWhatsapp';
import { usePermissions } from '@/shared/hooks/usePermissions';
import type { WaSettingsDto } from '../types/whatsapp.types';

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

export function WaSettingsCard() {
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission('settings.edit');
  const { data: settings, isLoading } = useWaSettings();
  const { updateSettings } = useWaMutations();
  const [local, setLocal] = useState<Partial<WaSettingsDto>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings) setLocal(settings);
  }, [settings]);

  const update = (key: keyof WaSettingsDto, value: any) => {
    setLocal(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    await updateSettings.mutateAsync(local);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (isLoading) return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="h-4 bg-gray-100 rounded animate-pulse w-1/3 mb-4" />
      {[1,2,3,4].map(i => <div key={i} className="h-10 bg-gray-50 rounded animate-pulse mb-2" />)}
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-[#0E3B2E] text-base">إعدادات الإرسال</h3>
        {canEdit && (
          <button
            onClick={handleSave}
            disabled={updateSettings.isPending}
            className={`px-4 py-1.5 text-sm rounded-lg transition-all ${
              saved
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-[#0E3B2E] text-white hover:bg-[#1F6B4E]'
            } disabled:opacity-50`}
          >
            {saved ? '✓ تم الحفظ' : updateSettings.isPending ? 'جاري...' : 'حفظ'}
          </button>
        )}
      </div>

      <div>
        <ToggleRow
          label="تفعيل الواتساب"
          subtitle="تفعيل أو تعطيل كل الإشعارات"
          checked={local.waEnabled ?? false}
          onChange={v => update('waEnabled', v)}
          disabled={!canEdit}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">من الساعة</label>
          <input
            type="time"
            value={local.sendHoursFrom ?? '08:00'}
            onChange={e => update('sendHoursFrom', e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">لحد الساعة</label>
          <input
            type="time"
            value={local.sendHoursTo ?? '22:00'}
            onChange={e => update('sendHoursTo', e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">
          الحد الأقصى اليومي: <span className="font-medium text-[#0E3B2E]">{local.dailyLimit ?? 50} رسالة</span>
        </label>
        <input
          type="range"
          min={10}
          max={500}
          step={10}
          value={local.dailyLimit ?? 50}
          onChange={e => update('dailyLimit', Number(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>10</span><span>500</span>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">إشعارات الحضور</p>
        <ToggleRow label="إشعار الغياب" subtitle="للأهل فور إغلاق الكشف" checked={local.notifyAbsent ?? true} onChange={v => update('notifyAbsent', v)} disabled={!canEdit} />
        <ToggleRow label="إشعار الحضور" subtitle="تأكيد وصول الطالب" checked={local.notifyPresent ?? false} onChange={v => update('notifyPresent', v)} disabled={!canEdit} />
        <ToggleRow label="إشعار التأخير" checked={local.notifyLate ?? true} onChange={v => update('notifyLate', v)} disabled={!canEdit} />
        <ToggleRow label="تنبيه 3 غيابات متتالية" checked={local.notify3Absences ?? true} onChange={v => update('notify3Absences', v)} disabled={!canEdit} />
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
        <ToggleRow label="إرسال كارت الطالب" checked={local.notifyStudentCard ?? false} onChange={v => update('notifyStudentCard', v)} disabled={!canEdit} />
      </div>

      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">Anti-Ban</p>
        <ToggleRow label="Warm-up تلقائي" subtitle="للأرقام الجديدة — يزيد الحد تدريجياً" checked={local.warmupEnabled ?? true} onChange={v => update('warmupEnabled', v)} disabled={!canEdit} />
      </div>
    </div>
  );
}
