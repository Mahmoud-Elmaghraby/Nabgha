import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/shared/stores/auth.store';
import { useSessions } from '@/features/sessions/hooks/useSessions';
import { SessionFormModal } from '@/features/sessions/components/SessionFormModal';
import { useGroups } from '@/features/groups/hooks/useGroups';
import type { DayOfWeek } from '@/features/groups/types/group.types';
import { usePermissions } from '@/shared/hooks/usePermissions';
import { BackupHealthBanner } from '@/features/settings/components/BackupHealthBanner';

const JS_DAY_TO_DAY_OF_WEEK: DayOfWeek[] = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
];

const DAY_LABELS: Record<DayOfWeek, string> = {
  sunday: 'الأحد', monday: 'الإثنين', tuesday: 'الثلاثاء',
  wednesday: 'الأربعاء', thursday: 'الخميس', friday: 'الجمعة', saturday: 'السبت',
};

const TYPE_META: Record<string, { label: string; colorCls: string }> = {
  lesson:          { label: 'حصة',           colorCls: 'text-sky-600 bg-sky-50 border-sky-100' },
  lesson_revision: { label: 'مراجعة',        colorCls: 'text-violet-600 bg-violet-50 border-violet-100' },
  lesson_exam:     { label: 'اختبار',        colorCls: 'text-amber-600 bg-amber-50 border-amber-100' },
  exam:            { label: 'امتحان',        colorCls: 'text-rose-600 bg-rose-50 border-rose-100' },
  grade_exam:      { label: 'امتحان مرحلة', colorCls: 'text-rose-600 bg-rose-50 border-rose-100' },
};

const STATUS_META: Record<string, { label: string; cls: string; pulse?: boolean }> = {
  scheduled: { label: 'مجدولة', cls: 'text-blue-600 bg-blue-50 border-blue-100' },
  ongoing:   { label: 'جارية',  cls: 'text-emerald-600 bg-emerald-50 border-emerald-200', pulse: true },
  completed: { label: 'منتهية', cls: 'text-gray-400 bg-gray-50 border-gray-100' },
  cancelled: { label: 'ملغاة',  cls: 'text-red-400 bg-red-50 border-red-100' },
};

function CalIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}

