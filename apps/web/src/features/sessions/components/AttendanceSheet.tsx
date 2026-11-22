import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/shared/components/Toast';
import { useConfirm } from '@/shared/components/Confirm';
import { useSessionAttendance, useAttendanceMutations, usePreviousAbsent, useUnpaidStudents } from '../hooks/useSessions';
import { QrCameraScanner } from './QrCameraScanner';
import { sessionsApi } from '../api/sessions.api';
import { reportsApi } from '@/features/reports/api/reports.api';
import { downloadBlob } from '@/shared/lib/downloadBlob';
import { getFullMediaUrl } from '@/shared/lib/getFullMediaUrl';
import { useQueryClient } from '@tanstack/react-query';
import { SESSION_KEYS } from '../hooks/useSessions';
import { useStudents } from '@/features/students/hooks/useStudents';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { usePermissions } from '@/shared/hooks/usePermissions';
import { normaliseScannerInput } from '@/shared/lib/normaliseScannerInput';
import { ATTENDANCE_STATUS_LABELS } from '../types/session.types';
import { sessionHasImage } from '../types/session.types';
import type { Session, AttendanceStatus } from '../types/session.types';
import {
  checkAttendanceWarnings, buildAttendanceMessage, buildWarningSuffix, playAttendanceWarningAlarm,
} from '../lib/attendanceAlerts';
import type { AttendanceAlertMessage, AttendanceWarnings } from '../lib/attendanceAlerts';

interface CheckInResult {
  studentId: string;
  studentName: string;
  isUnpaid: boolean;
  wasPrevAbsent: boolean;
}

interface Props {
  session: Session;
  onClose: () => void;
}

