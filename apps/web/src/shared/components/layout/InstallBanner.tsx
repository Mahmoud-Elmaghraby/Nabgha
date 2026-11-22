import { useState } from 'react';
import { usePwaInstall } from '@/shared/hooks/usePwaInstall';

const KEY = 'nabgha_install_banner_dismissed';

// بانر تثبيت التطبيق — بيظهر على الموبايل/التابلت بس لما التثبيت متاح ومش مثبّت قبل كده.
export function InstallBanner() {
  const pwa = usePwaInstall();
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
  });

  const isMobileish = pwa.platform !== 'desktop';
  const show = !hidden && !pwa.isInstalled && isMobileish && (pwa.canPrompt || pwa.platform === 'ios');
  if (!show) return null;

  const dismiss = () => {
    setHidden(true);
    try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ }
  };

  return (
    <div className="fixed bottom-20 right-3 left-3 z-50 md:hidden bg-[#0E3B2E] text-white rounded-2xl shadow-2xl p-3 flex items-center gap-3 print:hidden" dir="rtl">
      <img src="/Logo-icon-192.png" alt="" className="w-10 h-10 rounded-lg shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold">ثبّت نبغة على جهازك</p>
        <p className="text-[11px] text-white/70 leading-snug">
          {pwa.canPrompt ? 'افتحه من الشاشة الرئيسية زي أي تطبيق' : 'زر المشاركة ← "إضافة إلى الشاشة الرئيسية"'}
        </p>
      </div>
      {pwa.canPrompt && (
        <button type="button" onClick={() => pwa.install()} className="px-3 py-1.5 text-xs font-bold bg-[#D4AB53] text-[#0E3B2E] rounded-lg shrink-0">
          تثبيت
        </button>
      )}
      <button type="button" onClick={dismiss} className="text-white/60 text-lg leading-none px-1" aria-label="إغلاق">×</button>
    </div>
  );
}
