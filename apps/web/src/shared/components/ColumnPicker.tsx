import { useState, useRef, useEffect } from 'react';

interface ColumnOption {
  key: string;
  header: string;
}

interface Props {
  options: ColumnOption[];
  visible: Set<string>;
  onToggle: (key: string) => void;
  onSave: () => void;
}

export function ColumnPicker({ options, visible, onToggle, onSave }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-sm font-medium bg-white text-[#0E3B2E] border border-gray-200 hover:bg-gray-50 active:scale-95 transition-all"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
        </svg>
        <span>الأعمدة</span>
      </button>
      {open && (
        <div className="absolute left-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-20 p-2" dir="rtl">
          <div className="max-h-64 overflow-y-auto">
            {options.map(opt => (
              <label key={opt.key} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={visible.has(opt.key)}
                  onChange={() => onToggle(opt.key)}
                  className="accent-[#0E3B2E]"
                />
                {opt.header}
              </label>
            ))}
          </div>
          <button
            onClick={async () => { await onSave(); setOpen(false); }}
            className="w-full mt-2 px-3 py-1.5 text-sm bg-[#0E3B2E] text-white rounded-md hover:bg-[#1F6B4E] transition-colors"
          >
            حفظ
          </button>
        </div>
      )}
    </div>
  );
}
