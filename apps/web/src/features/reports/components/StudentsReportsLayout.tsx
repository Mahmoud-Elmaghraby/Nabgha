import { NavLink, Outlet } from 'react-router-dom';

const STUDENT_REPORT_TABS = [
  { path: '/reports/students/list', label: 'قائمة الطلاب' },
  { path: '/reports/students/statement', label: 'كشف حساب طالب' },
  { path: '/reports/students/absence', label: 'الغياب المتكرر' },
  { path: '/reports/students/attendance', label: 'حضور طالب' },
  { path: '/reports/students/grades', label: 'درجات طالب' },
  { path: '/reports/students/monthly', label: 'التقارير الشهرية' },
];

export function StudentsReportsLayout() {
  return (
    <div>
      <div className="bg-white border-b border-gray-50 px-4 sm:px-6">
        <div className="flex gap-1 overflow-x-auto">
          {STUDENT_REPORT_TABS.map(item => (
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
