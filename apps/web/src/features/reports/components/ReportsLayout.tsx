import { NavLink, Outlet } from 'react-router-dom';

const REPORT_CATEGORIES = [
  { path: '/reports/students', label: 'الطلاب', icon: '👨‍🎓' },
  { path: '/reports/finance', label: 'المالية', icon: '💰' },
  { path: '/reports/sessions', label: 'الحضور والحصص', icon: '📅' },
  { path: '/reports/exams', label: 'الامتحانات والتسميعات', icon: '📝' },
];

export function ReportsLayout() {
  return (
    <div className="min-h-screen bg-[#F7F7F7]" dir="rtl">
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">التقارير</h1>
        <p className="text-sm text-gray-400 mt-0.5">توليد تقارير PDF/Excel لأي جزء من البرنامج</p>
      </div>
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 sticky top-0 z-10">
        <div className="flex gap-1 overflow-x-auto">
          {REPORT_CATEGORIES.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  isActive ? 'border-[#0E3B2E] text-[#0E3B2E]' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`
              }
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </div>
      <Outlet />
    </div>
  );
}