interface QuickBtnProps {
  label: string;
  sub: string;
  onClick: () => void;
  primary?: boolean;
  iconPath?: string;
  emoji?: string;
}
function QuickBtn({ label, sub, onClick, primary, iconPath, emoji }: QuickBtnProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-right ${
        primary
          ? 'bg-[#0E3B2E] text-white hover:bg-[#176B4E] shadow-sm'
          : 'border border-gray-100 bg-white hover:border-[#0E3B2E]/20 hover:bg-[#f6faf8]'
      }`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${primary ? 'bg-white/10' : 'bg-[#0E3B2E]/8'}`}>
        {emoji ? (
          <span className="text-base leading-none">{emoji}</span>
        ) : (
          <svg className={`w-4 h-4 ${primary ? 'text-white' : 'text-[#0E3B2E]'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d={iconPath} strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      <div className="min-w-0">
        <p className={`text-sm font-bold leading-none ${primary ? 'text-white' : 'text-gray-900'}`}>{label}</p>
        <p className={`text-xs mt-0.5 ${primary ? 'text-white/60' : 'text-gray-400'}`}>{sub}</p>
      </div>
    </button>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { hasPermission } = usePermissions();

  const todayIso       = new Date().toISOString().split('T')[0];
  const todayDayOfWeek = JS_DAY_TO_DAY_OF_WEEK[new Date().getDay()];
  const todayLabel     = new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });

  const { data: sessionsData, isLoading: loadingSessions } = useSessions({ from: todayIso, to: todayIso, limit: 50 });
  const todaySessions: any[] = sessionsData?.data ?? [];
  const { data: groupsData } = useGroups({ limit: 1000 });

  const [createForGroup, setCreateForGroup] = useState<{ id: string; name: string } | null>(null);

  const groups      = groupsData?.data ?? [];
  const activeGroups = groups.filter(g => g.isActive);

  const ongoing   = todaySessions.filter(s => s.status === 'ongoing');
  const scheduled = todaySessions.filter(s => s.status === 'scheduled');
  const completed = todaySessions.filter(s => s.status === 'completed');

  const existingGroupIds = new Set(todaySessions.map(s => s.groupId).filter(Boolean) as string[]);
  const missingGroups = activeGroups
    .filter(g => !existingGroupIds.has(g.id))
    .map(g => ({ group: g, slot: g.schedule.find(s => s.day === todayDayOfWeek) }))
    .filter((x): x is { group: typeof groups[number]; slot: NonNullable<typeof x.slot> } => !!x.slot)
    .sort((a, b) => a.slot.startTime.localeCompare(b.slot.startTime));

  return (
    <div className="min-h-screen bg-[#F4F5F8]" dir="rtl">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-6 space-y-5">

        {/* ══ HERO ══ */}
        <div className="relative overflow-hidden rounded-2xl bg-[#0E3B2E] px-7 py-7 shadow-lg">
          <div className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: 'radial-gradient(ellipse at 80% 50%, #D4AB53 0%, transparent 60%)' }} />
          <div className="absolute -right-12 -top-12 w-60 h-60 rounded-full bg-white/[0.03]" />
          <div className="absolute -left-8 -bottom-10 w-44 h-44 rounded-full bg-white/[0.03]" />

          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-white/40 text-xs tracking-widest mb-1.5">{todayLabel}</p>
              <h1 className="text-2xl font-extrabold text-white leading-tight">مرحباً، {user?.name} 👋</h1>
              <p className="text-white/50 text-sm mt-1">
                {loadingSessions ? '...' : todaySessions.length === 0
                  ? 'لا توجد حصص مجدولة اليوم'
                  : `${todaySessions.length} حصة مجدولة اليوم`}
              </p>
            </div>

            {!loadingSessions && todaySessions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {ongoing.length > 0 && (
                  <button onClick={() => navigate('/sessions')}
                    className="flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-emerald-500/30 transition-colors">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {ongoing.length} جارية
                  </button>
                )}
                {scheduled.length > 0 && (
                  <span className="flex items-center bg-white/10 border border-white/10 text-white/70 text-xs font-medium px-3 py-1.5 rounded-full">
                    {scheduled.length} مجدولة
                  </span>
                )}
                {completed.length > 0 && (
                  <span className="flex items-center bg-white/10 border border-white/10 text-white/40 text-xs font-medium px-3 py-1.5 rounded-full">
                    {completed.length} منتهية
                  </span>
                )}
                {missingGroups.length > 0 && (
                  <span className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-400/25 text-amber-300 text-xs font-medium px-3 py-1.5 rounded-full">
                    {missingGroups.length} مجموعة بدون حصة
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* تنبيه النسخ الاحتياطي (BACKUP-007) — بيظهر بس لو فيه مشكلة */}
        <BackupHealthBanner />

        {/* ══ GRID ══ */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_296px] gap-5">

          {/* العمود الرئيسي */}
          <div className="space-y-5">

            {/* حصص اليوم */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-[#0E3B2E]/10 flex items-center justify-center">
                    <CalIcon className="w-3.5 h-3.5 text-[#0E3B2E]" />
                  </div>
                  <h2 className="text-sm font-bold text-gray-800">حصص اليوم</h2>
                  {!loadingSessions && todaySessions.length > 0 && (
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full font-medium">{todaySessions.length}</span>
                  )}
                </div>
                <button onClick={() => navigate('/sessions')} className="text-xs text-[#0E3B2E] font-semibold hover:underline">عرض الكل</button>
              </div>

              <div className="divide-y divide-gray-50">
                {loadingSessions ? (
                  <div className="p-4 space-y-2.5">
                    {[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />)}
                  </div>
                ) : todaySessions.length === 0 && missingGroups.length === 0 ? (
                  <div className="flex flex-col items-center py-14 gap-3 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
                      <CalIcon className="w-6 h-6 text-gray-300" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-400">لا توجد حصص اليوم</p>
                      <p className="text-xs text-gray-300 mt-0.5">انتقل إلى الحصص لإنشاء حصة جديدة</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {todaySessions.map((s: any) => {
                      const tm = TYPE_META[s.type] ?? { label: s.type, colorCls: 'text-gray-500 bg-gray-50 border-gray-100' };
                      const sm = STATUS_META[s.status] ?? STATUS_META.scheduled;
                      return (
                        <div
                          key={s.id}
                          onClick={() => navigate('/sessions')}
                          className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/60 cursor-pointer transition-colors"
                        >
                          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${tm.colorCls}`}>
                            <CalIcon className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{s.title}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`text-xs font-medium ${tm.colorCls.split(' ')[0]}`}>{tm.label}</span>
                              {s.startTime && <>
                                <span className="text-gray-200">·</span>
                                <span className="text-xs text-gray-400">{s.startTime}</span>
                              </>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {sm.pulse && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                            <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${sm.cls}`}>{sm.label}</span>
                          </div>
                        </div>
                      );
                    })}

                    {missingGroups.length > 0 && (
                      <div className="px-5 pt-3 pb-4">
                        <p className="text-xs font-semibold text-gray-400 mb-2.5">مجموعات لم تُنشأ لها حصة اليوم</p>
                        <div className="space-y-2">
                          {missingGroups.map(({ group, slot }) => (
                            <div key={group.id} className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-amber-200 bg-amber-50/50">
                              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                                <svg className="w-4 h-4 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-800 truncate">{group.name}</p>
                                <p className="text-xs text-amber-600 mt-0.5">ميعادها {slot.startTime}</p>
                              </div>
                              {hasPermission('sessions.create') && (
                                <button
                                  onClick={() => setCreateForGroup({ id: group.id, name: group.name })}
                                  className="text-xs px-3 py-1.5 bg-[#0E3B2E] text-white rounded-lg hover:bg-[#176B4E] transition-colors shrink-0 font-semibold"
                                >
                                  + إنشاء
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* المجموعات النشطة */}
            {activeGroups.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-violet-50 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-violet-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                      </svg>
                    </div>
                    <h2 className="text-sm font-bold text-gray-800">المجموعات النشطة</h2>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full font-medium">{activeGroups.length}</span>
                  </div>
                  <button onClick={() => navigate('/groups')} className="text-xs text-[#0E3B2E] font-semibold hover:underline">عرض الكل</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-gray-50">
                  {activeGroups.slice(0, 8).map(g => {
                    const todaySlot  = g.schedule.find(s => s.day === todayDayOfWeek);
                    const hasToday   = existingGroupIds.has(g.id);
                    return (
                      <button
                        key={g.id}
                        onClick={() => navigate('/groups')}
                        className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-[#f6faf8] transition-colors text-right"
                      >
                        <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                          <span className="text-xs font-extrabold text-violet-600">{g.name.trim().slice(0, 2)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{g.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {todaySlot
                              ? hasToday ? `✓ حصة اليوم — ${todaySlot.startTime}` : `اليوم — ${todaySlot.startTime}`
                              : 'لا حصة اليوم'}
                          </p>
                        </div>
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          hasToday ? 'bg-emerald-400' : todaySlot ? 'bg-amber-400' : 'bg-gray-200'
                        }`} />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* العمود الجانبي */}
          <div className="space-y-4">

            {/* إجراءات سريعة */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-50">
                <h2 className="text-sm font-bold text-gray-800">إجراءات سريعة</h2>
              </div>
              <div className="p-3 space-y-1.5">
                <QuickBtn primary label="تحصيل سريع" sub="استلام مدفوعات"
                  onClick={() => navigate('/finance/collect')}
                  iconPath="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                {hasPermission('sessions.create') && (
                  <QuickBtn label="حصة جديدة" sub="إنشاء حصة الآن"
                    onClick={() => navigate('/sessions')}
                    iconPath="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm7 8v4m-2-2h4" />
                )}
                <QuickBtn label="طالب جديد" sub="تسجيل طالب"
                  onClick={() => navigate('/students')}
                  iconPath="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6" />
                <QuickBtn label="التقارير" sub="تقارير الأداء"
                  onClick={() => navigate('/reports')}
                  iconPath="M18 20V10M12 20V4M6 20v-6M2 20h20" />
                <QuickBtn label="عجلة الحظ" sub="اختيار طالب عشوائي"
                  onClick={() => navigate('/spinner')}
                  emoji="🎯" />
              </div>
            </div>

            {/* الجدول الأسبوعي */}
            {activeGroups.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-50">
                  <h2 className="text-sm font-bold text-gray-800">الجدول الأسبوعي</h2>
                </div>
                <div className="p-3 space-y-1">
                  {(Object.keys(DAY_LABELS) as DayOfWeek[]).map(day => {
                    const dayGroups = activeGroups.filter(g => g.schedule.some(s => s.day === day));
                    if (!dayGroups.length) return null;
                    const isToday = day === todayDayOfWeek;
                    return (
                      <div key={day} className={`flex items-center justify-between px-3 py-2 rounded-xl transition-colors ${
                        isToday ? 'bg-[#0E3B2E]/5 border border-[#0E3B2E]/10' : 'hover:bg-gray-50'
                      }`}>
                        <div className="flex items-center gap-1.5">
                          {isToday && <span className="w-1.5 h-1.5 rounded-full bg-[#0E3B2E]" />}
                          <span className={`text-xs font-semibold ${isToday ? 'text-[#0E3B2E]' : 'text-gray-500'}`}>{DAY_LABELS[day]}</span>
                          {isToday && <span className="text-xs text-[#0E3B2E]/50">• اليوم</span>}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                          isToday ? 'bg-[#0E3B2E] text-white' : 'bg-gray-100 text-gray-500'
                        }`}>{dayGroups.length}</span>
                      </div>
                    );
                  })}
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
