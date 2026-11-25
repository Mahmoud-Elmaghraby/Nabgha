import { BrandLogo } from '@/shared/components/brand/BrandLogo';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/shared/stores/auth.store';
import { authApi } from '@/features/auth/api/auth.api';
import type { LayoutMode } from '@/shared/hooks/useLayoutPreference';
import { useNavItems, useNavBadges, NavBadgeDot } from './navItems';

interface SidebarProps {
  onToggleLayout: () => void;
  currentMode: LayoutMode;
}

export function Sidebar({ onToggleLayout, currentMode }: SidebarProps) {
  const navigate = useNavigate();

  const items = useNavItems();
  const badges = useNavBadges();
  const { user, clearAuth } = useAuthStore();

  const handleLogout = async () => {
    try { await authApi.logout(); } finally {
      clearAuth();
      navigate('/auth/login');
    }
  };

  return (
    <aside className="fixed top-0 right-0 h-full w-64 bg-[#0E3B2E] flex flex-col z-50">
      {/* Logo */}
      <div className="p-5 border-b border-white/10">
        <BrandLogo size="lg" tagline glow />
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-white/15 text-white'
                  : 'text-white/60 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <div className="relative shrink-0">
              {item.icon}
              <NavBadgeDot item={item} badges={badges} />
            </div>
            <span className="flex-1">{item.label}</span>
            {item.badge === 'wa-status' && badges.waDisconnected && (
              <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full">منقطع</span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User + Toggle */}
      <div className="p-4 border-t border-white/10 space-y-2">
        {/* Toggle layout mode */}
        <button
          onClick={onToggleLayout}
          title="التبديل إلى شريط التنقل العلوي"
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-white/50 hover:bg-white/10 hover:text-white transition-all text-sm"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="3" y1="9" x2="21" y2="9"/>
          </svg>
          <span>التبديل للناف بار العلوي</span>
        </button>
        {/* Logout */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 cursor-pointer" onClick={handleLogout}>
          <div className="w-8 h-8 bg-[#D4AB53]/20 rounded-full flex items-center justify-center border border-[#D4AB53]/30">
            <span className="text-[#D4AB53] text-sm font-bold">{user?.name?.charAt(0)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.name}</p>
            <p className="text-white/50 text-xs truncate">تسجيل الخروج</p>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </div>
      </div>
    </aside>
  );
}