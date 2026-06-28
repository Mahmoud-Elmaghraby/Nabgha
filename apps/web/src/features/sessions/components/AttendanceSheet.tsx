import { useState, useEffect, useRef } from 'react';
import { useSessionAttendance, useAttendanceMutations, usePreviousAbsent } from '../hooks/useSessions';
import { QrCameraScanner } from './QrCameraScanner';
import { sessionsApi } from '../api/sessions.api';
import { useQueryClient } from '@tanstack/react-query';
import { SESSION_KEYS } from '../hooks/useSessions';
import { ATTENDANCE_STATUS_LABELS } from '../types/session.types';
import { sessionHasImage } from '../types/session.types';
import type { Session, AttendanceStatus } from '../types/session.types';

interface Props {
  session: Session;
  onClose: () => void;
}

export function AttendanceSheet({ session, onClose }: Props) {
  const { data: attendance = [], isLoading } = useSessionAttendance(session.id);
  const { updateOne, scanQr } = useAttendanceMutations(session.id);
  const { data: previousAbsent = [] } = usePreviousAbsent(session.id);
  const qc = useQueryClient();
  const [scanInput, setScanInput] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [scanMsg, setScanMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  const isOpen = session.status === 'scheduled' || session.status === 'ongoing';

  useEffect(() => {
    if (isOpen) scanRef.current?.focus();
  }, [isOpen, attendance]);

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      await sessionsApi.uploadImage(session.id, file);
      qc.invalidateQueries({ queryKey: SESSION_KEYS.all });
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'فشل رفع الصورة');
    } finally {
      setUploading(false);
    }
  };

  const handleScan = async (qrCode: string): Promise<{ studentId?: string } | void> => {
    if (!qrCode.trim()) return;
    try {
      const record = await scanQr.mutateAsync(qrCode.trim());
      setScanMsg({ text: `✅ ${record.studentName} — حاضر`, ok: true });
      setTimeout(() => setScanMsg(null), 3000);
      scanRef.current?.focus();
      setScanInput('');
      setSearchFilter('');
      return { studentId: record.studentId };
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || 'QR غير صحيح';
      setScanMsg({ text: `❌ ${msg}`, ok: false });
      setTimeout(() => setScanMsg(null), 3000);
      scanRef.current?.focus();
    }
    setScanInput('');
  };

  const handleStatusChange = async (studentId: string, status: AttendanceStatus) => {
    await updateOne.mutateAsync({ studentId, payload: { status } });
  };

  const filteredAttendance = searchFilter
    ? attendance.filter(a => 
        a.studentName?.includes(searchFilter) || 
        a.studentCode?.includes(searchFilter)
      )
    : attendance;

  const present = attendance.filter(a => a.status === 'present').length;
  const late    = attendance.filter(a => a.status === 'late').length;
  const absent  = attendance.filter(a => a.status === 'absent').length;

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
            {sessionHasImage(session.type) && (
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

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 px-4 py-3 border-b border-gray-50 shrink-0">
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
        </div>

        {/* QR Scanner */}
        {isOpen && (
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
              <p className={`text-sm px-1 ${scanMsg.ok ? 'text-emerald-600' : 'text-red-500'}`}>
                {scanMsg.text}
              </p>
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
                  </div>
                  <p className="text-xs text-gray-400 font-mono">{record.studentCode}</p>
                </div>

                {/* Status */}
                {isOpen ? (
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

      {showCamera && (
        <QrCameraScanner
          onScan={async (qr) => { await handleScan(qr); }}
          previousAbsent={previousAbsent}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
}
