import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/shared/stores/auth.store';
import { authApi } from '@/features/auth/api/auth.api';
import { useNavItems, useNavBadges } from '@/shared/components/layout/navItems';

export default function MorePage() {
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();
  // كل الصفحات اللي مش في شريط الموبايل (القايمة الموحدة navItems.tsx)
  const MORE_ITEMS = useNavItems().filter((i) => !i.mobile);
  const badges = useNavBadges();

  const handleLogout = async () => {
    try { await authApi.logout(); } finally {
      clearAuth();
      navigate('/auth/login');
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F7F7] pb-24" dir="rtl">
      <div className="bg-[#0E3B2E] px-5 py-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
            <span className="text-white text-xl font-bold">{user?.name?.charAt(0)}</span>
          </div>
          <div>
            <p className="text-white font-bold text-lg">{user?.name}</p>
            <p className="text-white/60 text-sm">{user?.role === 'tenant_admin' ? 'مدير المركز' : user?.role}</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-2">
        {MORE_ITEMS.map(item => (
          <button key={item.path} onClick={() => navigate(item.path)}
            className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100 hover:border-gray-200 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-[#0E3B2E]/10 flex items-center justify-center text-[#0E3B2E] shrink-0">
              {item.icon}
            </div>
            <span className="text-sm font-medium text-gray-900">{item.label}</span>
            {item.badge === 'wa-status' && badges.waDisconnected && (
              <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full">منقطع</span>
            )}
            <svg className="w-4 h-4 text-gray-300 mr-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round"/>
            </svg>
          </button>
        ))}

        <button onClick={handleLogout}
          className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border border-red-100 hover:border-red-200 transition-colors mt-4">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-500 shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </div>
          <span className="text-sm font-medium text-red-500">تسجيل الخروج</span>
        </button>
      </div>
    </div>
  );
}
