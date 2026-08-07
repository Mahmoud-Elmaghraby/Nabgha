import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/shared/stores/auth.store';
import { apiClient } from '@/shared/lib/api/client';
import { useSessions } from '@/features/sessions/hooks/useSessions';
import { SessionFormModal } from '@/features/sessions/components/SessionFormModal';
import { useGroups } from '@/features/groups/hooks/useGroups';
import type { DayOfWeek } from '@/features/groups/types/group.types';
import { usePermissions } from '@/shared/hooks/usePermissions';

function useStudentsCount() {
  return useQuery({
    queryKey: ['dashboard', 'students-count'],
    queryFn: async () => {
      const res = await apiClient.get('/students', { params: { limit: 1, page: 1 } });
      return (res.data.data?.total ?? 0) as number;
    },
    staleTime: 1000 * 60 * 5,
  });
}

// ترتيب أيام JS Date.getDay() (0 = الأحد) بالمقابل لقيم DayOfWeek المستخدمة في جدول المجموعات
const JS_DAY_TO_DAY_OF_WEEK: DayOfWeek[] = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
];

function useFinanceStats() {
  const month = new Date().toISOString().slice(0, 7);
  return useQuery({
    queryKey: ['dashboard', 'finance-stats', month],
    queryFn: async () => {
      const res = await apiClient.get('/finance/stats', { params: { month } });
      return res.data.data as {
        totalDues: number; totalCollected: number; totalPending: number;
        totalExpenses: number; paidCount: number; unpaidCount: number; duesCount: number;
      };
    },
    staleTime: 1000 * 60 * 2,
  });
}

function useTreasuries() {
  return useQuery({
    queryKey: ['dashboard', 'treasuries'],
    queryFn: async () => {
      const res = await apiClient.get('/finance/treasuries');
      return (Array.isArray(res.data.data) ? res.data.data : []) as any[];
    },
    staleTime: 1000 * 60 * 2,
  });
}

const SESSION_TYPE_LABELS: Record<string, string> = {
  lesson: 'حصة', lesson_revision: 'مراجعة', lesson_exam: 'اختبار درس',
  exam: 'امتحان', grade_exam: 'امتحان مرحلة',
};

const SESSION_STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-50 text-blue-600 border-blue-200',
  ongoing: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  completed: 'bg-gray-50 text-gray-500 border-gray-200',
  cancelled: 'bg-red-50 text-red-500 border-red-200',
};

