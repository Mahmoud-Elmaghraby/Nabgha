import { useState, useRef, useCallback, useEffect } from 'react';
import { useVoiceSearch } from '@/shared/hooks/useVoiceSearch';
import { useSessionAttendance, useAttendanceMutations } from '../hooks/useSessions';
import type { Session } from '../types/session.types';

interface Props {
  session: Session;
  onClose: () => void;
}

export function DegreesSheet({ session, onClose }: Props) {
  const { data: attendance = [], isLoading } = useSessionAttendance(session.id);
  const { updateOne } = useAttendanceMutations(session.id);
  const [degrees, setDegrees] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const handleVoiceResult = useCallback((text: string) => {
    setSearch(text.trim());
  }, []);

  const { isListening, startListening, stopListening, error: voiceError } = useVoiceSearch({
    onResult: handleVoiceResult,
  });

  // الطلاب الحاضرين فقط
  const presentAll = attendance.filter(a => a.status === 'present' || a.status === 'late');
  const present = search.trim()
    ? presentAll.filter(a => a.studentName.includes(search.trim()))
    : presentAll;
  const absent  = attendance.filter(a => a.status === 'absent');

  // لما البحث يرجع نتيجة واحدة — اعمل focus على خانة الدرجة تلقائياً
  useEffect(() => {
    if (search.trim() && present.length === 1) {
      setTimeout(() => {
        const input = document.querySelector<HTMLInputElement>('.degree-input');
        input?.focus();
        input?.select();
      }, 100);
    }
  }, [search, present.length]);

  const handleDegreeBlur = async (studentId: string) => {
    const val = degrees[studentId];
    if (val === undefined || val === '') return;
    const degree = Number(val);
    if (isNaN(degree) || degree < 0) return;
    if (session.outOf && degree > session.outOf) return;

    setSaving(prev => ({ ...prev, [studentId]: true }));
    try {
      await updateOne.mutateAsync({ studentId, payload: { degree } as any });
    } finally {
      setSaving(prev => ({ ...prev, [studentId]: false }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, studentId: string, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleDegreeBlur(studentId);
      // انتقل للطالب التالي
      const inputs = document.querySelectorAll<HTMLInputElement>('.degree-input');
      inputs[index + 1]?.focus();
    }
  };

  const getDegreeValue = (studentId: string, recordDegree: number | null) => {
    if (degrees[studentId] !== undefined) return degrees[studentId];
    return recordDegree !== null ? String(recordDegree) : '';
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">رصد الدرجات</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {session.title} {session.outOf ? `— من ${session.outOf} درجة` : ''}
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
            <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 px-5 py-3 border-b border-gray-50 shrink-0">
          <span className="text-sm text-gray-500">
            حاضر: <span className="font-bold text-emerald-600">{present.length}</span>
          </span>
          <span className="text-sm text-gray-500">
            غايب: <span className="font-bold text-red-500">{absent.length}</span>
          </span>
          <span className="text-sm text-gray-500">
            رُصدت: <span className="font-bold text-[#0E3B2E]">
              {present.filter(a => {
                const val = degrees[a.studentId];
                return val !== undefined ? val !== '' : a.degree !== null;
              }).length}
            </span>
          </span>
        </div>

        {/* Search Bar */}
        <div className="px-5 py-3 border-b border-gray-50 shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="ابحث باسم الطالب..."
                className="w-full border border-gray-200 rounded-xl pr-9 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20"
              />
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
              </svg>
              {search && (
                <button onClick={() => setSearch('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              )}
            </div>
            <button
              onClick={isListening ? stopListening : startListening}
              className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all shrink-0 ${
                isListening
                  ? 'bg-red-500 border-red-500 text-white animate-pulse'
                  : 'bg-white border-gray-200 text-gray-500 hover:border-[#0E3B2E]/30 hover:text-[#0E3B2E]'
              }`}
              title={isListening ? 'إيقاف التسجيل' : 'بحث صوتي'}
            >
              {isListening ? (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/>
                  <path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23M12 19v4M8 23h8"/>
                </svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                  <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/>
                </svg>
              )}
            </button>
          </div>
          {isListening && (
            <p className="text-xs text-red-500 mt-1.5 animate-pulse">● جاري الاستماع... قل اسم الطالب</p>
          )}
          {voiceError && (
            <p className="text-xs text-red-400 mt-1.5">{voiceError}</p>
          )}
          {search && !isListening && (
            <p className="text-xs text-gray-400 mt-1.5">نتائج البحث عن: <span className="font-medium text-gray-600">{search}</span></p>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {isLoading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : present.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <svg className="w-10 h-10 mx-auto mb-3 text-gray-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
              </svg>
              <p className="text-sm">لا يوجد طلاب حاضرون</p>
              <p className="text-xs mt-1">سجّل الحضور أولاً من شاشة الحضور</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-400 mb-2">اضغط Enter للانتقال للطالب التالي</p>
              {present.map((record, index) => (
                <div key={record.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-sm font-bold text-emerald-700 shrink-0">
                    {record.studentName.charAt(0)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{record.studentName}</p>
                    <p className="text-xs text-gray-400 font-mono">{record.studentCode}</p>
                  </div>

                  {/* Status badge */}
                  {record.status === 'late' && (
                    <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-full shrink-0">
                      متأخر
                    </span>
                  )}

                  {/* Degree input */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      type="number"
                      min={0}
                      max={session.outOf ?? undefined}
                      value={getDegreeValue(record.studentId, record.degree)}
                      onChange={e => setDegrees(prev => ({ ...prev, [record.studentId]: e.target.value }))}
                      onBlur={() => handleDegreeBlur(record.studentId)}
                      onKeyDown={e => handleKeyDown(e, record.studentId, index)}
                      placeholder="—"
                      className="degree-input w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20 focus:border-[#0E3B2E]/40"
                    />
                    {session.outOf && (
                      <span className="text-xs text-gray-400">/{session.outOf}</span>
                    )}
                    {saving[record.studentId] && (
                      <div className="w-3 h-3 border border-[#0E3B2E] border-t-transparent rounded-full animate-spin" />
                    )}
                    {!saving[record.studentId] && degrees[record.studentId] !== undefined && (
                      <svg className="w-3.5 h-3.5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                </div>
              ))}

              {/* الغايبين */}
              {absent.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-gray-400 mb-2 px-1">غايبون — بدون درجة</p>
                  {absent.map(record => (
                    <div key={record.id}
                      className="flex items-center gap-3 p-3 bg-red-50/50 rounded-xl border border-red-100 mb-2 opacity-60">
                      <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center text-sm font-bold text-red-500 shrink-0">
                        {record.studentName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">{record.studentName}</p>
                        <p className="text-xs text-gray-400 font-mono">{record.studentCode}</p>
                      </div>
                      <span className="text-xs px-2 py-0.5 bg-red-50 text-red-500 border border-red-200 rounded-full">غايب</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
