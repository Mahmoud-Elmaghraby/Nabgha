import QRCode from 'qrcode';

// ============================================================
// رسم ليبل الطالب (QR / باركود خطي + الاسم + الكود) على canvas بمقاس حقيقي بالمليمتر
// كل شكل الليبل بيتحدد من LabelStyle — المدرس بيختاره من شاشة الطباعة وبيتحفظ على الجهاز
// ============================================================

export type CodeType = 'qr' | 'barcode';
/** مكان الـ QR: فوق (والكلام تحته) / يمين / شمال — الباركود الخطي دايماً فوق */
export type QrPosition = 'top' | 'right' | 'left';
export type NameSize = 'normal' | 'large';

export interface LabelStyle {
  codeType:    CodeType;
  qrPosition:  QrPosition;
  nameSize:    NameSize;
  showName:    boolean;
  showCode:    boolean;
  showGrade:   boolean;
  showCenter:  boolean;
  border:      boolean;
}

export const DEFAULT_LABEL_STYLE: LabelStyle = {
  codeType: 'qr', qrPosition: 'top', nameSize: 'normal',
  showName: true, showCode: true, showGrade: false, showCenter: false, border: false,
};

const STYLE_KEY = 'nabgha-label-style';

export function loadLabelStyle(): LabelStyle {
  try {
    const raw = localStorage.getItem(STYLE_KEY);
    if (raw) return { ...DEFAULT_LABEL_STYLE, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_LABEL_STYLE };
}

export function saveLabelStyle(style: LabelStyle): void {
  try { localStorage.setItem(STYLE_KEY, JSON.stringify(style)); } catch { /* ignore */ }
}

export interface LabelStudent {
  studentCode: string;
  fullName: string;
  grade?: string;
}

const DPI = 300;
const FONT = `'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif`;

// ─── Code 128 (B) — باركود خطي بيتقري بأي سكانر (1D أو 2D) ───────────────
const C128 = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

/** يرجّع عرض كل خط/مسافة بالتبادل (يبدأ بخط) بوحدات "module" */
export function code128B(text: string): number[] {
  const values: number[] = [104]; // Start B
  for (const ch of text) {
    const v = ch.charCodeAt(0) - 32;
    if (v < 0 || v > 94) throw new Error(`حرف مش مدعوم في الباركود: ${ch}`);
    values.push(v);
  }
  let sum = values[0];
  for (let i = 1; i < values.length; i++) sum += values[i] * i;
  values.push(sum % 103, 106);
  return values.flatMap((v) => C128[v].split('').map(Number));
}

function drawCode128(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, h: number) {
  const widths = code128B(text);
  const modules = widths.reduce((a, b) => a + b, 0) + 20; // + quiet zone 10 على كل ناحية
  const unit = Math.max(1, Math.floor(w / modules)); // عرض صحيح بالبكسل = خطوط حادة يقراها السكانر
  const total = unit * modules;
  let cx = x + (w - total) / 2 + unit * 10;
  ctx.fillStyle = '#000';
  widths.forEach((wd, i) => {
    if (i % 2 === 0) ctx.fillRect(Math.round(cx), y, wd * unit, h);
    cx += wd * unit;
  });
}

async function drawQr(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number) {
  const url = await QRCode.toDataURL(text, { width: 600, margin: 0, errorCorrectionLevel: 'M' });
  const img = new Image();
  await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = reject; img.src = url; });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, x, y, size, size);
  ctx.imageSmoothingEnabled = true;
}

