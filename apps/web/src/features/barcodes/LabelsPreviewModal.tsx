import { useEffect, useState } from 'react';
import { generateLabelImages, generateDirectLabelsPDF } from '@/shared/services/pdf/pdf.service';
import type { StudentQRData } from '@/shared/services/pdf/pdf.service';

interface Props {
  students: StudentQRData[];
  centerName: string;
  onClose: () => void;
}

const STORAGE_KEY = 'nabgha-label-size-mm';

function loadSavedSize(): { width: number; height: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.width && parsed?.height) return parsed;
    }
  } catch {}
  return { width: 38, height: 25 };
}

export function LabelsPreviewModal({ students, centerName, onClose }: Props) {
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [size, setSize] = useState(loadSavedSize);
  const [printing, setPrinting] = useState(false);
  const [printResult, setPrintResult] = useState<{ success: boolean } | null>(null);

  // توليد صور الليبلز للمعاينة
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const imgs = await generateLabelImages(students, {
          centerName,
          labelWidthMm: size.width,
          labelHeightMm: size.height,
        });
        if (!cancelled) { setImages(imgs); setLoading(false); }
      } catch {
        if (!cancelled) { setError(true); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [students, centerName, size.width, size.height]);

  const updateSize = (key: 'width' | 'height', value: number) => {
    const next = { ...size, [key]: value };
    setSize(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  };

  const handlePrint = async () => {
    if (students.length === 0) return;
    setPrinting(true);
    setPrintResult(null);

    try {
      // توليد PDF مباشرة بمقاس اللاصقة — كل صفحة = لاصقة واحدة
      await generateDirectLabelsPDF(students, {
        centerName,
        labelWidthMm: size.width,
        labelHeightMm: size.height,
      });
      setPrintResult({ success: true });
    } catch (err) {
      console.error('Print error:', err);
      setPrintResult({ success: false });
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">معاينة الطباعة</h2>
            <p className="text-xs text-gray-400 mt-0.5">{students.length} باركود</p>
          </div>
          <div className="flex items-center gap-2">
            {!loading && !error && (
              <button onClick={handlePrint} disabled={printing}
                className="flex items-center gap-1.5 text-sm bg-[#0E3B2E] text-white rounded-lg px-4 py-2 hover:bg-[#1F6B4E] transition-colors disabled:opacity-50">
                {printing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    جاري الطباعة...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 6 2 18 2 18 9"/>
                      <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
                      <rect x="6" y="14" width="12" height="8"/>
                    </svg>
                    طباعة ({images.length})
                  </>
                )}
              </button>
            )}
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
              <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* اختيار الطابعة + مقاس الليبلة */}
        <div className="px-5 py-3 border-b border-gray-50 bg-gray-50 space-y-2.5 shrink-0">
          {/* مقاس الليبلة */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 shrink-0">📐 مقاس الليبلة (مم):</span>
            <div className="flex items-center gap-1.5">
              <input type="number" min={10} max={200} value={size.width}
                onChange={e => updateSize('width', Number(e.target.value) || size.width)}
                className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center bg-white" />
              <span className="text-xs text-gray-400">×</span>
              <input type="number" min={10} max={200} value={size.height}
                onChange={e => updateSize('height', Number(e.target.value) || size.height)}
                className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center bg-white" />
            </div>
            <span className="text-xs text-gray-400">(بيتحفظ تلقائياً)</span>
          </div>
        </div>

        {/* نتيجة الطباعة */}
        {printResult && (
          <div className={`px-5 py-2.5 border-b shrink-0 ${printResult.success ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
            <p className={`text-xs font-medium ${printResult.success ? 'text-emerald-700' : 'text-red-700'}`}>
              {printResult.success
                ? `✅ تم إرسال ${images.length} لاصقة للطابعة بنجاح!`
                : `❌ فشلت الطباعة${printResult.errorType ? ` — ${printResult.errorType}` : ''}`}
            </p>
          </div>
        )}

        {/* Body — المعاينة على الشاشة */}
        <div className="flex-1 overflow-y-auto p-5 bg-gray-50">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <div className="w-6 h-6 border-2 border-[#0E3B2E] border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm">جاري تجهيز المعاينة...</p>
            </div>
          ) : error ? (
            <div className="text-center py-16 text-red-500 text-sm">
              حدث خطأ أثناء تجهيز الباركودات
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {images.map((src, i) => (
                <img key={i} src={src} alt=""
                  className="w-full border border-gray-200 rounded-lg bg-white"
                  style={{ aspectRatio: `${size.width} / ${size.height}` }} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
