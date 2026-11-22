import { useState, useEffect } from 'react';
import { useBrandingSettings, useSettingsMutations } from '../hooks/useSettings';
import type { BrandingMode } from '../types/settings.types';

const OPTIONS: { value: BrandingMode; title: string; desc: string; icon: string }[] = [
  {
    value: 'center',
    title: 'اسم المركز',
    desc: 'كل الرسائل والإيصالات تظهر باسم المركز ورقمه دايماً — نفس الطريقة لكل المدرسين',
    icon: '🏫',
  },
  {
    value: 'teacher',
    title: 'اسم المدرس',
    desc: 'الرسائل والإيصالات المرتبطة بمجموعة معينة تظهر باسم مدرسها ورقمه. لو مفيش مدرس واضح، هترجع لاسم المركز تلقائياً',
    icon: '👨‍🏫',
  },
];

export function BrandingSettingsForm() {
  const { data, isLoading } = useBrandingSettings();
  const { updateBranding } = useSettingsMutations();
  const [selected, setSelected] = useState<BrandingMode>('center');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) setSelected(data.mode);
  }, [data]);

  const handleSelect = (mode: BrandingMode) => {
    setSelected(mode);
    updateBranding.mutate(mode, {
      onSuccess: () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      },
    });
  };

  if (isLoading) return (
    <div className="space-y-3">
      {[1, 2].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
    </div>
  );

  return (
    <div className="space-y-4" dir="rtl">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">
        <p className="text-xs">
          يحدد الاسم والرقم اللي بيظهر في رسائل الواتساب وإيصالات الدفع اللي ليها علاقة بمجموعة أو مادة معينة.
          الرسائل العامة (زي تسجيل طالب جديد) بتفضل باسم المركز دايماً.
        </p>
      </div>

      <div className="space-y-3">
        {OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => handleSelect(opt.value)}
            disabled={updateBranding.isPending}
            className={`w-full text-right p-4 rounded-xl border-2 transition-all flex items-start gap-3 ${
              selected === opt.value
                ? 'border-[#0E3B2E] bg-[#0E3B2E]/5'
                : 'border-gray-200 hover:border-gray-300'
            } disabled:opacity-50`}
          >
            <span className="text-2xl shrink-0">{opt.icon}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-gray-900">{opt.title}</p>
                {selected === opt.value && (
                  <span className="text-xs bg-[#0E3B2E] text-white px-2 py-0.5 rounded-full">مفعّل</span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">{opt.desc}</p>
            </div>
          </button>
        ))}
      </div>

      {saved && (
        <p className="text-sm text-emerald-600 text-center">✓ تم حفظ الإعداد</p>
      )}
    </div>
  );
}
