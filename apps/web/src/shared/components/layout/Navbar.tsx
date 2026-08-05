import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/lib/api/client';
import { useAuthStore } from '@/shared/stores/auth.store';
import { authApi } from '@/features/auth/api/auth.api';
import type { LayoutMode } from '@/shared/hooks/useLayoutPreference';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

// ── Icons ──────────────────────────────────────────────────────
const DashboardIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
);
const StudentsIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const GroupsIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);
const TeachersIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    <path d="M16 11l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const SessionsIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
  </svg>
);
const FinanceIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
  </svg>
);
const BarcodesIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/>
  </svg>
);
const UsersIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const SpinnerIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="9"/><path d="M12 3v9l6 3"/>
  </svg>
);
const ReportsIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);
const WhatsappIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const SettingsIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);
const ChevronDownIcon = () => (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

// ── العناصر الأساسية — ظاهرة دايماً في الصف الرئيسي ──────────────
const PRIMARY_ITEMS = [
  { path: '/dashboard', label: 'الرئيسية', icon: <DashboardIcon /> },
  { path: '/students', label: 'الطلاب', icon: <StudentsIcon /> },
  { path: '/groups', label: 'المجموعات', icon: <GroupsIcon /> },
  { path: '/sessions', label: 'الحصص', icon: <SessionsIcon /> },
  { path: '/finance', label: 'المالية', icon: <FinanceIcon /> },
  { path: '/whatsapp', label: 'واتساب', icon: <WhatsappIcon />, badge: true },
];

// ── العناصر الثانوية — جوه قائمة "المزيد" ────────────────────────
const MORE_ITEMS = [
  { path: '/teachers', label: 'المدرسون', icon: <TeachersIcon /> },
  { path: '/barcodes', label: 'الباركود', icon: <BarcodesIcon /> },
  { path: '/spinner', label: 'عجلة الحظ', icon: <SpinnerIcon /> },
  { path: '/reports', label: 'التقارير', icon: <ReportsIcon /> },
  { path: '/users', label: 'المستخدمون', icon: <UsersIcon /> },
  { path: '/settings', label: 'الإعدادات', icon: <SettingsIcon /> },
];

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

  const { data: waStatus } = useQuery({
    queryKey: ['wa-status-navbar'],
    queryFn: async () => {
      const res = await apiClient.get('/whatsapp/status');
      return res.data.data as { status: string };
    },
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    retry: false,
  });
  const waDisconnected = waStatus && waStatus.status !== 'connected';

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
          <img
            src="/Logo.png"
            alt="نبغة"
            className="w-12 h-12 object-contain drop-shadow-md"
          />
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
                    {'badge' in item && item.badge && waDisconnected && (
                      <span className="absolute -top-1 -right-1.5 w-2 h-2 bg-red-500 rounded-full border border-[#0E3B2E]" />
                    )}
                  </span>
                  <span className="hidden xl:inline">{item.label}</span>
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
                <span className={isMoreActive ? 'text-[#D4AB53]' : ''}>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>
                  </svg>
                </span>
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