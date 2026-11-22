import { useTouchMode } from '@/shared/hooks/useTouchMode';

// أزرار صغيرة عايمة: وضع اللمس + ملء الشاشة (للشاشات التفاعلية والتابلت).
// مخفية على الموبايل الصغير (MobileNav بيغطي الجزء ده).
export function DisplayModeControls() {
  const { touchActive, toggleTouch, isFullscreen, fullscreenSupported, toggleFullscreen } = useTouchMode();
  const btn = (active: boolean) =>
    `w-11 h-11 flex items-center justify-center rounded-full shadow-lg border transition-colors ${
      active ? 'bg-[#0E3B2E] text-white border-[#0E3B2E]' : 'bg-white text-[#0E3B2E] border-gray-200 hover:bg-gray-50'
    }`;
  return (
    <div className="hidden md:flex fixed bottom-4 left-4 z-40 flex-col gap-2 print:hidden">
      <button type="button" onClick={toggleTouch} className={btn(touchActive)}
        title={touchActive ? 'إيقاف وضع الشاشة التفاعلية' : 'تفعيل وضع الشاشة التفاعلية (أزرار أكبر)'}>
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 11V5a2 2 0 0 1 4 0v6" /><path d="M13 11V9a2 2 0 0 1 4 0v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-3l-2-4a2 2 0 0 1 3-2l1 1" />
        </svg>
      </button>
      {fullscreenSupported && (
        <button type="button" onClick={toggleFullscreen} className={btn(isFullscreen)}
          title={isFullscreen ? 'خروج من ملء الشاشة' : 'ملء الشاشة'}>
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {isFullscreen
              ? <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              : <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />}
          </svg>
        </button>
      )}
    </div>
  );
}
