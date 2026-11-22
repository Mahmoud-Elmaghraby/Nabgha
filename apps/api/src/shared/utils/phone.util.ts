/**
 * توحيد صيغة أرقام الهواتف المصرية عبر التطبيق كله — نفس المنطق كان مكرر
 * (private) جوه BaileysProvider بس، دلوقتي utility مشتركة عشان أي حتة تانية
 * محتاجة تقارن رقمين تليفون (زي دخول أولياء الأمور عبر OTP) تستخدم نفس المنطق
 * بالظبط، وإلا ممكن رقم مخزّن "01012345678" ما يتطابقش مع "201012345678".
 */
export function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  // صيغة دولية بـ 00 (مثلاً 00201012345678) → من غير الـ 00
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  // أرقام مصرية بتبدأ بـ 0 → استبدالها بكود الدولة 20
  else if (digits.startsWith('0')) {
    digits = '20' + digits.slice(1);
  }
  // موبايل مصري اتكتب من غير الصفر (1012345678) → 201012345678
  else if (digits.length === 10 && digits.startsWith('1')) {
    digits = '20' + digits;
  }
  return digits;
}

/**
 * كل الصيغ اللي ممكن يكون رقم مصري متخزّن بيها في قاعدة البيانات
 * (01012345678 / 201012345678 / +201012345678 / 1012345678) — للبحث عن طالب برقم
 * جاي من واتساب (اللي بيبعته دايمًا بصيغة دولية).
 */
export function phoneVariants(phone: string): string[] {
  const intl = normalizePhone(phone);
  const variants = new Set<string>([phone, intl, `+${intl}`]);
  if (intl.startsWith('20') && intl.length === 12) {
    variants.add('0' + intl.slice(2));
    variants.add(intl.slice(2));
  }
  return [...variants];
}