const SESSION_STATUS_LABELS: Record<string, string> = {
  scheduled: 'مجدولة', ongoing: 'جارية', completed: 'منتهية', cancelled: 'ملغاة',
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { hasPermission } = usePermissions();
  const { data: studentsCount = 0 } = useStudentsCount();

  const todayIso = new Date().toISOString().split('T')[0];
  // استخدام نفس الـ hook والـ query keys المستخدمين في باقي شاشات الحصص (useSessions)
  // بدل query منفصلة معزولة — عشان أي حصة تتنشئ (حتى من زرار "إنشاء" السريع هنا)
  // تعمل invalidate صح وتظهر فوراً من غير ما نستنى الـ refetchInterval.
  const { data: sessionsData, isLoading: loadingSessions } = useSessions({ from: todayIso, to: todayIso, limit: 50 });
  const todaySessions = sessionsData?.data ?? [];
  const { data: stats, isLoading: loadingStats } = useFinanceStats();
  const { data: treasuries = [] } = useTreasuries();
  const { data: groupsData } = useGroups({ limit: 1000 });

  const [createForGroup, setCreateForGroup] = useState<{ id: string; name: string } | null>(null);

  const month = new Date().toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
  const today = new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });
  const ongoingSessions = Array.isArray(todaySessions) ? todaySessions.filter(s => s.status === 'ongoing') : [];
  const collectionRate = stats && stats.totalDues > 0
    ? Math.min(100, Math.round((stats.totalCollected / stats.totalDues) * 100))
    : null;

  // المجموعات النشطة اللي عندها ميعاد النهاردة في جدولها الأسبوعي ولسه ملهاش حصة
  // متعملة — عشان نعرضها في نفس الودجت مع زرار "إنشاء" سريع بدل ما المدرس يفتح
  // شاشة الحصص ويدور عليها يدوي.
  const todayDayOfWeek = JS_DAY_TO_DAY_OF_WEEK[new Date().getDay()];
  const existingGroupIds = new Set(todaySessions.map(s => s.groupId).filter((id): id is string => !!id));
  const groups = groupsData?.data ?? [];
  const missingGroupSessions = groups
    .filter(g => g.isActive && !existingGroupIds.has(g.id))
    .map(g => ({ group: g, scheduleItem: g.schedule.find(s => s.day === todayDayOfWeek) }))
    .filter((x): x is { group: typeof groups[number]; scheduleItem: NonNullable<typeof x.scheduleItem> } => !!x.scheduleItem)
    .sort((a, b) => a.scheduleItem.startTime.localeCompare(b.scheduleItem.startTime));

  return (
    <div className="min-h-screen bg-[#F7F7F7]" dir="rtl">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-6 space-y-6">

        {/* ===== هيدر ترحيبي ===== */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-[#0E3B2E] to-[#155C46] px-6 py-7 md:px-8 md:py-8 shadow-sm">
          <div
            className="pointer-events-none absolute -left-10 -top-10 w-56 h-56 rounded-full bg-white/5"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute left-24 bottom-[-3rem] w-40 h-40 rounded-full bg-[#D4AB53]/10"
            aria-hidden="true"
          />
          <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white">مرحباً، {user?.name} 👋</h1>
              <p className="text-sm text-white/60 mt-1">{today} — {month}</p>
            </div>
            {ongoingSessions.length > 0 && (
              <div className="flex items-center gap-2 bg-white/10 border border-white/15 rounded-2xl px-4 py-2 w-fit">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <p className="text-sm text-white font-medium">{ongoingSessions.length} حصة جارية الآن</p>
              </div>
            )}
          </div>
        </div>

        {/* ===== إحصائيات سريعة ===== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* الطلاب */}
          <button onClick={() => navigate('/students')}
            className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm text-right hover:shadow-md hover:border-[#0E3B2E]/20 transition-all">
            <div className="w-10 h-10 rounded-xl bg-[#0E3B2E]/10 flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-[#0E3B2E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <p className="text-2xl font-bold text-gray-900">{studentsCount}</p>
            <p className="text-xs text-gray-400 mt-1">طالب نشط</p>
          </button>

          {/* الحصص النهارده */}
          <button onClick={() => navigate('/sessions')}
            className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm text-right hover:shadow-md hover:border-[#0E3B2E]/20 transition-all">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <p className="text-2xl font-bold text-gray-900">{loadingSessions ? '...' : todaySessions.length}</p>
            <p className="text-xs text-gray-400 mt-1">حصة اليوم</p>
            {ongoingSessions.length > 0 && (
              <p className="text-xs text-emerald-600 font-medium mt-1.5">{ongoingSessions.length} جارية الآن</p>
            )}
          </button>

          {/* التحصيل الشهر */}
          <button onClick={() => navigate('/finance')}
            className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm text-right hover:shadow-md hover:border-[#0E3B2E]/20 transition-all">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" strokeLinecap="round"/>
              </svg>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {loadingStats ? '...' : (stats?.totalCollected ?? 0).toLocaleString('ar-EG')}
            </p>
            <p className="text-xs text-gray-400 mt-1">تحصيل {month}</p>
          </button>

          {/* الفواتير المفتوحة */}
          <button onClick={() => navigate('/finance/dues')}
            className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm text-right hover:shadow-md hover:border-[#0E3B2E]/20 transition-all">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {loadingStats ? '...' : (stats?.unpaidCount ?? 0)}
            </p>
            <p className="text-xs text-gray-400 mt-1">فاتورة غير مدفوعة</p>
          </button>
        </div>

        {/* ===== المحتوى الرئيسي: عمودين على الديسكتوب ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* --- العمود الرئيسي (٢/٣) --- */}
          <div className="lg:col-span-2 space-y-5">

            {/* ملخص مالي الشهر */}
            {stats && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-gray-800">الملخص المالي — {month}</h2>
                  <button onClick={() => navigate('/finance')}
                    className="text-xs text-[#0E3B2E] font-medium hover:underline">عرض الكل</button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center bg-gray-50 rounded-xl py-3">
                    <p className="text-xs text-gray-400 mb-1">إجمالي الفواتير</p>
                    <p className="text-base font-bold text-gray-800">{stats.totalDues.toLocaleString('ar-EG')}</p>
                    <p className="text-xs text-gray-400">ج.م</p>
                  </div>
                  <div className="text-center bg-emerald-50 rounded-xl py-3">
                    <p className="text-xs text-emerald-600 mb-1">المحصّل</p>
                    <p className="text-base font-bold text-emerald-700">{stats.totalCollected.toLocaleString('ar-EG')}</p>
                    <p className="text-xs text-emerald-600">ج.م</p>
                  </div>
                  <div className="text-center bg-red-50 rounded-xl py-3">
                    <p className="text-xs text-red-500 mb-1">المتبقي</p>
                    <p className="text-base font-bold text-red-600">{stats.totalPending.toLocaleString('ar-EG')}</p>
                    <p className="text-xs text-red-500">ج.م</p>
                  </div>
                </div>
                {collectionRate !== null && (
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                      <span>نسبة التحصيل</span>
                      <span className="font-medium text-gray-600">{collectionRate}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${collectionRate}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* حصص اليوم */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-gray-800">حصص اليوم</h2>
                <button onClick={() => navigate('/sessions')}
                  className="text-xs text-[#0E3B2E] font-medium hover:underline">عرض الكل</button>
              </div>
              {loadingSessions ? (
                <div className="space-y-2">
                  {[1,2].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
                </div>
              ) : todaySessions.length === 0 && missingGroupSessions.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">لا توجد حصص اليوم</p>
              ) : (
                <div className="space-y-2">
                  {todaySessions.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100/70 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{s.title}</p>
                        <p className="text-xs text-gray-400">
                          {SESSION_TYPE_LABELS[s.type] || s.type}
                          {s.startTime ? ` — ${s.startTime}` : ''}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 mr-2 ${SESSION_STATUS_COLORS[s.status] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                        {SESSION_STATUS_LABELS[s.status] || s.status}
                      </span>
                    </div>
                  ))}
                  {/* مجموعات النهاردة اللي لسه ملهاش حصة — زرار إنشاء سريع بالمواعيد جاهزة */}
                  {missingGroupSessions.map(({ group, scheduleItem }) => (
                    <div key={group.id} className="flex items-center justify-between p-3 bg-amber-50/60 border border-dashed border-amber-200 rounded-xl">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{group.name}</p>
                        <p className="text-xs text-amber-600">
                          لسه من غير حصة — {scheduleItem.startTime}
                        </p>
                      </div>
                      {hasPermission('sessions.create') && (
                        <button onClick={() => setCreateForGroup({ id: group.id, name: group.name })}
                          className="text-xs px-3 py-1.5 bg-[#0E3B2E] text-white rounded-lg hover:bg-[#1F6B4E] transition-colors shrink-0 mr-2">
                          + إنشاء
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* --- العمود الجانبي (١/٣) --- */}
          <div className="space-y-5">

            {/* اختصارات سريعة */}
            <div className="space-y-3">
              <button onClick={() => navigate('/finance/collect')}
                className="w-full bg-[#0E3B2E] text-white rounded-2xl p-4 flex items-center gap-3 hover:bg-[#1F6B4E] transition-colors shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" strokeLinecap="round"/>
                  </svg>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">تحصيل سريع</p>
                  <p className="text-xs text-white/70">استلام مدفوعات</p>
                </div>
              </button>
              <button onClick={() => navigate('/students')}
                className="w-full bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 hover:border-[#0E3B2E]/30 transition-colors shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-[#0E3B2E]/10 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-[#0E3B2E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
                  </svg>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">طالب جديد</p>
                  <p className="text-xs text-gray-400">تسجيل طالب</p>
                </div>
              </button>
            </div>

            {/* الخزائن */}
            {treasuries.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-gray-800">الخزائن</h2>
                  <button onClick={() => navigate('/finance/treasuries')}
                    className="text-xs text-[#0E3B2E] font-medium hover:underline">إدارة</button>
                </div>
                <div className="space-y-1">
                  {(Array.isArray(treasuries) ? treasuries.filter((t: any) => t.isActive) : []).map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                      <p className="text-sm text-gray-700">{t.name}</p>
                      <p className="text-sm font-bold text-gray-900">{Number(t.balance).toLocaleString('ar-EG')} ج.م</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {createForGroup && (
        <SessionFormModal
          open
          onClose={() => setCreateForGroup(null)}
          initialGroupId={createForGroup.id}
          initialStartDate={todayIso}
        />
      )}
    </div>
  );
}