export function AttendanceSheet({ session, onClose }: Props) {
  const toast = useToast();
  const confirm = useConfirm();
  const { hasPermission } = usePermissions();
  const canMark = hasPermission('sessions.attendance');

  const { data: attendance = [], isLoading } = useSessionAttendance(session.id);
  const { updateOne, scanQr, addExternal } = useAttendanceMutations(session.id);
  const { data: previousAbsent = [] } = usePreviousAbsent(session.id);
  const { data: unpaidStudents = [] } = useUnpaidStudents(session.id);
  const qc = useQueryClient();
  const [scanInput, setScanInput] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'present' | 'absent'>('all');
  const [scanMsg, setScanMsg] = useState<AttendanceAlertMessage | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const [removingImage, setRemovingImage] = useState(false);
  const [exportLoading, setExportLoading] = useState<'pdf' | 'xlsx' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  // ─── طالب من مجموعة تانية (بديل) ───
  const [showExternal, setShowExternal] = useState(false);
  const [externalSearch, setExternalSearch] = useState('');
  const debouncedExternalSearch = useDebounce(externalSearch, 300);
  const enrolledIds = new Set(attendance.map(a => a.studentId));
  const { data: externalCandidates } = useStudents({
    search: debouncedExternalSearch || undefined,
    limit: 10,
  });
  const externalResults = (externalCandidates?.data || []).filter(s => !enrolledIds.has(s.id));

  const isOpen = session.status === 'scheduled' || session.status === 'ongoing';

  // تصدير الكشف المفلتر (نفس الـ tab المعروض) كـ PDF أو Excel
  const handleExport = async (format: 'pdf' | 'xlsx') => {
    setExportLoading(format);
    try {
      // نمرر الحالة للـ backend عشان يفلتر نفس اللي المدرس شايفه
      const statusParam =
        activeTab === 'present' ? 'present' :
        activeTab === 'absent'  ? 'absent'  :
        'all';
      const blob = await reportsApi.generate('session-attendance', {
        sessionId: session.id,
        status: statusParam,
      }, format);
      const tabLabel = activeTab === 'present' ? 'حاضرين' : activeTab === 'absent' ? 'غايبين' : 'الكل';
      downloadBlob(blob, `كشف-${tabLabel}-${session.title}.${format}`);
    } catch (err: any) {
      // نعرض خطأ بسيط عبر console — الـ toast مش محتاجينه هنا
      console.error('Export failed:', err);
    } finally {
      setExportLoading(null);
    }
  };

  useEffect(() => {
    if (isOpen && canMark) scanRef.current?.focus();
  }, [isOpen, canMark, attendance]);

  const handleImageRemove = async () => {
    setRemovingImage(true);
    try {
      await sessionsApi.removeImage(session.id);
      qc.invalidateQueries({ queryKey: SESSION_KEYS.all });
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'فشل حذف الصورة');
    } finally {
      setRemovingImage(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      await sessionsApi.uploadImage(session.id, file);
      qc.invalidateQueries({ queryKey: SESSION_KEYS.all });
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'فشل رفع الصورة');
    } finally {
      setUploading(false);
    }
  };

  // نتيجة تسكين ناجح (سكانر/كاميرا/بديل) — رسالة + صوت الإنذار لو الطالب
  // عليه فلوس أو كان غايب المرة اللي فاتت. الرسالة تفضل ظاهرة لحد التسكين
  // اللي بعده لو كانت تحذير؛ الرسائل العادية بترجع تختفي بالتايمر القديم.
  const showCheckInResult = (studentName: string, warnings: AttendanceWarnings) => {
    const msg = buildAttendanceMessage(studentName, warnings);
    setScanMsg(msg);
    if (msg.level === 'warning') {
      playAttendanceWarningAlarm();
    } else {
      setTimeout(() => setScanMsg(null), 3000);
    }
  };

  const showExternalResultMsg = (
    result: { excusedAbsence: boolean; creditCreated: boolean },
    name: string,
    warnings: AttendanceWarnings,
  ) => {
    let baseText: string;
    if (result.excusedAbsence) {
      baseText = `✅ ${name} — تم تسجيل حضوره وإعفاء غياب سابق تلقائياً`;
    } else if (result.creditCreated) {
      baseText = `✅ ${name} — تم تسجيل حضوره كبديل (لو غاب عن حصته في نفس الأسبوع هيتحسب معذور تلقائياً)`;
    } else {
      baseText = `✅ ${name} — تم تسجيل حضوره`;
    }
    const warningSuffix = buildWarningSuffix(warnings);
    if (warningSuffix) {
      setScanMsg({ text: `${baseText} — ⚠️ ${warningSuffix}`, level: 'warning' });
      playAttendanceWarningAlarm();
    } else {
      setScanMsg({ text: baseText, level: 'success' });
      setTimeout(() => setScanMsg(null), 4000);
    }
  };

  const handleAddExternal = async (studentId: string, studentName: string) => {
    try {
      const result = await addExternal.mutateAsync({ studentId });
      const warnings = checkAttendanceWarnings(result.attendance.studentId, previousAbsent, unpaidStudents);
      showExternalResultMsg(result, studentName, warnings);
      setExternalSearch('');
      setShowExternal(false);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || 'فشل تسجيل الحضور';
      setScanMsg({ text: `❌ ${msg}`, level: 'error' });
      setTimeout(() => setScanMsg(null), 3000);
    }
  };

  const handleScan = async (qrCode: string): Promise<CheckInResult | void> => {
    if (!qrCode.trim()) return;
    const normalised = normaliseScannerInput(qrCode.trim());
    try {
      const record = await scanQr.mutateAsync(normalised);
      const warnings = checkAttendanceWarnings(record.studentId, previousAbsent, unpaidStudents);
      showCheckInResult(record.studentName, warnings);
      scanRef.current?.focus();
      setScanInput('');
      setSearchFilter('');
      return { studentId: record.studentId, studentName: record.studentName, ...warnings };
    } catch (err: any) {
      const code = err?.response?.data?.error?.code;
      // الطالب مش من روستر الحصة دي — نحاول نتعرف عليه من كود الباركود (الباركود يحمل الكود الظاهري بس)
      // ونضيفه كـ"بديل"؛ الـ Backend هو اللي بيترجم الكود لمعرف داخلي
      if (code === 'NOT_FOUND') {
        try {
          let studentCode = normalised;
          try {
            const parsed = JSON.parse(normalised);
            if (parsed.code) studentCode = parsed.code;
          } catch { /* مش JSON — نستخدم النص كما هو كـ كود مباشرة */ }

          const result = await addExternal.mutateAsync({ studentCode });
          const warnings = checkAttendanceWarnings(result.attendance.studentId, previousAbsent, unpaidStudents);
          showExternalResultMsg(result, result.attendance.studentName, warnings);
          scanRef.current?.focus();
          setScanInput('');
          return { studentId: result.attendance.studentId, studentName: result.attendance.studentName, ...warnings };
        } catch (externalErr: any) {
          // فشلت الإضافة كـ"بديل" برضو — لو الباك إند رجّع رسالة واضحة (زي عدم تطابق
          // المادة/المرحلة) نعرضها هي بدل رسالة "QR غير موجود" العامة، عشان المدرس يفهم
          // السبب الحقيقي (مش مجرد QR غلط).
          const externalMsg = externalErr?.response?.data?.error?.message;
          if (externalMsg) {
            setScanMsg({ text: `❌ ${externalMsg}`, level: 'error' });
            setTimeout(() => setScanMsg(null), 3000);
            scanRef.current?.focus();
            setScanInput('');
            return;
          }
        }
      }
      const msg = err?.response?.data?.error?.message || 'QR غير صحيح';
      setScanMsg({ text: `❌ ${msg}`, level: 'error' });
      setTimeout(() => setScanMsg(null), 3000);
      scanRef.current?.focus();
    }
    setScanInput('');
  };

  const handleStatusChange = async (studentId: string, status: AttendanceStatus) => {
    const current = attendance.find(a => a.studentId === studentId);
    if (status === 'absent' && current?.isExternal) {
      const ok = await confirm(
        `${current.studentName} حاضر هنا كبديل من مجموعة تانية — تسجيله غايب هيشيله من الحصة دي ويلغي رصيد التعويض بتاعه. متأكد؟`,
        { danger: true },
      );
      if (!ok) return;
    }
    const record = await updateOne.mutateAsync({ studentId, payload: { status } });
    // التنبيه يخص الطالب اللي بيتسجل حاضر/متأخر فعليًا — مش وقت تعليمه غايب
    if (status === 'present' || status === 'late') {
      const warnings = checkAttendanceWarnings(studentId, previousAbsent, unpaidStudents);
      showCheckInResult(record.studentName, warnings);
    }
  };

  const tabFiltered = activeTab === 'present'
    ? attendance.filter(a => a.status === 'present' || a.status === 'late')
    : activeTab === 'absent'
    ? attendance.filter(a => a.status === 'absent' || a.status === 'excused')
    : attendance;

  const filteredAttendance = searchFilter
    ? tabFiltered.filter(a =>
        a.studentName?.includes(searchFilter) ||
        a.studentCode?.includes(searchFilter)
      )
    : tabFiltered;

  const present = attendance.filter(a => a.status === 'present').length;
  const late    = attendance.filter(a => a.status === 'late').length;
  const absent  = attendance.filter(a => a.status === 'absent').length;
  const excused = attendance.filter(a => a.status === 'excused').length;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" dir="rtl">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-gray-900 truncate">{session.title}</h2>
            <p className="text-xs text-gray-400">{session.groupName || session.grade}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Export buttons */}
            {attendance.length > 0 && (
              <>
                <button
                  onClick={() => handleExport('xlsx')}
                  disabled={exportLoading !== null}
                  title="تصدير Excel"
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {exportLoading === 'xlsx' ? '...' : 'Excel'}
                </button>
                <button
                  onClick={() => handleExport('pdf')}
                  disabled={exportLoading !== null}
                  title="تصدير PDF"
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {exportLoading === 'pdf' ? '...' : 'PDF'}
                </button>
              </>
            )}
            {canMark && sessionHasImage(session.type) && (
              <>
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0])} />
                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 hover:bg-gray-50 disabled:opacity-50">
                  {uploading ? '...' : 'صورة'}
                </button>
              </>
            )}
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
              <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Session Image */}
        {session.imageUrl && (
          <div className="px-4 pt-3 shrink-0 relative">
            <button onClick={() => setShowFullImage(true)} className="block w-full">
              <img
                src={getFullMediaUrl(session.imageUrl)}
                alt="صورة الحصة"
                className="w-full max-h-40 object-cover rounded-xl border border-gray-100 hover:opacity-90 transition-opacity"
              />
            </button>
            {canMark && (
              <button
                onClick={handleImageRemove}
                disabled={removingImage}
                className="absolute top-5 left-2 w-7 h-7 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white disabled:opacity-50"
                title="حذف الصورة"
              >
                {removingImage ? (
                  <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
                  </svg>
                )}
              </button>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 px-4 py-3 border-b border-gray-50 shrink-0">
          <div className="text-center bg-emerald-50 rounded-xl py-2">
            <p className="text-lg font-bold text-emerald-600">{present}</p>
            <p className="text-xs text-emerald-500">حاضر</p>
          </div>
          <div className="text-center bg-amber-50 rounded-xl py-2">
            <p className="text-lg font-bold text-amber-500">{late}</p>
            <p className="text-xs text-amber-400">متأخر</p>
          </div>
          <div className="text-center bg-red-50 rounded-xl py-2">
            <p className="text-lg font-bold text-red-500">{absent}</p>
            <p className="text-xs text-red-400">غايب</p>
          </div>
          <div className="text-center bg-purple-50 rounded-xl py-2">
            <p className="text-lg font-bold text-purple-500">{excused}</p>
            <p className="text-xs text-purple-400">معذور</p>
          </div>
        </div>

        {/* Tabs: الكل / حاضرين / غايبين */}
        <div className="flex gap-1.5 px-4 py-2 border-b border-gray-50 shrink-0">
          {([
            { key: 'all',     label: 'الكل',    count: attendance.length },
            { key: 'present', label: 'حاضرين',  count: present + late },
            { key: 'absent',  label: 'غايبين',  count: absent + excused },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                activeTab === tab.key
                  ? 'bg-[#0E3B2E] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {tab.label}
              <span className={`mr-1 ${
                activeTab === tab.key ? 'opacity-80' : 'opacity-60'
              }`}>
                ({tab.count})
              </span>
            </button>
          ))}
        </div>

        {/* QR Scanner + طالب بديل */}
        {isOpen && canMark && (
          <div className="px-4 py-3 border-b border-gray-50 shrink-0 space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 flex-1 p-2.5 bg-gray-50 rounded-xl border border-gray-200">
                <svg className="w-4 h-4 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                  <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/>
                </svg>
                <input
                  ref={scanRef}
                  type="text"
                  value={scanInput}
                  onChange={e => setScanInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleScan(scanInput)}
                  placeholder="سكان QR أو اكتب الكود..."
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400 min-w-0"
                />
                {scanInput && (
                  <button onClick={() => handleScan(scanInput)}
                    className="text-xs bg-[#0E3B2E] text-white px-2 py-1 rounded-lg shrink-0">
                    ✓
                  </button>
                )}
              </div>
              {/* زرار الكاميرا */}
              <button onClick={() => setShowCamera(true)}
                className="w-10 h-10 shrink-0 flex items-center justify-center rounded-xl bg-[#0E3B2E] text-white hover:bg-[#1F6B4E] transition-colors">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </button>
            </div>
            {scanMsg && (
              scanMsg.level === 'warning' ? (
                <p className="text-sm px-2 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-300 font-semibold">
                  {scanMsg.text}
                </p>
              ) : (
                <p className={`text-sm px-1 ${scanMsg.level === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>
                  {scanMsg.text}
                </p>
              )
            )}

            {/* طالب من مجموعة تانية */}
            <button onClick={() => setShowExternal(!showExternal)}
              className="text-xs text-gray-400 hover:text-[#0E3B2E] underline">
              {showExternal ? 'إخفاء' : 'طالب من مجموعة تانية؟'}
            </button>

            {showExternal && (
              <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100 space-y-2">
                <p className="text-xs text-purple-600">
                  للطالب اللي حضر بديل مادته الأصلية في مجموعة تانية (مش من روستر الحصة دي)
                </p>
                <input
                  type="text"
                  value={externalSearch}
                  onChange={e => setExternalSearch(e.target.value)}
                  placeholder="ابحث باسم الطالب..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-200"
                />
                {externalSearch && (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {externalResults.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-2">لا توجد نتائج</p>
                    ) : (
                      externalResults.map(s => (
                        <div key={s.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{s.fullName}</p>
                            <p className="text-xs text-gray-400">{s.grade || 'بدون مرحلة'}</p>
                          </div>
                          <button
                            onClick={() => handleAddExternal(s.id, s.fullName)}
                            disabled={addExternal.isPending}
                            className="text-xs bg-purple-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-purple-700 disabled:opacity-50 shrink-0">
                            إضافة
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Attendance List */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {isLoading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : filteredAttendance.length === 0 && !searchFilter ? (
            <p className="text-center text-gray-400 text-sm py-8">لا يوجد طلاب مسجلين</p>
          ) : (
            filteredAttendance.map(record => (
              <div key={record.id}
                className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
                  record.status === 'present' ? 'bg-emerald-100 text-emerald-700' :
                  record.status === 'late'    ? 'bg-amber-100 text-amber-700' :
                  record.status === 'excused' ? 'bg-purple-100 text-purple-700' :
                                                'bg-red-100 text-red-600'
                }`}>
                  {record.studentName.charAt(0)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-medium text-gray-900 truncate">{record.studentName}</p>
                    {previousAbsent.includes(record.studentId) && (
                      <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full shrink-0">
                        ⚠️ غايب السابقة
                      </span>
                    )}
                    {unpaidStudents.includes(record.studentId) && (
                      <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full shrink-0">
                        💰 لسه مدفعش
                      </span>
                    )}
                    {record.isExternal && (
                      <span className="text-xs bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded-full shrink-0" title="من مجموعة تانية — حضوره هنا بيتحسب رصيد تعويض">
                        بديل
                      </span>
                    )}
                    {record.status === 'excused' && (
                      <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full shrink-0" title={record.notes || ''}>
                        معذور
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 font-mono">{record.studentCode}</p>
                </div>

                {/* Status */}
                {isOpen && canMark ? (
                  <div className="flex gap-1 shrink-0">
                    {(['present', 'late', 'absent'] as AttendanceStatus[]).map(s => (
                      <button key={s} onClick={() => handleStatusChange(record.studentId, s)}
                        className={`text-xs px-2 py-1.5 rounded-lg border transition-all ${
                          record.status === s
                            ? ATTENDANCE_STATUS_LABELS[s].class + ' border-current font-bold'
                            : 'bg-white text-gray-400 border-gray-200'
                        }`}>
                        {ATTENDANCE_STATUS_LABELS[s].label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className={`text-xs px-2 py-1 rounded-full border shrink-0 ${ATTENDANCE_STATUS_LABELS[record.status].class}`}>
                    {ATTENDANCE_STATUS_LABELS[record.status].label}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {showCamera && canMark && (
        <QrCameraScanner
          onScan={handleScan}
          onClose={() => setShowCamera(false)}
        />
      )}

      {/* Full Image Lightbox */}
      {showFullImage && session.imageUrl && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setShowFullImage(false)}
        >
          <button
            onClick={() => setShowFullImage(false)}
            className="absolute top-4 left-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
            </svg>
          </button>
          <img
            src={getFullMediaUrl(session.imageUrl)}
            alt="صورة الحصة"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
