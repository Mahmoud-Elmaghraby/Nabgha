import { useEffect, useMemo, useState } from 'react';
import { generateLabelImages, generateDirectLabelsPDF } from '@/shared/services/pdf/pdf.service';
import type { StudentQRData } from '@/shared/services/pdf/pdf.service';
import {
  loadLabelStyle, saveLabelStyle,
  type LabelStyle, type QrPosition, type CodeType, type NameSize,
} from '@/shared/services/pdf/label-renderer';

interface Props {
  students: StudentQRData[];
  /** عدد النسخ لكل طالب (id → عدد) */
  copies: Record<string, number>;
  centerName: string;
  onClose: () => void;
}

const STORAGE_KEY = 'nabgha-label-size-mm';
const PRESET_SIZES = [
  { w: 38, h: 25, label: '38×25' },
  { w: 40, h: 30, label: '40×30' },
  { w: 50, h: 30, label: '50×30' },
  { w: 50, h: 25, label: '50×25' },
  { w: 60, h: 40, label: '60×40' },
];

function loadSavedSize(): { width: number; height: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.width && parsed?.height) return parsed;
    }
  } catch { /* ignore */ }
  return { width: 38, height: 25 };
}

// ─── أزرار اختيار صغيرة ─────────────────────────────────────
function Seg<T extends string>({ value, options, onChange }: {
  value: T; options: Array<{ v: T; label: string; icon?: string }>; onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
      {options.map((o) => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)}
          className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${value === o.v ? 'bg-white shadow text-[#0E3B2E]' : 'text-gray-500'}`}>
          {o.icon && <span className="ml-1">{o.icon}</span>}{o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer select-none ${
      checked ? 'border-[#0E3B2E] bg-[#0E3B2E]/5 text-[#0E3B2E] font-semibold' : 'border-gray-200 text-gray-500'
    }`}>
      <input type="checkbox" className="hidden" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {checked ? '✓' : '+'} {label}
    </label>
  );
}

