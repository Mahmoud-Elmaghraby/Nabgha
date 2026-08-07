import { useState, useEffect } from 'react';
import { useCenterSettings, useSettingsMutations } from '../hooks/useSettings';
import { ImageUploader } from '@/shared/components/upload/ImageUploader';
import { useQuery } from '@tanstack/react-query';
import type { UpdateCenterSettingsPayload } from '../types/settings.types';

export function CenterSettingsForm() {
  const { data, isLoading } = useCenterSettings();
  const { updateCenter } = useSettingsMutations();
  const [form, setForm] = useState<UpdateCenterSettingsPayload>({});
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [saved, setSaved] = useState(false);
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramSaved, setTelegramSaved] = useState(false);
  const [botInfo, setBotInfo] = useState<{username: string; name: string} | null>(null);
  const [logoInitialized, setLogoInitialized] = useState(false);

  useEffect(() => {
    if (data) {
      setForm({
        centerName: data.centerName,
        centerPhone: data.centerPhone ?? '',
        centerPhone2: data.centerPhone2 ?? '',
        centerAddress: data.centerAddress ?? '',
        academicYear: data.academicYear ?? '',
        currency: data.currency,
        currencySymbol: data.currencySymbol,
      });
      if (!logoInitialized) {
        setLogoUrl(data.centerLogoUrl ?? '');
        setLogoInitialized(true);
      }
    }
  }, [data]);

  const update = (key: keyof UpdateCenterSettingsPayload, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleLogoChange = async (url: string) => {
    setLogoUrl(url);
    try {
      await updateCenter.mutateAsync({ centerLogoUrl: url || null });
    } catch {}
  };

  const handleSave = async () => {
    await updateCenter.mutateAsync({ ...form, centerLogoUrl: logoUrl || null });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (isLoading) return (
    <div className="space-y-3">
      {[1,2,3,4].map(i => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-gray-500 mb-1 block">اسم المركز *</label>
        <input
          value={form.centerName ?? ''}
          onChange={e => update('centerName', e.target.value)}
          placeholder="مثال: مركز نبغة التعليمي"
          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20 focus:border-[#0E3B2E]"
        />
      </div>

      <div>
        <ImageUploader
          endpoint="logo"
          value={logoUrl || null}
          onChange={handleLogoChange}
          label="لوجو المركز"
          hint="PNG أو JPG — حجم أقصى 2MB"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">رقم التليفون</label>
          <input
            value={form.centerPhone ?? ''}
            onChange={e => update('centerPhone', e.target.value)}
            placeholder="01012345678"
            dir="ltr"
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20 focus:border-[#0E3B2E]"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">
            رقم هاتف إضافي <span className="text-gray-400">(اختياري)</span>
          </label>
          <input
            value={form.centerPhone2 ?? ''}
            onChange={e => update('centerPhone2', e.target.value)}
            placeholder="01098765432"
            dir="ltr"
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20 focus:border-[#0E3B2E]"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">العنوان</label>
        <input
          value={form.centerAddress ?? ''}
          onChange={e => update('centerAddress', e.target.value)}
          placeholder="مثال: القاهرة، مصر الجديدة"
          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20 focus:border-[#0E3B2E]"
        />
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">العام الدراسي</label>
        <input
          value={form.academicYear ?? ''}
          onChange={e => update('academicYear', e.target.value)}
          placeholder="مثال: 2025/2026"
          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20 focus:border-[#0E3B2E]"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">العملة</label>
          <select
            value={form.currency ?? 'EGP'}
            onChange={e => update('currency', e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20"
          >
            <option value="EGP">جنيه مصري</option>
            <option value="SAR">ريال سعودي</option>
            <option value="AED">درهم إماراتي</option>
            <option value="USD">دولار أمريكي</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">رمز العملة</label>
          <input
            value={form.currencySymbol ?? ''}
            onChange={e => update('currencySymbol', e.target.value)}
            placeholder="ج.م"
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20 focus:border-[#0E3B2E]"
          />
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={updateCenter.isPending}
        className={`w-full py-2.5 text-sm font-medium rounded-lg transition-all ${
          saved ? 'bg-emerald-50 text-emerald-700' : 'bg-[#0E3B2E] text-white hover:bg-[#1F6B4E]'
        } disabled:opacity-50`}
      >
        {saved ? '✓ تم الحفظ' : updateCenter.isPending ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
      </button>
    </div>
  );
}
