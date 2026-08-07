import { NavLink, Outlet } from 'react-router-dom';

const FINANCE_NAV = [
  { path: '/finance', label: 'الرئيسية', icon: '📊', end: true },
  { path: '/finance/collect', label: 'تحصيل سريع', icon: '⚡' },
  { path: '/finance/dues', label: 'الفواتير', icon: '📋' },
  { path: '/finance/payments', label: 'الإيصالات', icon: '💰' },
  { path: '/finance/expenses', label: 'المصروفات', icon: '📤' },
  { path: '/finance/treasuries', label: 'الخزائن', icon: '🏦' },
];

export function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F7F7F7]" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">الإدارة المالية</h1>
        <p className="text-sm text-gray-400 mt-0.5">متابعة الفواتير والمدفوعات والمصروفات</p>
      </div>

      {/* Sub Nav */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 sticky top-0 z-10">
        <div className="flex gap-1 overflow-x-auto">
          {FINANCE_NAV.map(item => (
            <NavLink key={item.path} to={item.path} end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? 'border-[#0E3B2E] text-[#0E3B2E]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`
              }>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        {children}
      </div>
    </div>
  );
}
