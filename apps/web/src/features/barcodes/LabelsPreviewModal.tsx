import { useEffect, useState } from 'react';
import { generateLabelImages } from '@/shared/services/pdf/pdf.service';
import type { StudentQRData } from '@/shared/services/pdf/pdf.service';

interface Props {
  students: StudentQRData[];
  centerName: string;
  onClose: () => void;
}

export function LabelsPreviewModal({ students, centerName, onClose }: Props) {
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const imgs = await generateLabelImages(students, { centerName });
        if (!cancelled) { setImages(imgs); setLoading(false); }
      } catch {
        if (!cancelled) { setError(true); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [students, centerName]);

  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" dir="rtl">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #labels-print-area, #labels-print-area * { visibility: visible; }
          #labels-print-area {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
          }
          @page { size: A4; margin: 8mm; }
        }
      `}</style>

      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">معاينة الطباعة</h2>
            <p className="text-xs text-gray-400 mt-0.5">{students.length} باركود</p>
          </div>
          <div className="flex items-center gap-2">
            {!loading && !error && (
              <button onClick={handlePrint}
                className="flex items-center gap-1.5 text-sm bg-[#0E3B2E] text-white rounded-lg px-4 py-2 hover:bg-[#1F6B4E] transition-colors">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 6 2 18 2 18 9"/>
                  <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
                  <rect x="6" y="14" width="12" height="8"/>
                </svg>
                طباعة
              </button>
            )}
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
              <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
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
            <div id="labels-print-area" className="grid grid-cols-3 gap-3">
              {images.map((src, i) => (
                <img key={i} src={src} alt="" className="w-full border border-gray-200 rounded-lg bg-white" />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
