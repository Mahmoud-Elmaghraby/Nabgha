import { useEffect } from 'react';
import { useFinancePrivacyStore } from '../stores/finance-privacy.store';

// زرار العين (👁️) بيتكرر في أي شاشة مالية فيها أرقام إجمالية — FinanceLayout
// بيغطي أغلب الشاشات، لكن TreasuryDetailPage عنده هيدر مستقل بره الـ Layout
// فمحتاج نفس الزرار بشكل منفصل هنا بدل ما نكرر منطق الـ store يدويًا في مكانين.
export function FinancePrivacyToggle({ className }: { className?: string }) {
  const hidden = useFinancePrivacyStore((s) => s.hidden);
  const init = useFinancePrivacyStore((s) => s.init);
  const toggle = useFinancePrivacyStore((s) => s.toggle);

  useEffect(() => { init(); }, [init]);

  return (
    <button
      onClick={toggle}
      title={hidden ? 'إظهار الأرقام' : 'إخفاء الأرقام'}
      className={`shrink-0 w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors ${className ?? ''}`}
    >
      {hidden ? (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
          <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
      ) : (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );
}
