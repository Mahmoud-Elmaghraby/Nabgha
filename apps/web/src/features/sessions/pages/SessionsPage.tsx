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
import { DataTable } from '@/shared/components/DataTable';
import type { Column } from '@/shared/components/DataTable';
import { ActionsDropdown } from '@/shared/components/ActionsDropdown';

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
  const { data: groupsData } = useGroups({ limit: 1000 });
  const groups = groupsData?.data || [];

  const sessions = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  // نجيب النسخة الأحدث من الحصة المختارة من القايمة الحية (مش النسخة "المجمّدة"
  // وقت الفتح) — عشان أي تحديث (رفع/حذف صورة، تغيير حالة) يظهر فوراً في المودالات
  // المفتوحة من غير ما نحتاج نقفل ونفتح تاني.
  const liveSelectedSession = selectedSession
    ? sessions.find(s => s.id === selectedSession.id) ?? selectedSession
    : null;
  const liveDegreesSession = degreesSession
    ? sessions.find(s => s.id === degreesSession.id) ?? degreesSession
    : null;

  const columns: Column<Session>[] = [
    {
      key: 'title',
      header: 'العنوان',
      render: (session) => (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-900">{session.title}</span>
          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full whitespace-nowrap">
            {SESSION_TYPE_LABELS[session.type]}
          </span>
        </div>
      ),
    },
    {
      key: 'groupOrGrade',
      header: 'المجموعة/المرحلة',
      render: (session) => (
        <div className="text-xs text-gray-500">
          {session.groupName && <span>{session.groupName}</span>}
          {session.grade && <span>{session.grade}</span>}
          {session.subjectName && <span> · {session.subjectName}</span>}
        </div>
      ),
    },
    {
      key: 'date',
      header: 'التاريخ',
      render: (session) => (
        <div className="text-xs text-gray-500 whitespace-nowrap">
          {new Date(session.startDate).toLocaleDateString('ar-EG')}
          {session.startTime && <span> · {session.startTime}</span>}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (session) => (
        <span className={`text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ${SESSION_STATUS_LABELS[session.status].class}`}>
          {SESSION_STATUS_LABELS[session.status].label}
        </span>
      ),
    },
    {
      key: 'attendance',
      header: 'الحضور',
      render: (session) => {
        if (!session.attendanceCount || session.attendanceCount.total === 0) {
          return <span className="text-xs text-gray-300">—</span>;
        }
        return (
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-xs text-emerald-600 font-medium">✓ {session.attendanceCount.present}</span>
            {session.attendanceCount.late > 0 && (
              <span className="text-xs text-amber-500 font-medium">⏱ {session.attendanceCount.late}</span>
            )}
            <span className="text-xs text-red-400 font-medium">✗ {session.attendanceCount.absent}</span>
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      render: (session) => (
        <div className="flex items-center gap-1.5 justify-end">
          <button onClick={() => setSelectedSession(session)}
            className="text-xs px-3 py-1.5 bg-[#0E3B2E] text-white rounded-lg hover:bg-[#1F6B4E] transition-colors whitespace-nowrap">
            الحضور
          </button>
          <ActionsDropdown items={[
            {
              label: 'الدرجات',
              onClick: () => setDegreesSession(session),
              hidden: !sessionHasGrades(session.type),
            },
            {
              label: 'تقرير الغياب',
              onClick: () => setReportSession(session),
              hidden: session.status !== 'completed',
            },
            {
              label: 'بدء',
              onClick: () => handleAction('start', session.id),
              variant: 'success',
              hidden: !hasPermission('sessions.edit') || session.status !== 'scheduled',
            },
            {
              label: 'إنهاء',
              onClick: () => handleAction('complete', session.id),
              hidden: !hasPermission('sessions.edit') || session.status !== 'ongoing',
            },
            {
              label: 'إلغاء',
              onClick: () => handleAction('cancel', session.id),
              variant: 'warning',
              hidden: !hasPermission('sessions.edit') || !(session.status === 'scheduled' || session.status === 'ongoing'),
            },
            {
              label: 'حذف',
              onClick: () => handleAction('delete', session.id),
              variant: 'danger',
              hidden: !hasPermission('sessions.delete') || session.status === 'ongoing',
            },
          ]} />
        </div>
      ),
    },
  ];

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

      {/* Sessions Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <DataTable<Session>
          columns={columns}
          data={sessions}
          keyExtractor={(s) => s.id}
          isLoading={isLoading}
          emptyTitle="لا توجد حصص"
          emptySubtitle="جرّب تعديل الفلاتر أو أضف حصة جديدة"
        />
      </div>

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
      {liveSelectedSession && <AttendanceSheet session={liveSelectedSession} onClose={() => setSelectedSession(null)} />}
      {liveDegreesSession && <DegreesSheet session={liveDegreesSession} onClose={() => setDegreesSession(null)} />}
      {reportSession && <AbsenceReportModal session={reportSession} onClose={() => setReportSession(null)} />}
    </div>
  );
}
