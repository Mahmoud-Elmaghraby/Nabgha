import { useFinancePrivacyStore } from '../stores/finance-privacy.store';

interface MaskedAmountProps {
  /** القيمة الجاهزة للعرض (متنسّقة بالفعل — toLocaleString وأي لاحقة زي "جنيه"/"ج") */
  children: React.ReactNode;
  /** طول النقط البديلة — بيتغيّر حسب حجم النص الأصلي عشان التصميم ميختلش شكله بزيادة/نقصان ملحوظة */
  maskWidth?: 'sm' | 'md' | 'lg';
}

const WIDTH_CLASS: Record<NonNullable<MaskedAmountProps['maskWidth']>, string> = {
  sm: 'w-10',
  md: 'w-16',
  lg: 'w-24',
};

// يلف أي رقم مالي إجمالي (رصيد خزينة، إحصائية شهرية...) — لو وضع الخصوصية
// مفعّل بيظهر نقط بدل الرقم بنفس شكل النص المحيط. الأرقام الفردية (فاتورة
// طالب واحد، إيصال واحد) متعمّد إنها متلفّش بالمكوّن ده — دي عملية يومية
// لازم تفضل ظاهرة، الإخفاء لسه بس على الصورة الإجمالية.
export function MaskedAmount({ children, maskWidth = 'md' }: MaskedAmountProps) {
  const hidden = useFinancePrivacyStore((s) => s.hidden);
  if (!hidden) return <>{children}</>;
  return <span className={`inline-block ${WIDTH_CLASS[maskWidth]} align-middle`} aria-label="مخفي">••••••</span>;
}
