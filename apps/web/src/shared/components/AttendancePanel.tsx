import { useState, useRef } from 'react';
import { normaliseScannerInput } from '@/shared/lib/normaliseScannerInput';
import { useSessions, useSessionAttendance, useAttendanceMutations, usePreviousAbsent, useUnpaidStudents } from '../../features/sessions/hooks/useSessions';
import { ATTENDANCE_STATUS_LABELS } from '../../features/sessions/types/session.types';
import { QrCameraScanner } from '../../features/sessions/components/QrCameraScanner';
import { checkAttendanceWarnings, buildAttendanceMessage, playAttendanceWarningAlarm } from '../../features/sessions/lib/attendanceAlerts';
import type { AttendanceAlertMessage } from '../../features/sessions/lib/attendanceAlerts';
import type { Session, AttendanceStatus } from '../../features/sessions/types/session.types';

interface Props {
  onClose: () => void;
}

function SessionBlock({ session }: { session: Session }) {
  const [scanInput, setScanInput] = useState('');
  const [scanMsg, setScanMsg] = useState<AttendanceAlertMessage | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

  const { data: attendance = [] } = useSessionAttendance(session.id);
  const { updateOne, scanQr } = useAttendanceMutations(session.id);
  const { data: previousAbsent = [] } = usePreviousAbsent(session.id);
  const { data: unpaidStudents = [] } = useUnpaidStudents(session.id);

  const present = attendance.filter(a => a.status === 'present').length;
  const late = attendance.filter(a => a.status === 'late').length;
  const absent = attendance.filter(a => a.status === 'absent').length;

  // نفس منطق التنبيه المستخدم في شاشة الحضور الرئيسية (AttendanceSheet) —
  // رسالة تحذير تفضل ظاهرة لحد التسكين اللي بعده + صوت الإنذار لو الطالب
  // عليه فلوس أو كان غايب المرة اللي فاتت
  const showCheckInResult = (studentName: string, studentId: string) => {
    const warnings = checkAttendanceWarnings(studentId, previousAbsent, unpaidStudents);
    const msg = buildAttendanceMessage(studentName, warnings);
    setScanMsg(msg);
    if (msg.level === 'warning') {
      playAttendanceWarningAlarm();
    } else {
      setTimeout(() => setScanMsg(null), 2500);
    }
  };

  const handleScan = async (qrCode: string) => {
    if (!qrCode.trim()) return;
    const normalised = normaliseScannerInput(qrCode.trim());
    let code = normalised;
    try { const p = JSON.parse(code); if (p.code) code = p.code; } catch {}
    try {
      const record = await scanQr.mutateAsync(code);
      showCheckInResult(record.studentName, record.studentId);
    } catch (err: any) {
      setScanMsg({ text: '❌ ' + (err?.response?.data?.error?.message || 'غير موجود'), level: 'error' });
      setTimeout(() => setScanMsg(null), 2500);
    }
    setScanInput('');
    scanRef.current?.focus();
  };

  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-sm">
      {/* Session Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-[#0E3B2E]/5 cursor-pointer"
        onClick={() => setCollapsed(p => !p)}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">{session.title}</p>
          <p className="text-xs text-gray-400 truncate">{session.groupName}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 mr-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            session.status === 'ongoing' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {session.status === 'ongoing' ? 'جارية' : 'مجدولة'}
          </span>
          <div className="flex gap-1 text-xs">
            <span className="text-emerald-600 font-bold">{present}</span>
            <span className="text-gray-300">/</span>
            <span className="text-red-500 font-bold">{absent}</span>
          </div>
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${collapsed ? '-rotate-90' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 9l-7 7-7-7" strokeLinecap="round"/>
          </svg>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 px-4 py-2 border-b border-gray-50">
            <div className="text-center bg-emerald-50 rounded-xl py-1.5">
              <p className="text-base font-bold text-emerald-600">{present}</p>
              <p className="text-xs text-emerald-500">حاضر</p>
            </div>
            <div className="text-center bg-amber-50 rounded-xl py-1.5">
              <p className="text-base font-bold text-amber-500">{late}</p>
              <p className="text-xs text-amber-400">متأخر</p>
            </div>
            <div className="text-center bg-red-50 rounded-xl py-1.5">
              <p className="text-base font-bold text-red-500">{absent}</p>
              <p className="text-xs text-red-400">غايب</p>
            </div>
          </div>

          {/* Scanner */}
          <div className="px-4 py-2 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 flex-1 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
                <svg className="w-4 h-4 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                  <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/>
                </svg>
                <input ref={scanRef} type="text" value={scanInput}
                  onChange={e => {
                    setScanInput(e.target.value);
                    if (e.target.value.length > 3) {
                      clearTimeout((window as any)['_scan_' + session.id]);
                      (window as any)['_scan_' + session.id] = setTimeout(() => {
                        handleScan(e.target.value);
                      }, 150);
                    }
                  }}
                  onKeyDown={e => e.key === 'Enter' && handleScan(scanInput)}
                  placeholder="سكان QR أو الكود..."
                  className="flex-1 bg-transparent text-xs outline-none placeholder:text-gray-400 min-w-0"
                  onClick={e => e.stopPropagation()}
                />
              </div>
              <button onClick={() => setShowCamera(true)}
                className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl bg-[#0E3B2E] text-white">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </button>
            </div>
            {scanMsg && (
              scanMsg.level === 'warning' ? (
                <p className="text-xs mt-1.5 px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-300 font-semibold">
                  {scanMsg.text}
                </p>
              ) : (
                <p className={`text-xs mt-1.5 px-1 ${scanMsg.level === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>
                  {scanMsg.text}
                </p>
              )
            )}
          </div>

          {/* Attendance List */}
          <div className="px-4 py-2 space-y-1.5 max-h-36 overflow-y-auto">
            {attendance.map(record => (
              <div key={record.id} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                  record.status === 'present' ? 'bg-emerald-100 text-emerald-700' :
                  record.status === 'late'    ? 'bg-amber-100 text-amber-700' :
                                                  'bg-red-100 text-red-600'
                }`}>
                  {record.studentName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">{record.studentName}</p>
                  <p className="text-xs text-gray-400 font-mono">{record.studentCode}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {(['present', 'late', 'absent'] as AttendanceStatus[]).map(s => (
                    <button key={s}
                      onClick={async () => {
                        const updated = await updateOne.mutateAsync({ studentId: record.studentId, payload: { status: s } });
                        if (s === 'present' || s === 'late') showCheckInResult(updated.studentName, updated.studentId);
                      }}
                      className={`text-xs px-1.5 py-1 rounded-lg border transition-all ${
                        record.status === s
                          ? ATTENDANCE_STATUS_LABELS[s].class + ' border-current font-bold'
                          : 'bg-white text-gray-400 border-gray-200'
                      }`}>
                      {ATTENDANCE_STATUS_LABELS[s].label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {showCamera && (
        <QrCameraScanner
          onScan={async (qr) => { setShowCamera(false); await handleScan(qr); }}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
}

export function AttendancePanel({ onClose }: Props) {
  // نفس الـ hook والـ query key المستخدمين في باقي شاشات الحصص (useSessions) —
  // بدل query منفصلة (['panel-sessions']) كانت معزولة عن نظام الـ invalidation
  // العام. أي إنشاء/تعديل/حذف حصة في أي مكان تاني في التطبيق كان بيعمل
  // invalidate لـ ['sessions'] بس مش بيوصل للوحة دي خالص، فكانت بتفضل تعرض
  // بيانات قديمة لحد ما الـ polling (كل 15 ثانية) يلحقها. دلوقتي بقت بتتحدث
  // فوراً مع أي تغيير حصص تاني في التطبيق، والـ polling القصير باقي كـ fallback.
  const { data: sessionsData } = useSessions({ limit: 20 });

  const sessions = (sessionsData?.data ?? []).filter((s: Session) =>
    s.status === 'ongoing' || s.status === 'scheduled'
  );

  return (
    <div className="w-80 min-w-80 h-full bg-[#F7F7F7] border-l border-gray-100 flex flex-col shadow-xl" dir="rtl">
      {/* Header */}
      <div className="bg-[#0E3B2E] px-4 py-3 flex items-center justify-between shrink-0">
        <p className="text-white font-bold text-sm">📋 الحضور المباشر</p>
        <button onClick={onClose} className="text-white/70 hover:text-white">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Sessions */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {sessions.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-3">📅</p>
            <p className="text-sm font-medium">لا توجد حصص جارية</p>
            <p className="text-xs mt-1">ستظهر الحصص هنا تلقائياً</p>
          </div>
        ) : (
          sessions.map((s: Session) => (
            <SessionBlock key={s.id} session={s} />
          ))
        )}
      </div>
    </div>
  );
}
