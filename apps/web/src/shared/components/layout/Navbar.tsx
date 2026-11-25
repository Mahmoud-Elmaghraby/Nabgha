import { BrandMark } from '@/shared/components/brand/BrandLogo';
import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/shared/stores/auth.store';
import { authApi } from '@/features/auth/api/auth.api';
import type { LayoutMode } from '@/shared/hooks/useLayoutPreference';
import { useNavItems, useNavBadges, NavBadgeDot, MORE_ICON } from './navItems';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

// ── Icons ──────────────────────────────────────────────────────
const ChevronDownIcon = () => (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

// ── Icon button helper ───────────────────────────────────────────
function IconBtn({
  onClick, title, active, children,
}: {
  onClick?: () => void;
  title: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${
        active
          ? 'bg-white/20 text-white shadow-inner'
          : 'text-white/60 hover:bg-white/10 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

// ── Props ──────────────────────────────────────────────────────
interface NavbarProps {
  onToggleLayout: () => void;
  currentMode: LayoutMode;
  splitMode: boolean;
  onSplitMode: () => void;
  onShowQr: () => void;
}

export function Navbar({ onToggleLayout, currentMode, splitMode, onSplitMode, onShowQr }: NavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // القايمة الموحدة (navItems.tsx): الصفحات الأساسية في الصف، والباقي في "المزيد"
  const items = useNavItems();
  const PRIMARY_ITEMS = items.filter((i) => i.primary);
  const MORE_ITEMS = items.filter((i) => !i.primary);
  const badges = useNavBadges();

  const { user, clearAuth } = useAuthStore();
  const handleLogout = async () => {
    try { await authApi.logout(); } finally {
      clearAuth();
      navigate('/auth/login');
    }
  };

  // "المزيد" تتفعّل بصرياً لو المستخدم واقف حالياً في أي صفحة من صفحاتها
  const isMoreActive = MORE_ITEMS.some((item) => location.pathname.startsWith(item.path));

  return (
    <header
      className="fixed top-0 right-0 left-0 z-50 bg-[#0E3B2E]"
      style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}
      dir="rtl"
    >
      <div className="flex items-center justify-between h-[72px] px-6 gap-4">
        {/* ── Logo (Right) ── */}
        <div className="flex items-center gap-3 shrink-0">
          <BrandMark size="md" glow />
          <div className="leading-tight hidden lg:block">
            <h1 className="text-white font-black text-2xl tracking-wider drop-shadow-sm">نبغة</h1>
          </div>
        </div>

        {/* ── Main Nav Items (Center) ── */}
        <nav className="flex items-center justify-center gap-1 xl:gap-2 flex-1 min-w-0 px-2">
          {PRIMARY_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              title={item.label}
              className={({ isActive }) =>
                `relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-bold whitespace-nowrap transition-all group ${
                  isActive
                    ? 'text-white'
                    : 'text-white/50 hover:bg-white/5 hover:text-white/90'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`relative transition-all duration-300 ${isActive ? 'text-[#D4AB53]' : 'group-hover:scale-110'}`}>
                    {item.icon}
                    <NavBadgeDot item={item} badges={badges} />
                  </span>
                  <span className="hidden xl:inline">{item.shortLabel ?? item.label}</span>
                  {isActive && (
                    <span className="absolute bottom-0 right-3 left-3 h-[3px] bg-[#D4AB53] rounded-t-md shadow-[0_0_8px_rgba(212,171,83,0.6)]" />
                  )}
                </>
              )}
            </NavLink>
          ))}

          {/* ── المزيد (More) ── */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-bold whitespace-nowrap transition-all ${
                  isMoreActive
                    ? 'text-white'
                    : 'text-white/50 hover:bg-white/5 hover:text-white/90'
                }`}
              >
                <span className={isMoreActive ? 'text-[#D4AB53]' : ''}>{MORE_ICON}</span>
                <span className="hidden xl:inline">المزيد</span>
                <ChevronDownIcon />
                {isMoreActive && (
                  <span className="absolute bottom-0 right-3 left-3 h-[3px] bg-[#D4AB53] rounded-t-md shadow-[0_0_8px_rgba(212,171,83,0.6)]" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="min-w-[180px]" dir="rtl">
              {MORE_ITEMS.map((item) => (
                <DropdownMenuItem key={item.path} asChild>
                  <NavLink
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center gap-2 w-full ${isActive ? 'text-[#0E3B2E] font-bold' : ''}`
                    }
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </NavLink>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        {/* ── Actions & Profile (Left) ── */}
        <div className="flex items-center justify-end gap-3 shrink-0">
          <div className="flex items-center gap-1 border-l border-white/10 pl-3">
            {/* QR mobile */}
            <IconBtn onClick={onShowQr} title="افتح على الموبايل">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <rect x="14" y="17" width="3" height="3" rx="0.5"/>
                <rect x="19" y="14" width="2" height="2" rx="0.5"/>
                <rect x="14" y="14" width="2" height="2" rx="0.5"/>
              </svg>
            </IconBtn>
            {/* Split screen */}
            <IconBtn onClick={onSplitMode} title="وضع الشاشة المنقسمة" active={splitMode}>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <line x1="12" y1="3" x2="12" y2="21"/>
              </svg>
            </IconBtn>
            {/* Layout toggle */}
            <IconBtn onClick={onToggleLayout} title={currentMode === 'navbar' ? 'تبديل للقائمة الجانبية' : 'تبديل للنافبار'}>
              {currentMode === 'navbar' ? (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <line x1="9" y1="3" x2="9" y2="21"/>
                </svg>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <line x1="3" y1="9" x2="21" y2="9"/>
                </svg>
              )}
            </IconBtn>
          </div>
          {/* User Profile */}
          <button
            onClick={handleLogout}
            title="تسجيل الخروج"
            className="flex items-center gap-3 rounded-xl hover:bg-white/5 transition-all shrink-0 p-1.5 pr-3"
          >
            <div className="text-right hidden xl:block">
              <p className="text-white text-sm font-bold leading-tight max-w-[100px] truncate">{user?.name}</p>
              <p className="text-white/40 text-xs mt-0.5">تسجيل الخروج</p>
            </div>
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 border-[#D4AB53]/30 shadow-sm"
              style={{ background: 'rgba(212,171,83,0.15)' }}
            >
              <span className="text-[#D4AB53] text-lg font-black">{user?.name?.charAt(0)}</span>
            </div>
          </button>
        </div>
      </div>
    </header>
  );
}