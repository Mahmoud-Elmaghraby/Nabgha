import { useAbsenceReport } from '../hooks/useSessions';
import type { Session } from '../types/session.types';

interface Props {
  session: Session;
  onClose: () => void;
}

export function AbsenceReportModal({ session, onClose }: Props) {
  const { data: rows = [], isLoading } = useAbsenceReport(session.id);

  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" dir="rtl">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #absence-report-print, #absence-report-print * { visibility: visible; }
          #absence-report-print {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            padding: 16px;
          }
        }
      `}</style>

      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">تقرير الغياب</h2>
            <p className="text-xs text-gray-400 mt-0.5">{session.title} — {session.groupName}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {rows.length > 0 && (
              <button onClick={handlePrint}
                className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 6 2 18 2 18 9"/>
                  <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
                  <rect x="6" y="14" width="12" height="8"/>
                </svg>
                طباعة
              </button>
            )}
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
              <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-sm">مفيش أي طالب غايب في الحصة دي 🎉</p>
            </div>
          ) : (
            <div id="absence-report-print">
              <div className="mb-4">
                <h1 className="text-base font-bold text-gray-900">تقرير غياب — {session.title}</h1>
                <p className="text-xs text-gray-400 mt-0.5">
                  {session.groupName} — {new Date(session.startDate).toLocaleDateString('ar-EG')}
                </p>
              </div>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b-2 border-gray-200">
                    <th className="text-right py-2 px-2 font-semibold text-gray-600">#</th>
                    <th className="text-right py-2 px-2 font-semibold text-gray-600">الاسم</th>
                    <th className="text-right py-2 px-2 font-semibold text-gray-600">الكود</th>
                    <th className="text-right py-2 px-2 font-semibold text-gray-600">رقم ولي الأمر</th>
                    <th className="text-center py-2 px-2 font-semibold text-gray-600">الغياب</th>
                    <th className="text-center py-2 px-2 font-semibold text-gray-600">النسبة</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const rate = row.totalSessions > 0 ? Math.round((row.absentCount / row.totalSessions) * 100) : 0;
                    return (
                      <tr key={row.studentId} className="border-b border-gray-100">
                        <td className="py-2 px-2 text-gray-400">{i + 1}</td>
                        <td className="py-2 px-2 font-medium text-gray-900">{row.studentName}</td>
                        <td className="py-2 px-2 text-gray-500 font-mono text-xs">{row.studentCode}</td>
                        <td className="py-2 px-2 text-gray-500 font-mono text-xs text-right" dir="ltr">{row.parentPhone || '—'}</td>
                        <td className="py-2 px-2 text-center text-gray-700">{row.absentCount}/{row.totalSessions}</td>
                        <td className={`py-2 px-2 text-center font-bold ${rate >= 30 ? 'text-red-500' : 'text-amber-500'}`}>
                          {rate}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
