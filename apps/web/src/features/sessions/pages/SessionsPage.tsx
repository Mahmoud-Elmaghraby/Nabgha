import { useState } from 'react';
import { useToast } from '@/shared/components/Toast';
import { useConfirm } from '@/shared/components/Confirm';
import { useGroups } from '@/features/groups/hooks/useGroups';
import { GRADE_OPTIONS } from '@nabgha/types';
import { useSessions, useSessionMutations } from '../hooks/useSessions';
import { SessionFormModal } from '../components/SessionFormModal';
import { AttendanceSheet } from '../components/AttendanceSheet';
import { DegreesSheet } from '../components/DegreesSheet';
import { AbsenceReportModal } from '../components/AbsenceReportModal';
import type { Session, SessionType, SessionStatus } from '../types/session.types';
import { SESSION_TYPE_LABELS, SESSION_STATUS_LABELS, sessionHasGrades } from '../types/session.types';
import { usePermissions } from '@/shared/hooks/usePermissions';

const TYPE_FILTER_OPTIONS: { value: SessionType | ''; label: string }[] = [
  { value: '', label: 'الكل' },
  { value: 'lesson', label: 'حصص' },
  { value: 'lesson_revision', label: 'تسميع' },
  { value: 'lesson_exam', label: 'حصة + امتحان' },
  { value: 'exam', label: 'امتحانات' },
  { value: 'grade_exam', label: 'امتحانات المرحلة' },
];

const STATUS_FILTER_OPTIONS: { value: SessionStatus | ''; label: string }[] = [
  { value: '', label: 'كل الحالات' },
  { value: 'scheduled', label: 'مجدولة' },
  { value: 'ongoing', label: 'جارية' },
  { value: 'completed', label: 'منتهية' },
  { value: 'cancelled', label: 'ملغاة' },
];

