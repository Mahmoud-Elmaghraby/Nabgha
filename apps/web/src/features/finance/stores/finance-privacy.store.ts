import { create } from 'zustand';

const STORAGE_KEY = 'nabgha_finance_hide_totals';

interface FinancePrivacyState {
  /** true = الأرقام الإجمالية (أرصدة/إحصائيات) متخفية بصريًا خلف نقط */
  hidden: boolean;
  init: () => void;
  toggle: () => void;
}

// وضع خصوصية بصري بس — مفيش أي حماية أمنية حقيقية وراه (نفس اليوزر لسه عنده
// نفس الصلاحيات فعليًا)، الهدف الوحيد منع "النظر العرضي" اليومي على أرقام
// حساسة (رصيد خزينة، إجمالي تحصيل...) لما شخص غير صاحب المركز بيستخدم نفس
// الجهاز/اليوزر. الحالة محفوظة في localStorage (خاصة بكل جهاز/متصفح على
// حدة، مش على مستوى الحساب) — الافتراضي "مخفي" لأنه الاختيار الأأمن لو حد
// نسي يقفلها قبل ما يسيب الجهاز.
export const useFinancePrivacyStore = create<FinancePrivacyState>((set, get) => ({
  hidden: true,

  init: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) set({ hidden: stored === 'true' });
    } catch {
      // localStorage مش متاح (وضع تصفح خاص مثلاً) — نفضل على الافتراضي الآمن
    }
  },

  toggle: () => {
    const next = !get().hidden;
    set({ hidden: next });
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // تجاهل — التبديل هيشتغل لحد آخر الجلسة حتى لو الحفظ فشل
    }
  },
}));
