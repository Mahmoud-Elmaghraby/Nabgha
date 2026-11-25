import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/lib/api/client';
import { usePermissions } from '@/shared/hooks/usePermissions';

/**
 * قايمة الصفحات الوحيدة للبرنامج كله — الناف بار العلوي، والسايد بار، وشريط الموبايل، وصفحة "المزيد"
 * كلهم بيقروا من هنا. قبل كده كان فيه 4 قوايم منفصلة، وصفحة الامتحانات اتضافت في اتنين بس منهم.
 * صفحة جديدة = سطر واحد هنا.
 */
export type NavBadge = 'wa-status' | 'inbox-unread';

export interface NavItem {
  path: string;
  label: string;
  /** اسم أقصر لشريط الموبايل والناف بار */
  shortLabel?: string;
  icon: ReactNode;
  /** في الصف الرئيسي للناف بار العلوي (الباقي في "المزيد") */
  primary?: boolean;
  /** في شريط الموبايل السفلي (الباقي في صفحة "المزيد") */
  mobile?: boolean;
  badge?: NavBadge;
  /** الصفحة بتظهر بس لو المستخدم عنده الصلاحية دي */
  permission?: string;
}

const Svg = ({ children }: { children: ReactNode }) => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

export const NAV_ITEMS: NavItem[] = [
  { path: '/dashboard', label: 'لوحة التحكم', shortLabel: 'الرئيسية', primary: true, mobile: true, icon: (
    <Svg><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></Svg>
  )},
  { path: '/students', label: 'الطلاب', primary: true, mobile: true, icon: (
    <Svg><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></Svg>
  )},
  { path: '/groups', label: 'المجموعات', primary: true, icon: (
    <Svg><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></Svg>
  )},
  { path: '/sessions', label: 'الحصص', primary: true, mobile: true, icon: (
    <Svg><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></Svg>
  )},
  { path: '/exams', label: 'بنك الأسئلة والامتحانات', shortLabel: 'الامتحانات', primary: true, icon: (
    <Svg><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></Svg>
  )},
  { path: '/finance', label: 'المالية', primary: true, icon: (
    <Svg><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></Svg>
  )},
  { path: '/inbox', label: 'المحادثات', primary: true, mobile: true, badge: 'inbox-unread', permission: 'inbox.view', icon: (
    <Svg><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="13" x2="13" y2="13"/></Svg>
  )},
  { path: '/whatsapp', label: 'واتساب', primary: true, badge: 'wa-status', icon: (
    <Svg><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></Svg>
  )},
  { path: '/teachers', label: 'المدرسون', icon: (
    <Svg><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><path d="M16 11l2 2 4-4"/></Svg>
  )},
  { path: '/barcodes', label: 'الباركود', icon: (
    <Svg><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/></Svg>
  )},
  { path: '/spinner', label: 'عجلة الحظ', icon: (
    <Svg><circle cx="12" cy="12" r="9"/><path d="M12 3v9l6 3"/></Svg>
  )},
  { path: '/reports', label: 'التقارير', icon: (
    <Svg><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></Svg>
  )},
  { path: '/telegram', label: 'تليجرام', icon: (
    <Svg><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></Svg>
  )},
  { path: '/users', label: 'المستخدمون', icon: (
    <Svg><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></Svg>
  )},
  { path: '/settings', label: 'الإعدادات', icon: (
    <Svg><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></Svg>
  )},
];

export const MORE_ICON = (
  <Svg><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></Svg>
);

/** الصفحات اللي المستخدم يقدر يشوفها */
export function useNavItems(): NavItem[] {
  const { hasPermission } = usePermissions();
  return NAV_ITEMS.filter((i) => !i.permission || hasPermission(i.permission));
}

/** حالة الشارات: الواتساب مقطوع، وعدد المحادثات اللي فيها رسايل مش مقروءة */
export function useNavBadges(): { waDisconnected: boolean; inboxUnread: number } {
  const { hasPermission } = usePermissions();
  const { data: waStatus } = useQuery({
    queryKey: ['wa-status-nav'],
    queryFn: async () => (await apiClient.get('/whatsapp/status')).data.data as { status: string },
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    retry: false,
  });
  const { data: unread } = useQuery({
    queryKey: ['inbox-unread'],
    queryFn: async () => (await apiClient.get('/inbox/unread-count')).data.data as { messages: number; conversations: number },
    enabled: hasPermission('inbox.view'),
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
    retry: false,
  });
  return {
    waDisconnected: !!waStatus && waStatus.status !== 'connected',
    inboxUnread: unread?.conversations ?? 0,
  };
}

/** الشارة الصغيرة فوق الأيقونة */
export function NavBadgeDot({ item, badges, ring = 'border-[#0E3B2E]' }: {
  item: NavItem;
  badges: { waDisconnected: boolean; inboxUnread: number };
  ring?: string;
}) {
  if (item.badge === 'wa-status' && badges.waDisconnected) {
    return <span className={`absolute -top-1 -right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 ${ring}`} />;
  }
  if (item.badge === 'inbox-unread' && badges.inboxUnread > 0) {
    return (
      <span className={`absolute -top-2 -right-2.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full border-2 ${ring} flex items-center justify-center leading-none`}>
        {badges.inboxUnread > 99 ? '99+' : badges.inboxUnread.toLocaleString('ar-EG')}
      </span>
    );
  }
  return null;
}
