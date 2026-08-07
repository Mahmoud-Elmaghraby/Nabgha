import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

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

const MENU_WIDTH = 160; // w-40
const MENU_ESTIMATED_ITEM_HEIGHT = 38;

/**
 * قائمة إجراءات منسدلة مشتركة — تُستخدم في أي جدول عنده أكتر من 2-3 أزرار لكل صف.
 *
 * القائمة بتترسم عبر Portal في document.body بدل ما تفضل جوه الجدول — عشان
 * `overflow-x-auto` بتاعة الجدول (لازمة للتمرير الأفقي على الشاشات الصغيرة) كانت
 * بتقفل overflow-y كمان تلقائياً (سلوك CSS قياسي)، فأي قائمة بتحاول تفتح تحت آخر
 * صف (أو أي صف في جدول قصير زي أول حصة لسه بس واحدة) كانت بتتقص/تختفي بصمت.
 */
export function ActionsDropdown({ items }: Props) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; openUpward: boolean } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const visibleItems = items.filter((i) => !i.hidden);

  const computePosition = () => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const estimatedMenuHeight = visibleItems.length * MENU_ESTIMATED_ITEM_HEIGHT + 12;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < estimatedMenuHeight && rect.top > estimatedMenuHeight;

    setPosition({
      top: openUpward ? rect.top - 4 : rect.bottom + 4,
      // القائمة تفتح من ناحية شمال الزرار (نفس السلوك الأصلي left-0) — بنضمن
      // كمان إنها متطلعش برّه حدود الشاشة من ناحية اليمين
      left: Math.min(rect.left, window.innerWidth - MENU_WIDTH - 8),
      openUpward,
    });
  };

  useLayoutEffect(() => {
    if (open) computePosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    // إقفال القائمة عند أي تمرير أو تغيير حجم — بدل ما نحاول نعيد حساب موقعها
    // بالظبط في كل لحظة (أبسط وأضمن من إعادة الحساب المستمر)
    const handleScrollOrResize = () => setOpen(false);

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [open]);

  if (visibleItems.length === 0) return null;

  return (
    <>
      <button
        ref={buttonRef}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
      >
        <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      </button>

      {open && position && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: position.openUpward ? undefined : position.top,
            bottom: position.openUpward ? window.innerHeight - position.top : undefined,
            left: position.left,
            width: MENU_WIDTH,
          }}
          className="bg-white rounded-xl border border-gray-100 shadow-lg z-[60] py-1.5 overflow-hidden"
        >
          {visibleItems.map((item, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); setOpen(false); item.onClick(); }}
              className={`w-full text-right px-3.5 py-2 text-sm transition-colors ${VARIANT_CLASSES[item.variant ?? 'default']}`}
            >
              {item.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
