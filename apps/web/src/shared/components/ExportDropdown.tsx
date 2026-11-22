import { useState, useRef, useEffect } from 'react';

interface Props {
  onExport: (format: 'xlsx' | 'pdf') => void;
  isExporting?: boolean;
}

export function ExportDropdown({ onExport, isExporting }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (format: 'xlsx' | 'pdf') => {
    onExport(format);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={isExporting}
        className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-sm font-medium bg-white text-[#0E3B2E] border border-gray-200 hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-50"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{isExporting ? 'جاري التصدير...' : 'تصدير'}</span>
      </button>
      {open && (
        <div className="absolute left-0 mt-2 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-20 p-1.5" dir="rtl">
          <button
            onClick={() => handleSelect('xlsx')}
            className="w-full text-right px-3 py-2 text-sm rounded-md hover:bg-gray-50 transition-colors"
          >
            Excel
          </button>
          <button
            onClick={() => handleSelect('pdf')}
            className="w-full text-right px-3 py-2 text-sm rounded-md hover:bg-gray-50 transition-colors"
          >
            PDF
          </button>
        </div>
      )}
    </div>
  );
}
