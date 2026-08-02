import { useState, useRef, useEffect, ReactNode } from 'react';

export interface ActionItem {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger' | 'warning' | 'success';
  hidden?: boolean;
}

interface Props {
  items: ActionItem[];
}

const VARIANT_CLASSES: Record<NonNullable<ActionItem['variant']>, string> = {
  default: 'text-gray-700 hover:bg-gray-50',
  danger: 'text-red-600 hover:bg-red-50',
  warning: 'text-amber-700 hover:bg-amber-50',
  success: 'text-emerald-700 hover:bg-emerald-50',
};

/** قائمة إجراءات منسدلة مشتركة — تُستخدم في أي جدول عنده أكتر من 2-3 أزرار لكل صف */
export function ActionsDropdown({ items }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const visibleItems = items.filter((i) => !i.hidden);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (visibleItems.length === 0) return null;

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
      >
        <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-40 bg-white rounded-xl border border-gray-100 shadow-lg z-30 py-1.5 overflow-hidden">
          {visibleItems.map((item, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); setOpen(false); item.onClick(); }}
              className={`w-full text-right px-3.5 py-2 text-sm transition-colors ${VARIANT_CLASSES[item.variant ?? 'default']}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
