// ============================================================
// تنظيف الكود اللي جاي من السكانر / الكاميرا / الكتابة اليدوية
// ============================================================
// السكانر بيكتب كأنه كيبورد، فلو لغة الجهاز عربي الحروف بتتقلب
// (S → ٍ ، T → لإ ، U → ‘ ...). الواجهة بتصلّح ده، بس بنعيد هنا كمان
// كخط دفاع تاني عشان أي مكان تاني بيبعت كود (الداشبورد، الديسكتوب القديم...).
// وكمان بنقبل الشكل القديم للـ QR اللي كان JSON {"code": "...", ...}.

// كيبورد عربي (101) → نفس الزرار في الإنجليزي (من غير Shift)
const AR_PLAIN: Record<string, string> = {
  'ض': 'q', 'ص': 'w', 'ث': 'e', 'ق': 'r', 'ف': 't', 'غ': 'y', 'ع': 'u', 'ه': 'i', 'خ': 'o', 'ح': 'p',
  'ش': 'a', 'س': 's', 'ي': 'd', 'ب': 'f', 'ل': 'g', 'ا': 'h', 'ت': 'j', 'ن': 'k', 'م': 'l',
  'ئ': 'z', 'ء': 'x', 'ؤ': 'c', 'ر': 'v', 'ى': 'n', 'ة': 'm',
};
// نفس الزرار مع Shift (السكانر بيضغط Shift للحروف الكابيتال)
const AR_SHIFT: Record<string, string> = {
  'َ': 'Q', 'ً': 'W', 'ُ': 'E', 'ٌ': 'R', 'إ': 'Y', '‘': 'U', '÷': 'I', '×': 'O', '؛': 'P',
  'ِ': 'A', 'ٍ': 'S', ']': 'D', '[': 'F', 'أ': 'H', 'ـ': 'J', '،': 'K', '/': 'L',
  '~': 'Z', 'ْ': 'X', '}': 'C', '{': 'V', 'آ': 'N', '’': 'M',
};
const AR_LIGATURES: Array<[string, string]> = [['لا', 'b'], ['لإ', 'T'], ['لأ', 'G'], ['لآ', 'B']];

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/** لو النص فيه حروف عربي (يعني اتكتب والكيبورد عربي) نرجّعه للزراير الإنجليزي */
export function fixArabicKeyboardLayout(raw: string): string {
  if (!/[؀-ۿ‘’×÷]/.test(raw)) return raw;
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const pair = raw.slice(i, i + 2);
    const lig = AR_LIGATURES.find(([ar]) => ar === pair);
    if (lig) { out += lig[1]; i++; continue; }
    const ch = raw[i];
    out += AR_SHIFT[ch] ?? AR_PLAIN[ch] ?? ch;
  }
  return out;
}

/**
 * أي حاجة جاية من السكانر → كود موحّد للبحث (حروف كابيتال).
 * بيتقبل: STU-00012 / stu-00012 / ٍلإ‘-00012 (كيبورد عربي) / ٠٠٠١٢ / {"code":"STU-00012",...}
 */
export function normalizeScannedCode(raw: string): string {
  let s = (raw ?? '').replace(/[​-‏‪-‮﻿]/g, '').trim();
  s = s.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d))).replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)));

  // الشكل القديم: JSON
  if (s.startsWith('{')) {
    try {
      const parsed = JSON.parse(s);
      if (parsed && typeof parsed.code === 'string') s = parsed.code;
    } catch { /* مش JSON صالح — نكمّل */ }
  }

  s = fixArabicKeyboardLayout(s);
  // لو الـ JSON نفسه اتكتب بكيبورد عربي وبقى صالح بعد التصليح
  if (s.startsWith('{')) {
    try {
      const parsed = JSON.parse(s);
      if (parsed && typeof parsed.code === 'string') s = parsed.code;
    } catch {
      const m = s.match(/STU-[A-Z0-9-]+/i);
      if (m) s = m[0];
    }
  }
  s = s.replace(/\s+/g, '').toUpperCase();
  // لو لسه فيه رموز حوالين الكود (QR قديم اتقرا غلط مثلاً) نطلّع الكود من جوّه
  if (!/^[A-Z0-9-]+$/.test(s)) {
    const m = s.match(/STU-[A-Z0-9-]+/);
    if (m) s = m[0];
  }
  return s.slice(0, 100);
}
