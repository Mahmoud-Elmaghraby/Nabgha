/**
 * توحيد صيغة أرقام الهواتف المصرية عبر التطبيق كله — نفس المنطق كان مكرر
 * (private) جوه BaileysProvider بس، دلوقتي utility مشتركة عشان أي حتة تانية
 * محتاجة تقارن رقمين تليفون (زي دخول أولياء الأمور عبر OTP) تستخدم نفس المنطق
 * بالظبط، وإلا ممكن رقم مخزّن "01012345678" ما يتطابقش مع "201012345678".
 */
export function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  // أرقام مصرية بتبدأ بـ 0 → استبدالها بكود الدولة 20
  if (digits.startsWith('0')) {
    digits = '20' + digits.slice(1);
  }
  return digits;
}
