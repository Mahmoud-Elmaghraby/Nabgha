/**
 * Barcode scanners act as keyboard input devices.
 * When the OS keyboard layout is Arabic, the scanned ASCII characters
 * (like S, T, U, -, digits) get mapped to their Arabic keyboard equivalents.
 *
 * This utility normalises any Arabic-layout characters back to the
 * original English/ASCII characters the scanner intended.
 *
 * We use the key codes approach: listen to keydown events and collect
 * the physical key codes instead of the character values. This is more
 * reliable than character mapping for all edge cases.
 *
 * However, for simplicity (since scanners type very fast and we process
 * the full string after it's typed), we do a character-level mapping
 * of the standard Arabic keyboard layout to QWERTY.
 */

// Arabic keyboard layout -> English QWERTY mapping (unshifted keys)
const AR_TO_EN: Record<string, string> = {
  // Row 1: q w e r t y u i o p [ ]
  '\u0636': 'q',  // ض
  '\u0635': 'w',  // ص
  '\u062B': 'e',  // ث
  '\u0642': 'r',  // ق
  '\u0641': 't',  // ف
  '\u063A': 'y',  // غ
  '\u0639': 'u',  // ع
  '\u0647': 'i',  // ه
  '\u062E': 'o',  // خ
  '\u062D': 'p',  // ح
  '\u062C': '[',  // ج
  '\u062F': ']',  // د

  // Row 2: a s d f g h j k l ; '
  '\u0634': 'a',  // ش
  '\u0633': 's',  // س
  '\u064A': 'd',  // ي
  '\u0628': 'f',  // ب
  '\u0644': 'g',  // ل
  '\u0627': 'h',  // ا
  '\u062A': 'j',  // ت
  '\u0646': 'k',  // ن
  '\u0645': 'l',  // م
  '\u0643': ';',  // ك
  '\u0637': "'",  // ط

  // Row 3: z x c v b n m , . /
  '\u0626': 'z',  // ئ
  '\u0621': 'x',  // ء
  '\u0624': 'c',  // ؤ
  '\u0631': 'v',  // ر
  // 'لا' is a two-char ligature for 'b' — handled separately below
  '\u0649': 'n',  // ى
  '\u0629': 'm',  // ة
  '\u0648': ',',  // و
  '\u0632': '.',  // ز
  '\u0638': '/',  // ظ

  // Shifted row 1 (partial — the ones relevant to barcodes)
  '\u0625': 'Y',  // إ (Shift+Y)
  '\u060C': 'K',  // ، (Shift+K — Arabic comma)
  '\u061B': 'P',  // ؛ (Shift+P — Arabic semicolon)
  '\u0623': 'H',  // أ (Shift+H)
  '\u0622': 'N',  // آ (Shift+N)
  '\u061F': '?',  // ؟ (Shift+/ — Arabic question mark)

  // Common shifted diacritics
  '\u064E': 'Q',  // فتحة — Shift+Q
  '\u064B': 'W',  // تنوين فتح — Shift+W
  '\u064F': 'E',  // ضمة — Shift+E
  '\u064C': 'R',  // تنوين ضم — Shift+R
  '\u0650': 'A',  // كسرة — Shift+A
  '\u064D': 'S',  // تنوين كسر — Shift+S
  '\u0640': 'J',  // تطويلة — Shift+J
  '\u0652': 'X',  // سكون — Shift+X
};

// Two-character Arabic ligatures that map to a single English key
const LIGATURES: [string, string][] = [
  ['\u0644\u0627', 'b'],   // لا -> b
  ['\u0644\u0625', 'T'],   // لإ -> Shift+T
  ['\u0644\u0623', 'G'],   // لأ -> Shift+G
  ['\u0644\u0622', 'B'],   // لآ -> Shift+B
];

/**
 * Normalises a barcode string that may have been typed through an Arabic keyboard layout.
 * - If the string only contains printable ASCII, it's returned as-is.
 * - Otherwise each character is mapped from the Arabic keyboard position to its English equivalent.
 */
export function normaliseScannerInput(raw: string): string {
  // Fast path — if the string only contains printable ASCII, no mapping needed
  if (/^[\x20-\x7E]*$/.test(raw)) return raw;

  let result = '';
  for (let i = 0; i < raw.length; i++) {
    // Check two-char ligatures first
    if (i + 1 < raw.length) {
      const pair = raw[i] + raw[i + 1];
      const ligature = LIGATURES.find(([ar]) => ar === pair);
      if (ligature) {
        result += ligature[1];
        i++; // skip next char
        continue;
      }
    }
    const ch = raw[i];
    result += AR_TO_EN[ch] ?? ch;
  }
  return result;
}
