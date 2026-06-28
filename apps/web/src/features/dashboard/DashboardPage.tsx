import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/shared/stores/auth.store';
import { apiClient } from '@/shared/lib/api/client';

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

function useTodaySessions() {
  return useQuery({
    queryKey: ['dashboard', 'today-sessions'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await apiClient.get('/sessions', { params: { date: today, limit: 10 } });
      return (res.data.data?.data ?? []) as any[];
    },
    staleTime: 1000 * 60,
    refetchInterval: 1000 * 60,
  });
}

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
  const { data: studentsCount = 0 } = useStudentsCount();
  const { data: todaySessions = [], isLoading: loadingSessions } = useTodaySessions();
  const { data: stats, isLoading: loadingStats } = useFinanceStats();
  const { data: treasuries = [] } = useTreasuries();

  const month = new Date().toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
  const today = new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });
  const ongoingSessions = Array.isArray(todaySessions) ? todaySessions.filter(s => s.status === 'ongoing') : [];

  return (
    <div className="min-h-screen bg-[#F7F7F7]" dir="rtl">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">

        {/* ترحيب */}
        <div>
          <h1 className="text-xl font-bold text-gray-900">مرحباً، {user?.name} 👋</h1>
          <p className="text-sm text-gray-400 mt-0.5">{today}</p>
        </div>

        {/* إحصائيات سريعة */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* الطلاب */}
          <button onClick={() => navigate('/students')}
            className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-right hover:border-[#0E3B2E]/30 transition-colors">
            <div className="w-9 h-9 rounded-xl bg-[#0E3B2E]/10 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-[#0E3B2E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <p className="text-2xl font-bold text-gray-900">{studentsCount}</p>
            <p className="text-xs text-gray-400 mt-0.5">طالب نشط</p>
          </button>

          {/* الحصص النهارده */}
          <button onClick={() => navigate('/sessions')}
            className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-right hover:border-[#0E3B2E]/30 transition-colors">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <p className="text-2xl font-bold text-gray-900">{loadingSessions ? '...' : todaySessions.length}</p>
            <p className="text-xs text-gray-400 mt-0.5">حصة اليوم</p>
            {ongoingSessions.length > 0 && (
              <p className="text-xs text-emerald-600 font-medium mt-1">{ongoingSessions.length} جارية الآن</p>
            )}
          </button>

          {/* التحصيل الشهر */}
          <button onClick={() => navigate('/finance')}
            className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-right hover:border-[#0E3B2E]/30 transition-colors">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" strokeLinecap="round"/>
              </svg>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {loadingStats ? '...' : (stats?.totalCollected ?? 0).toLocaleString('ar-EG')}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">تحصيل {month}</p>
          </button>

          {/* الفواتير المفتوحة */}
          <button onClick={() => navigate('/finance/dues')}
            className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-right hover:border-[#0E3B2E]/30 transition-colors">
            <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {loadingStats ? '...' : (stats?.unpaidCount ?? 0)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">فاتورة غير مدفوعة</p>
          </button>
        </div>

        {/* ملخص مالي الشهر */}
        {stats && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-800">الملخص المالي — {month}</h2>
              <button onClick={() => navigate('/finance')}
                className="text-xs text-[#0E3B2E] font-medium">عرض الكل</button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-xs text-gray-400 mb-1">إجمالي الفواتير</p>
                <p className="text-base font-bold text-gray-800">{stats.totalDues.toLocaleString('ar-EG')}</p>
                <p className="text-xs text-gray-400">ج.م</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-emerald-600 mb-1">المحصّل</p>
                <p className="text-base font-bold text-emerald-700">{stats.totalCollected.toLocaleString('ar-EG')}</p>
                <p className="text-xs text-emerald-600">ج.م</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-red-500 mb-1">المتبقي</p>
                <p className="text-base font-bold text-red-600">{stats.totalPending.toLocaleString('ar-EG')}</p>
                <p className="text-xs text-red-500">ج.م</p>
              </div>
            </div>
            {stats.totalDues > 0 && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>نسبة التحصيل</span>
                  <span>{Math.round((stats.totalCollected / stats.totalDues) * 100)}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, Math.round((stats.totalCollected / stats.totalDues) * 100))}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* الخزائن */}
        {treasuries.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-800">الخزائن</h2>
              <button onClick={() => navigate('/finance/treasuries')}
                className="text-xs text-[#0E3B2E] font-medium">إدارة</button>
            </div>
            <div className="space-y-2">
              {(Array.isArray(treasuries) ? treasuries.filter((t: any) => t.isActive) : []).map((t: any) => (
                <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <p className="text-sm text-gray-700">{t.name}</p>
                  <p className="text-sm font-bold text-gray-900">{Number(t.balance).toLocaleString('ar-EG')} ج.م</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* حصص اليوم */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-800">حصص اليوم</h2>
            <button onClick={() => navigate('/sessions')}
              className="text-xs text-[#0E3B2E] font-medium">عرض الكل</button>
          </div>
          {loadingSessions ? (
            <div className="space-y-2">
              {[1,2].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : todaySessions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">لا توجد حصص اليوم</p>
          ) : (
            <div className="space-y-2">
              {todaySessions.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
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
            </div>
          )}
        </div>

        {/* اختصارات سريعة */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => navigate('/finance/collect')}
            className="bg-[#0E3B2E] text-white rounded-2xl p-4 flex items-center gap-3 hover:bg-[#1F6B4E] transition-colors">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
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
            className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 hover:border-[#0E3B2E]/30 transition-colors shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-[#0E3B2E]/10 flex items-center justify-center shrink-0">
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

      </div>
    </div>
  );
}