/** أكبر خط يخلّي النص يدخل في المساحة (سطرين بالكتير للاسم) */
function fitText(
  ctx: CanvasRenderingContext2D, text: string, maxW: number, maxH: number,
  opts: { bold?: boolean; maxLines?: number; family?: string; maxSize?: number },
): { lines: string[]; size: number } {
  const maxLines = opts.maxLines ?? 1;
  const family = opts.family ?? FONT;
  const words = text.trim().split(/\s+/);
  for (let size = Math.floor(Math.min(opts.maxSize ?? maxH, maxH)); size >= 8; size--) {
    ctx.font = `${opts.bold ? '800' : '600'} ${size}px ${family}`;
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w;
      if (ctx.measureText(t).width <= maxW) cur = t;
      else { if (cur) lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    const lineH = size * 1.15;
    if (lines.length <= maxLines && lines.every((l) => ctx.measureText(l).width <= maxW) && lines.length * lineH <= maxH) {
      return { lines, size };
    }
  }
  // مايدخلش حتى بأصغر خط — نقصّه
  ctx.font = `${opts.bold ? '800' : '600'} 8px ${family}`;
  let t = text;
  while (t.length > 3 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return { lines: [t + '…'], size: 8 };
}

/** يرسم بلوك النص (اسم / كود / مرحلة / سنتر) جوّه مستطيل، متوسّط رأسياً */
function drawTextBlock(
  ctx: CanvasRenderingContext2D, s: LabelStudent, style: LabelStyle, centerName: string | undefined,
  x: number, y: number, w: number, h: number, align: 'center' | 'right',
) {
  type Item = { text: string; weight: number; bold: boolean; mono?: boolean; lines: number; color: string; rtl: boolean };
  const items: Item[] = [];
  if (style.showCenter && centerName) items.push({ text: centerName, weight: 0.55, bold: false, lines: 1, color: '#444', rtl: true });
  if (style.showName) items.push({ text: s.fullName, weight: style.nameSize === 'large' ? 1.6 : 1.15, bold: true, lines: 2, color: '#000', rtl: true });
  if (style.showCode && s.studentCode) items.push({ text: s.studentCode, weight: 0.85, bold: true, mono: true, lines: 1, color: '#000', rtl: false });
  if (style.showGrade && s.grade) items.push({ text: s.grade, weight: 0.6, bold: false, lines: 1, color: '#444', rtl: true });
  if (items.length === 0) return;

  const totalWeight = items.reduce((a, i) => a + i.weight * (i.lines > 1 ? 1.25 : 1), 0);
  const unitH = h / totalWeight;
  const fitted = items.map((it) => {
    const slotH = unitH * it.weight * (it.lines > 1 ? 1.25 : 1);
    const family = it.mono ? `'Consolas', 'Courier New', monospace` : FONT;
    const maxSize = it.lines > 1 ? unitH * it.weight : slotH;
    // سطر واحد أحسن — نكسر الاسم على سطرين بس لو ده هيكبّره بشكل واضح
    const one = fitText(ctx, it.text, w, slotH, { bold: it.bold, maxLines: 1, family, maxSize });
    if (it.lines > 1) {
      const two = fitText(ctx, it.text, w, slotH, { bold: it.bold, maxLines: 2, family, maxSize });
      if (two.size > one.size * 1.35) return { it, family, ...two };
    }
    return { it, family, ...one };
  });
  const usedH = fitted.reduce((a, f) => a + f.lines.length * f.size * 1.15, 0);
  let cy = y + (h - usedH) / 2;
  for (const f of fitted) {
    ctx.font = `${f.it.bold ? '800' : '600'} ${f.size}px ${f.family}`;
    ctx.fillStyle = f.it.color;
    ctx.textBaseline = 'top';
    ctx.direction = f.it.rtl ? 'rtl' : 'ltr';
    ctx.textAlign = align === 'center' ? 'center' : f.it.rtl ? 'right' : 'right';
    const tx = align === 'center' ? x + w / 2 : x + w;
    for (const line of f.lines) {
      ctx.fillText(line, tx, cy);
      cy += f.size * 1.15;
    }
  }
}

let fontsReady: Promise<void> | null = null;
function ensureFonts(): Promise<void> {
  if (!fontsReady) {
    fontsReady = (async () => {
      try {
        await Promise.all([document.fonts.load(`800 40px Cairo`), document.fonts.load(`600 40px Cairo`)]);
      } catch { /* لو الخط مش متاح (أوفلاين) بيرجع للخط الاحتياطي */ }
    })();
  }
  return fontsReady;
}

export async function drawStudentLabel(
  s: LabelStudent, widthMm: number, heightMm: number, style: LabelStyle, centerName?: string,
): Promise<string> {
  await ensureFonts();
  const px = DPI / 25.4;
  const W = Math.round(widthMm * px);
  const H = Math.round(heightMm * px);
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);

  const pad = Math.round(Math.min(W, H) * 0.05);
  const code = s.studentCode || '';
  const hasText = style.showName || style.showCode || style.showGrade || (style.showCenter && !!centerName);

  if (style.border) {
    ctx.strokeStyle = '#000';
    ctx.lineWidth = Math.max(2, Math.round(px * 0.3));
    const r = pad * 0.8;
    ctx.beginPath();
    ctx.roundRect?.(ctx.lineWidth, ctx.lineWidth, W - ctx.lineWidth * 2, H - ctx.lineWidth * 2, r);
    ctx.stroke();
  }
  const inner = style.border ? pad * 1.4 : pad;

  if (style.codeType === 'barcode') {
    // باركود خطي فوق بعرض الليبل، والكلام تحته
    const barH = hasText ? (H - inner * 2) * 0.45 : H - inner * 2;
    if (code) drawCode128(ctx, code, inner, inner, W - inner * 2, barH);
    if (hasText) drawTextBlock(ctx, s, style, centerName, inner, inner + barH + pad * 0.6, W - inner * 2, H - inner * 2 - barH - pad * 0.6, 'center');
    return canvas.toDataURL('image/png');
  }

  if (style.qrPosition === 'top' || !hasText) {
    // نفس توزيع الشكل القديم تقريباً (الـ QR واخد أغلب الليبل) عشان اللي متعوّدين عليه مايتفاجئوش
    const textItems = [style.showName, style.showCode, style.showGrade, style.showCenter && !!centerName].filter(Boolean).length;
    const textH = hasText ? (H - inner * 2) * (textItems <= 2 ? 0.34 : 0.42) : 0;
    const qrSize = Math.min(H - inner * 2 - textH - (hasText ? pad * 0.4 : 0), W - inner * 2);
    if (code) await drawQr(ctx, code, (W - qrSize) / 2, inner, qrSize);
    if (hasText) drawTextBlock(ctx, s, style, centerName, inner, inner + qrSize + pad * 0.4, W - inner * 2, H - inner * 2 - qrSize - pad * 0.4, 'center');
    return canvas.toDataURL('image/png');
  }

  // QR على جنب والكلام في الباقي
  const qrSize = Math.min(H - inner * 2, (W - inner * 2) * 0.48);
  const gap = pad;
  const qrX = style.qrPosition === 'right' ? W - inner - qrSize : inner;
  if (code) await drawQr(ctx, code, qrX, (H - qrSize) / 2, qrSize);
  const textX = style.qrPosition === 'right' ? inner : inner + qrSize + gap;
  const textW = W - inner * 2 - qrSize - gap;
  drawTextBlock(ctx, s, style, centerName, textX, inner, textW, H - inner * 2, 'center');
  return canvas.toDataURL('image/png');
}
