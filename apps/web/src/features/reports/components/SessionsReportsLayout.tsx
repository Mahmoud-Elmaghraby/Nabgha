import { NavLink, Outlet } from 'react-router-dom';

const SESSIONS_REPORT_TABS = [
  { path: '/reports/sessions/list', label: 'قائمة الحصص' },
  { path: '/reports/sessions/group-attendance', label: 'حضور مجموعة' },
];

export function SessionsReportsLayout() {
  return (
    <div>
      <div className="bg-white border-b border-gray-50 px-4 sm:px-6">
        <div className="flex gap-1 overflow-x-auto">
          {SESSIONS_REPORT_TABS.map(item => (
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
