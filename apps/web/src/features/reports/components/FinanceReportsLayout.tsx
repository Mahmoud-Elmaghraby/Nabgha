import { NavLink, Outlet } from 'react-router-dom';
import { usePermissions } from '@/shared/hooks/usePermissions';

const FINANCE_REPORT_TABS = [
  { path: '/reports/finance/collections', label: 'تقرير التحصيل' },
  { path: '/reports/finance/overdue', label: 'المستحقات المتأخرة' },
  { path: '/reports/finance/monthly-status', label: 'مستحقات الشهر' },
];

export function FinanceReportsLayout() {
  const { hasPermission } = usePermissions();

  if (!hasPermission('finance.view')) {
    return (
      <div className="p-8 text-center text-gray-400">
        <p className="text-sm">مالك صلاحية لعرض التقارير المالية</p>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-white border-b border-gray-50 px-4 sm:px-6">
        <div className="flex gap-1 overflow-x-auto">
          {FINANCE_REPORT_TABS.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  isActive ? 'border-[#0E3B2E] text-[#0E3B2E]' : 'border-transparent text-gray-400 hover:text-gray-600'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </div>
      <div className="p-4 sm:p-6">
        <Outlet />
      </div>
    </div>
  );
}