export function LabelsPreviewModal({ students, copies, centerName, onClose }: Props) {
  const [images, setImages]   = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [size, setSize]       = useState(loadSavedSize);
  const [style, setStyle]     = useState<LabelStyle>(loadLabelStyle);
  const [printing, setPrinting] = useState(false);
  const [printResult, setPrintResult] = useState<{ success: boolean; count?: number } | null>(null);

  const copiesOf = (id: string) => Math.max(1, copies[id] ?? 1);
  const totalLabels = students.reduce((a, s) => a + copiesOf(s.id), 0);

  const updateStyle = (patch: Partial<LabelStyle>) => {
    const next = { ...style, ...patch };
    setStyle(next);
    saveLabelStyle(next);
  };

  // المعاينة لأول 12 طالب بس عشان أي تغيير يبان على طول — الطباعة بتشمل الكل
  const previewStudents = useMemo(() => students.slice(0, 12), [students]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const imgs = await generateLabelImages(previewStudents, {
          centerName, labelWidthMm: size.width, labelHeightMm: size.height, style,
        });
        if (!cancelled) { setImages(imgs); setLoading(false); setError(false); }
      } catch {
        if (!cancelled) { setError(true); setLoading(false); }
      }
    }, 150);
    return () => { cancelled = true; clearTimeout(t); };
  }, [previewStudents, centerName, size.width, size.height, style]);

  const updateSize = (next: { width: number; height: number }) => {
    setSize(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const handlePrint = async () => {
    if (students.length === 0) return;
    setPrinting(true);
    setPrintResult(null);
    try {
      // كل طالب بيتكرر بعدد نسخه ورا بعض (عشان ليبلات ملازمه تطلع مع بعض)
      const expanded = students.flatMap((s) => Array.from({ length: copiesOf(s.id) }, () => s));
      await generateDirectLabelsPDF(expanded, {
        centerName, labelWidthMm: size.width, labelHeightMm: size.height, style,
      });
      setPrintResult({ success: true, count: expanded.length });
    } catch (err) {
      console.error('Print error:', err);
      setPrintResult({ success: false });
    } finally {
      setPrinting(false);
    }
  };

  const textCount = [style.showName, style.showCode, style.showGrade, style.showCenter].filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">طباعة مباشرة على طابعة الليبل</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {students.length} طالب — {totalLabels} ليبل{totalLabels !== students.length ? ' (بالنسخ)' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} disabled={printing || loading || error}
              className="flex items-center gap-1.5 text-sm bg-[#0E3B2E] text-white rounded-lg px-4 py-2 hover:bg-[#1F6B4E] transition-colors disabled:opacity-50">
              {printing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  جاري التجهيز...
                </>
              ) : (
                <>🖨️ طباعة ({totalLabels})</>
              )}
            </button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
              <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto grid md:grid-cols-[300px_1fr]">
          {/* الإعدادات */}
          <div className="p-4 border-b md:border-b-0 md:border-l border-gray-100 space-y-4 bg-gray-50/60">
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1.5">📐 مقاس الليبل (مم)</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {PRESET_SIZES.map((p) => (
                  <button key={p.label} type="button" onClick={() => updateSize({ width: p.w, height: p.h })}
                    className={`px-2 py-1 rounded-md text-xs border ${size.width === p.w && size.height === p.h ? 'border-[#0E3B2E] bg-[#0E3B2E] text-white' : 'border-gray-200 bg-white text-gray-600'}`}>
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <input type="number" min={15} max={200} value={size.width}
                  onChange={(e) => updateSize({ ...size, width: Number(e.target.value) || size.width })}
                  className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center bg-white" />
                <span className="text-xs text-gray-400">عرض ×</span>
                <input type="number" min={10} max={200} value={size.height}
                  onChange={(e) => updateSize({ ...size, height: Number(e.target.value) || size.height })}
                  className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center bg-white" />
                <span className="text-xs text-gray-400">ارتفاع</span>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1.5">شكل الكود</p>
              <Seg<CodeType> value={style.codeType} onChange={(v) => updateStyle({ codeType: v })}
                options={[{ v: 'qr', label: 'QR مربع', icon: '▦' }, { v: 'barcode', label: 'باركود خطي', icon: '║' }]} />
              {style.codeType === 'barcode' && (
                <p className="text-[11px] text-amber-600 mt-1">الباركود الخطي بيتقري بالسكانر بس (أغلب السكانرات بتقراه) — كاميرا البرنامج بتقرا QR بس.</p>
              )}
            </div>

            {style.codeType === 'qr' && (
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-1.5">مكان الـ QR</p>
                <Seg<QrPosition> value={style.qrPosition} onChange={(v) => updateStyle({ qrPosition: v })}
                  options={[{ v: 'right', label: 'يمين' }, { v: 'top', label: 'فوق' }, { v: 'left', label: 'شمال' }]} />
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1.5">اللي يظهر على الليبل</p>
              <div className="flex flex-wrap gap-1.5">
                <Toggle checked={style.showName} onChange={(v) => updateStyle({ showName: v })} label="اسم الطالب" />
                <Toggle checked={style.showCode} onChange={(v) => updateStyle({ showCode: v })} label="الكود" />
                <Toggle checked={style.showGrade} onChange={(v) => updateStyle({ showGrade: v })} label="المرحلة" />
                <Toggle checked={style.showCenter} onChange={(v) => updateStyle({ showCenter: v })} label="اسم السنتر" />
                <Toggle checked={style.border} onChange={(v) => updateStyle({ border: v })} label="إطار" />
              </div>
            </div>

            {style.showName && (
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-1.5">حجم الاسم</p>
                <Seg<NameSize> value={style.nameSize} onChange={(v) => updateStyle({ nameSize: v })}
                  options={[{ v: 'normal', label: 'عادي' }, { v: 'large', label: 'كبير' }]} />
              </div>
            )}

            {textCount >= 3 && size.height <= 25 && (
              <p className="text-[11px] text-amber-600">الليبل صغير على كل البيانات دي والكلام هيصغر — جرّب مقاس أكبر أو QR على الجنب.</p>
            )}
            <p className="text-[11px] text-gray-400">الإعدادات بتتحفظ على الجهاز ده.</p>
          </div>

          {/* المعاينة */}
          <div className="p-5 bg-gray-50">
            {printResult && (
              <div className={`mb-4 px-3 py-2 rounded-lg text-xs font-medium ${printResult.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {printResult.success
                  ? `✅ اتجهّز ${printResult.count} ليبل — اطبع من النافذة اللي اتفتحت بمقاس "الحجم الفعلي".`
                  : '❌ حصل خطأ أثناء تجهيز الطباعة'}
              </div>
            )}
            {loading && images.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <div className="w-6 h-6 border-2 border-[#0E3B2E] border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-sm">جاري تجهيز المعاينة...</p>
              </div>
            ) : error ? (
              <div className="text-center py-16 text-red-500 text-sm">حصل خطأ أثناء تجهيز المعاينة</div>
            ) : (
              <>
                <div className={`grid gap-3 ${size.width / size.height > 1.8 ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-3'} ${loading ? 'opacity-60' : ''}`}>
                  {images.map((src, i) => {
                    const s = previewStudents[i];
                    const n = s ? copiesOf(s.id) : 1;
                    return (
                      <div key={i} className="relative">
                        <img src={src} alt=""
                          className="w-full border border-gray-300 rounded-md bg-white shadow-sm"
                          style={{ aspectRatio: `${size.width} / ${size.height}` }} />
                        {n > 1 && (
                          <span className="absolute -top-2 -left-2 bg-[#D4AB53] text-[#0E3B2E] text-xs font-black rounded-full px-2 py-0.5 shadow">×{n}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {students.length > previewStudents.length && (
                  <p className="text-xs text-gray-400 text-center mt-4">المعاينة لأول {previewStudents.length} طالب — الطباعة هتشمل الكل</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