export default function SessionsPage() {
  const { hasPermission } = usePermissions();
  const [showForm, setShowForm] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [degreesSession, setDegreesSession] = useState<Session | null>(null);
  const [reportSession, setReportSession] = useState<Session | null>(null);
  const [typeFilter, setTypeFilter] = useState<SessionType | ''>('');
  const [statusFilter, setStatusFilter] = useState<SessionStatus | ''>('');
  const [groupFilter, setGroupFilter] = useState('');
  const [from, setFrom] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useSessions({
    ...(typeFilter ? { type: typeFilter } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(groupFilter ? { groupId: groupFilter } : {}),
    ...(from ? { from } : {}),
    page, limit,
  });

  const toast = useToast();
  const confirm = useConfirm();
  const { start, complete, cancel, remove } = useSessionMutations();
  const { data: groupsData } = useGroups({ limit: 100 });
  const groups = groupsData?.data || [];

  const sessions = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const handleAction = async (action: 'start' | 'complete' | 'cancel' | 'delete', id: string) => {
    if (action === 'delete' && !(await confirm('هل أنت متأكد من الحذف؟', { danger: true }))) return;
    try {
      if (action === 'start')    await start.mutateAsync(id);
      if (action === 'complete') await complete.mutateAsync(id);
      if (action === 'cancel')   await cancel.mutateAsync(id);
      if (action === 'delete')   await remove.mutateAsync(id);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'حدث خطأ');
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">الحصص والامتحانات</h1>
          <p className="text-sm text-gray-400 mt-0.5">{total} حصة</p>
        </div>
        {hasPermission('sessions.create') && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#0E3B2E] text-white rounded-xl text-sm font-medium hover:bg-[#1F6B4E] transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
            </svg>
            حصة جديدة
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
        {/* Type filter */}
        <div className="flex flex-wrap gap-2">
          {TYPE_FILTER_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => { setTypeFilter(opt.value as any); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                typeFilter === opt.value
                  ? 'bg-[#0E3B2E] text-white border-[#0E3B2E]'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          {/* Status filter */}
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value as any); setPage(1); }}
            className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20">
            {STATUS_FILTER_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {/* Group filter */}
          <select value={groupFilter} onChange={e => { setGroupFilter(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20">
            <option value="">كل المجموعات</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>

          {/* Date filter */}
          <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20" />

          {(typeFilter || statusFilter || groupFilter || from) && (
            <button onClick={() => { setTypeFilter(''); setStatusFilter(''); setGroupFilter(''); setFrom(''); setPage(1); }}
              className="text-xs text-gray-400 hover:text-gray-600 underline">
              مسح الفلاتر
            </button>
          )}
        </div>
      </div>

      {/* Sessions List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <svg className="w-10 h-10 mx-auto mb-3 text-gray-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
          </svg>
          <p className="text-sm">لا توجد حصص</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(session => (
            <div key={session.id}
              className="bg-white rounded-2xl border border-gray-100 p-4 hover:border-gray-200 transition-colors">
              <div className="flex items-start gap-3">
                {/* Type icon */}
                <div className="w-10 h-10 rounded-xl bg-[#0E3B2E]/10 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-[#0E3B2E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {session.type.includes('exam')
                      ? <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
                      : <><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>
                    }
                  </svg>
                </div>

                <div className="flex-1 min-w-0">
                  {/* Row 1 */}
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-semibold text-gray-900">{session.title}</span>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                      {SESSION_TYPE_LABELS[session.type]}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${SESSION_STATUS_LABELS[session.status].class}`}>
                      {SESSION_STATUS_LABELS[session.status].label}
                    </span>
                  </div>

                  {/* Row 2 */}
                  <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                    {session.groupName && <span>{session.groupName}</span>}
                    {session.grade && <span>{session.grade}</span>}
                    {session.subjectName && <span>· {session.subjectName}</span>}
                    <span>· {new Date(session.startDate).toLocaleDateString('ar-EG')}</span>
                    {session.startTime && <span>· {session.startTime}</span>}
                    {session.outOf && <span>· من {session.outOf} درجة</span>}
                  </div>

                  {/* Attendance count */}
                  {session.attendanceCount && session.attendanceCount.total > 0 && (
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-emerald-600 font-medium">✓ {session.attendanceCount.present} حاضر</span>
                      {session.attendanceCount.late > 0 && (
                        <span className="text-xs text-amber-500 font-medium">⏱ {session.attendanceCount.late} متأخر</span>
                      )}
                      <span className="text-xs text-red-400 font-medium">✗ {session.attendanceCount.absent} غايب</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button onClick={() => setSelectedSession(session)}
                    className="text-xs px-3 py-1.5 bg-[#0E3B2E] text-white rounded-lg hover:bg-[#1F6B4E] transition-colors">
                    الحضور
                  </button>
                  {sessionHasGrades(session.type) && (
                    <button onClick={() => setDegreesSession(session)}
                      className="text-xs px-3 py-1.5 bg-[#D4AB53]/10 text-[#D4AB53] border border-[#D4AB53]/30 rounded-lg hover:bg-[#D4AB53]/20 transition-colors">
                      الدرجات
                    </button>
                  )}
                  {session.status === 'completed' && (
                    <button onClick={() => setReportSession(session)}
                      className="text-xs px-3 py-1.5 bg-gray-50 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                      تقرير الغياب
                    </button>
                  )}
                  {hasPermission('sessions.edit') && session.status === 'scheduled' && (
                    <button onClick={() => handleAction('start', session.id)}
                      className="text-xs px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100">
                      بدء
                    </button>
                  )}
                  {hasPermission('sessions.edit') && session.status === 'ongoing' && (
                    <button onClick={() => handleAction('complete', session.id)}
                      className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100">
                      إنهاء
                    </button>
                  )}
                  {hasPermission('sessions.edit') && (session.status === 'scheduled' || session.status === 'ongoing') && (
                    <button onClick={() => handleAction('cancel', session.id)}
                      className="text-xs px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100">
                      إلغاء
                    </button>
                  )}
                  {hasPermission('sessions.delete') && session.status !== 'ongoing' && (
                    <button onClick={() => handleAction('delete', session.id)}
                      className="text-xs px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100">
                      حذف
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
            السابق
          </button>
          <span className="text-sm text-gray-500">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
            التالي
          </button>
        </div>
      )}

      {showForm && <SessionFormModal open={showForm} onClose={() => setShowForm(false)} />}
      {selectedSession && <AttendanceSheet session={selectedSession} onClose={() => setSelectedSession(null)} />}
      {degreesSession && <DegreesSheet session={degreesSession} onClose={() => setDegreesSession(null)} />}
      {reportSession && <AbsenceReportModal session={reportSession} onClose={() => setReportSession(null)} />}
    </div>
  );
}
