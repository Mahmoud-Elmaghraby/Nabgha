import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Calendar, ClipboardCheck, Wallet } from 'lucide-react';
import { useParentStudentDetail } from '../hooks/useParentAuth';

const ATTENDANCE_LABELS: Record<string, { label: string; className: string }> = {
  present: { label: 'حاضر', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  absent: { label: 'غائب', className: 'bg-red-50 text-red-700 border-red-200' },
  late: { label: 'متأخر', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  excused: { label: 'معذور', className: 'bg-purple-50 text-purple-700 border-purple-200' },
};

const DUE_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  unpaid: { label: 'غير مدفوع', className: 'bg-red-50 text-red-700 border-red-200' },
  partial: { label: 'مدفوع جزئيًا', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  paid: { label: 'مدفوع بالكامل', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  waived: { label: 'معفى', className: 'bg-gray-100 text-gray-600 border-gray-200' },
};

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
  } catch {
    return dateStr;
  }
}

export default function ParentStudentDetailPage() {
  const { slug = '', studentId = '' } = useParams<{ slug: string; studentId: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useParentStudentDetail(slug, studentId);

  if (isLoading) {
    return <div className="text-center text-gray-400 text-sm py-10">جاري التحميل...</div>;
  }

  if (isError || !data) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center text-gray-400 text-sm">
        تعذر تحميل بيانات الطالب
      </div>
    );
  }

  const { student, upcomingSessions, attendance, finance } = data;

  return (
    <div className="space-y-5">
      <button
        onClick={() => navigate(`/parent/${slug}/dashboard`)}
        className="flex items-center gap-1.5 text-gray-500 text-sm hover:text-[#0E3B2E]"
      >
        <ArrowRight size={16} />
        رجوع لكل الأبناء
      </button>

      <div className="bg-[#0E3B2E] rounded-2xl px-4 py-4 flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center text-white font-bold">
          {student.fullName.charAt(0)}
        </div>
        <div>
          <p className="text-white font-bold">{student.fullName}</p>
          {student.grade && <p className="text-white/60 text-xs mt-0.5">{student.grade}</p>}
        </div>
      </div>

      {/* الحصص القادمة */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
          <Calendar size={16} className="text-[#0E3B2E]" />
          <h2 className="text-sm font-bold text-[#0E3B2E]">الحصص القادمة</h2>
        </div>
        {upcomingSessions.length === 0 ? (
          <p className="text-gray-400 text-xs text-center py-5">لا يوجد حصص قادمة مجدولة حاليًا</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {upcomingSessions.map((s) => (
              <li key={s.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{s.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {s.subjectName ?? s.groupName ?? ''} {s.startTime ? `• ${s.startTime.slice(0, 5)}` : ''}
                  </p>
                </div>
                <span className="text-xs text-gray-500 shrink-0">{formatDate(s.startDate)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* الحضور والدرجات */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
          <ClipboardCheck size={16} className="text-[#0E3B2E]" />
          <h2 className="text-sm font-bold text-[#0E3B2E]">سجل الحضور والدرجات</h2>
        </div>
        {attendance.length === 0 ? (
          <p className="text-gray-400 text-xs text-center py-5">لا يوجد سجل حضور بعد</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {attendance.slice(0, 20).map((a) => {
              const badge = ATTENDANCE_LABELS[a.status] ?? { label: a.status, className: 'bg-gray-50 text-gray-600 border-gray-200' };
              return (
                <li key={a.id} className="px-4 py-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{a.sessionTitle}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(a.startDate)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {a.degree !== null && (
                      <span className="text-xs font-bold text-[#0E3B2E]">
                        {a.degree}{a.outOf ? `/${a.outOf}` : ''}
                      </span>
                    )}
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border ${badge.className}`}>{badge.label}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* المستحقات المالية */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-[#0E3B2E]" />
            <h2 className="text-sm font-bold text-[#0E3B2E]">المستحقات المالية</h2>
          </div>
          <span className={`text-xs font-bold ${finance.totalRemaining > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {finance.totalRemaining > 0 ? `متبقي ${finance.totalRemaining} ج.م` : 'لا يوجد مستحقات'}
          </span>
        </div>
        {finance.dues.length === 0 ? (
          <p className="text-gray-400 text-xs text-center py-5">لا يوجد مستحقات مسجلة</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {finance.dues.map((d) => {
              const badge = DUE_STATUS_LABELS[d.status] ?? { label: d.status, className: 'bg-gray-50 text-gray-600 border-gray-200' };
              return (
                <li key={d.id} className="px-4 py-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {d.subjectName ?? 'رسوم'} — {d.month}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {d.paidAmount} من {d.netDue} ج.م
                    </p>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full border shrink-0 ${badge.className}`}>{badge.label}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
