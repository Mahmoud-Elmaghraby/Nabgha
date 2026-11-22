import { BrandMark } from '@/shared/components/brand/BrandLogo';
import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useParentAuthStore } from '../stores/parent-auth.store';

export function ParentPortalLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { slug, clearAuth } = useParentAuthStore();

  const handleLogout = () => {
    const s = slug;
    clearAuth();
    navigate(s ? `/parent/${s}/login` : '/parent');
  };

  return (
    <div className="min-h-screen bg-[#F7F7F7]" dir="rtl">
      <header className="bg-[#0E3B2E] text-white sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BrandMark size="sm" glow />
            <div>
              <p className="text-sm font-bold leading-none">نبغة</p>
              <p className="text-white/60 text-[11px] leading-none mt-0.5">بوابة أولياء الأمور</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-white/80 hover:text-white text-xs"
          >
            <LogOut size={15} />
            خروج
          </button>
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
