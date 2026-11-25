import { NavLink, useLocation } from 'react-router-dom';
import { useNavItems, useNavBadges, NavBadgeDot, MORE_ICON } from './navItems';

/**
 * شريط الموبايل السفلي: الصفحات الأساسية (mobile: true في navItems.tsx) + "المزيد".
 * قبل كده كان 14 صفحة بتتسحب بالعرض، ومفيش طريق لصفحة "المزيد" (ولا تسجيل الخروج).
 * صفحة "المزيد" بتعرض كل الصفحات التانية من نفس القايمة.
 */
export function MobileNav() {
  const location = useLocation();
  const items = useNavItems();
  const badges = useNavBadges();
  const tabs = items.filter((i) => i.mobile);
  const moreActive = location.pathname === '/more' || !tabs.some((t) => location.pathname.startsWith(t.path));

  const tabClass = (active: boolean) =>
    `flex-1 min-w-0 flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition-colors ${active ? 'text-[#0E3B2E]' : 'text-gray-400'}`;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      dir="rtl"
    >
      <div className="flex items-stretch px-1 py-1">
        {tabs.map((item) => (
          <NavLink key={item.path} to={item.path} className={({ isActive }) => tabClass(isActive)}>
            {({ isActive }) => (
              <>
                <span className={`relative p-1.5 rounded-xl ${isActive ? 'bg-[#0E3B2E]/10' : ''}`}>
                  {item.icon}
                  <NavBadgeDot item={item} badges={badges} ring="border-white" />
                </span>
                <span className="text-[11px] font-medium truncate max-w-full">{item.shortLabel ?? item.label}</span>
              </>
            )}
          </NavLink>
        ))}
        <NavLink to="/more" className={() => tabClass(moreActive)}>
          <span className={`relative p-1.5 rounded-xl ${moreActive ? 'bg-[#0E3B2E]/10' : ''}`}>
            {MORE_ICON}
            {badges.waDisconnected && (
              <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
            )}
          </span>
          <span className="text-[11px] font-medium">المزيد</span>
        </NavLink>
      </div>
    </nav>
  );
}
