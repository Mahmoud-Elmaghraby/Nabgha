/**
 * طباعة HTML في iframe معزول — بدل window.print() على صفحة البرنامج كلها.
 *
 * ليه (FIN-013): الإيصال كان بيتطبع من صفحة البرنامج بخدعة "اخفي كل حاجة إلا الإيصال"
 * و position: fixed. Chrome بيكرر أي عنصر fixed في كل صفحة، والصفحة المخفية كانت أطول من
 * صفحة واحدة، فالإيصال كان بيطلع نسختين، وبينهم ورق فاضي (طول الصفحة كان ثابت 150مم).
 * هنا الـ iframe فيه الإيصال لوحده، وطول الصفحة بيتقاس بعد ما الخطوط تحمّل، فبتطلع
 * صفحة واحدة بطول الإيصال بالظبط.
 */
export interface PrintHtmlOptions {
  /** عرض الورق بالمليمتر (80 لطابعة الإيصالات) */
  pageWidthMm: number;
  /** null = الطول على قد المحتوى (ورق رول). رقم = طول ثابت (A4 مثلاً 297) */
  pageHeightMm?: number | null;
  /** مسافة زيادة تحت المحتوى بالمليمتر عشان القصّاعة مايقصّش آخر سطر */
  bottomPaddingMm?: number;
  title?: string;
}

const PX_PER_MM = 96 / 25.4;

/** بيبني مستند الطباعة (منفصل عشان يتجرّب لوحده) */
export function buildPrintDocument(bodyHtml: string, css: string, opts: PrintHtmlOptions, heightMm?: number): string {
  const size = heightMm ? `${opts.pageWidthMm}mm ${heightMm}mm` : `${opts.pageWidthMm}mm auto`;
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${opts.title ?? ''}</title>
<style>
@page { size: ${size}; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; }
body { width: ${opts.pageWidthMm}mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
${css}
</style></head><body>${bodyHtml}</body></html>`;
}

export async function printHtml(bodyHtml: string, css: string, opts: PrintHtmlOptions): Promise<void> {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = `position:fixed;left:-10000px;top:0;width:${opts.pageWidthMm}mm;height:10px;border:0;opacity:0;pointer-events:none;`;
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = iframe.contentDocument;
  if (!win || !doc) {
    iframe.remove();
    throw new Error('print frame unavailable');
  }

  const write = (heightMm?: number) => {
    doc.open();
    doc.write(buildPrintDocument(bodyHtml, css, opts, heightMm));
    doc.close();
  };

  write();
  // نستنى الخطوط والصور عشان القياس يبقى صح على أي جهاز (المشكلة اللي كانت بتخلّي القياس مش ثابت قبل كده)
  try { await (doc as any).fonts?.ready; } catch { /* ignore */ }
  await Promise.all(Array.from(doc.images).map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; }))));
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  if (opts.pageHeightMm === undefined || opts.pageHeightMm === null) {
    const contentPx = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
    const heightMm = Math.ceil(contentPx / PX_PER_MM + (opts.bottomPaddingMm ?? 4));
    write(heightMm);
    try { await (doc as any).fonts?.ready; } catch { /* ignore */ }
  } else {
    write(opts.pageHeightMm);
  }

  await new Promise<void>((resolve) => {
    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      setTimeout(() => iframe.remove(), 500);
      resolve();
    };
    win.addEventListener('afterprint', cleanup, { once: true });
    win.focus();
    win.print();
    // print() بيستنى لحد ما الديالوج يتقفل في Chrome/Electron، بس احتياطي لو afterprint ماجاش
    setTimeout(cleanup, 60_000);
  });
}
