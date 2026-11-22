import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/lib/api/client';
import { usePermissions } from '@/shared/hooks/usePermissions';
import { useResolveAudience, useWaBulkProgress } from '../../whatsapp/hooks/useWhatsapp';
import { useGroups } from '@/features/groups/hooks/useGroups';
import { getGroupSelectLabel } from '@/features/groups/utils/formatGroupLabel';
import { useSubjects } from '@/features/subjects/hooks/useSubjects';
import { useTeachers } from '@/features/teachers/hooks/useTeachers';
import { GRADE_OPTIONS } from '@nabgha/types';
import type { AudienceType, ResolveAudienceParams, AudienceStudent } from '../../whatsapp/types/whatsapp.types';

const AUDIENCE_OPTIONS: { value: AudienceType; label: string }[] = [
  { value: 'all', label: 'كل الطلاب' },
  { value: 'group', label: 'مجموعة معينة' },
  { value: 'subjectGrade', label: 'مادة + صف معين' },
  { value: 'grade', label: 'صف دراسي كامل' },
  { value: 'teacher', label: 'مدرس معين' },
];

interface LinkStatusItem {
  studentId: string;
  isLinked: boolean;
  chatId: string | null;
  linkedAt: string | null;
}

function mapSendError(err: any): string {
  const msg = err?.response?.data?.error?.message ?? err?.response?.data?.message ?? err?.message ?? 'حدث خطأ أثناء الإرسال';
  if (msg === 'not_connected') return 'الواتساب غير متصل — يرجى الاتصال أولاً من تبويب واتساب';
  if (msg === 'wa_disabled') return 'الواتساب معطّل — يرجى تفعيله من الإعدادات';
  if (msg === 'telegram_not_connected') return 'بوت التليجرام غير متصل — لازم توصّل بوت من تبويب "الاتصال" الأول';
  if (msg === 'bulk_job_already_running') return 'فيه إرسال شغال بالفعل — انتظر لحد ما يخلص قبل ما تبدأ واحد جديد';
  return msg;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

// صف واحد بيدير الإرسال الفردي (وتتبّع تقدّمه) بمعزل عن باقي الصفوف — كل صف
// بيبقى عنده jobId خاص بيه لو ضغط "إرسال رابط"، مش job واحد مشترك للجدول كله.
function LinkStatusRow({ student, status }: { student: AudienceStudent; status: LinkStatusItem | undefined }) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const { data: progress } = useWaBulkProgress(jobId);
  const isRunning = progress?.status === 'running' || progress?.status === 'pending';
  const isDone = progress?.status === 'completed';
  const sentOk = isDone && (progress?.sent ?? 0) > 0;
  const sentFailed = isDone && (progress?.sent ?? 0) === 0;

  const handleSendOne = async () => {
    setError('');
    try {
      const res = await apiClient.post('/telegram/bulk-links', {
        type: 'students',
        studentIds: [student.studentId],
      });
      const data = res.data.data;
      if (data.jobId) setJobId(data.jobId);
      else if (data.eligible === 0) setError(data.alreadyLinked > 0 ? 'مربوط بالفعل' : 'لا يوجد رقم ولي أمر صالح');
    } catch (err: any) {
      setError(mapSendError(err));
    }
  };

  const isLinked = status?.isLinked ?? false;

  return (
    <tr className="border-b border-gray-50 last:border-0">
      <td className="py-2.5 px-3 text-xs text-gray-500 font-mono">{student.studentCode}</td>
      <td className="py-2.5 px-3 text-sm text-gray-800">{student.studentName}</td>
      <td className="py-2.5 px-3 text-xs text-gray-500 font-mono" dir="ltr">{student.parentPhone || '—'}</td>
      <td className="py-2.5 px-3">
        {isLinked ? (
          <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full">مرتبط ✅</span>
        ) : (
          <span className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-full">غير مرتبط ❌</span>
        )}
      </td>
      <td className="py-2.5 px-3 text-xs text-gray-500">{isLinked ? formatDate(status!.linkedAt) : '—'}</td>
      <td className="py-2.5 px-3">
        {!isLinked && (
          <div className="flex flex-col items-start gap-1">
            <button
              onClick={handleSendOne}
              disabled={isRunning || sentOk || !student.parentPhone}
              title={!student.parentPhone ? 'لا يوجد رقم ولي أمر مسجّل' : undefined}
              className="text-xs px-2.5 py-1 rounded-lg bg-[#0E3B2E] text-white hover:bg-[#1F6B4E] disabled:opacity-50 whitespace-nowrap"
            >
              {isRunning ? 'جاري الإرسال...' : sentOk ? 'تم الإرسال ✅' : 'إرسال رابط'}
            </button>
            {sentFailed && <span className="text-[11px] text-red-600">فشل الإرسال</span>}
            {error && <span className="text-[11px] text-red-600">{error}</span>}
          </div>
        )}
      </td>
    </tr>
  );
}

// تاب "حالة الربط" — يعرض كل طالب في النطاق المختار (كل الطلاب/مجموعة/مادة+صف/
// صف كامل/مدرس، نفس فلاتر الإرسال الجماعي بالظبط) مع حالة ربطه بتليجرام،
// وبيسمح بإرسال رابط لطالب واحد غير مربوط، أو لكل الغير مربوطين في النطاق دفعة
// واحدة. الفلترة والإرسال بيستخدموا نفس endpoints الإرسال الجماعي الموجودة
// أصلاً (GET /whatsapp/audience، POST /telegram/bulk-links) — صفر منطق مكرر.
export function TelegramLinkStatus() {
  const { hasPermission } = usePermissions();
  const canView = hasPermission('students.view');
  const canSend = hasPermission('reports.send_whatsapp');

  const [audienceType, setAudienceType] = useState<AudienceType>('all');
  const [groupId, setGroupId] = useState('');
  const [subjectGradeId, setSubjectGradeId] = useState('');
  const [grade, setGrade] = useState('');
  const [teacherId, setTeacherId] = useState('');

  const [bulkJobId, setBulkJobId] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState('');
  const [isBulkSending, setIsBulkSending] = useState(false);

  const { data: groupsData } = useGroups({ limit: 1000 });
  const { data: subjects = [] } = useSubjects();
  const { data: teachersData } = useTeachers();

  const groups = groupsData?.data || [];
  const teachers = teachersData?.data || [];
  const subjectGradeOptions = subjects.flatMap((item: any) =>
    item.grades.map((g: any) => ({ value: g.id, label: `${item.subject.name} — ${g.grade}` }))
  );

  const audienceParams: ResolveAudienceParams = useMemo(
    () => ({ type: audienceType, groupId, subjectGradeId, grade, teacherId }),
    [audienceType, groupId, subjectGradeId, grade, teacherId],
  );

  const { data: audience = [], isFetching: resolvingAudience } = useResolveAudience(audienceParams);

  const studentIds = useMemo(() => audience.map((s: AudienceStudent) => s.studentId), [audience]);

  const { data: statuses = [], isFetching: loadingStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['telegram', 'link-status', studentIds],
    queryFn: () =>
      apiClient.post('/telegram/link-status', { studentIds }).then((r) => r.data.data as LinkStatusItem[]),
    enabled: studentIds.length > 0,
  });

  const statusMap = useMemo(() => {
    const map = new Map<string, LinkStatusItem>();
    statuses.forEach((s) => map.set(s.studentId, s));
    return map;
  }, [statuses]);

  // غير المربوطين أولاً (الأولوية العملية: مين محتاج متابعة)، وبعدين المربوطين
  const sortedAudience = useMemo(() => {
    return [...audience].sort((a, b) => {
      const aLinked = statusMap.get(a.studentId)?.isLinked ?? false;
      const bLinked = statusMap.get(b.studentId)?.isLinked ?? false;
      if (aLinked !== bLinked) return aLinked ? 1 : -1;
      return a.studentName.localeCompare(b.studentName, 'ar');
    });
  }, [audience, statusMap]);

  const linkedCount = statuses.filter((s) => s.isLinked).length;
  const notLinkedCount = statuses.length - linkedCount;

  const { data: bulkProgress } = useWaBulkProgress(bulkJobId);
  const isBulkRunning = bulkProgress?.status === 'running' || bulkProgress?.status === 'pending';

  const handleSendAllUnlinked = async () => {
    setBulkError('');
    setIsBulkSending(true);
    try {
      const cleaned: Record<string, string> = {};
      Object.entries(audienceParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '' && !Array.isArray(value)) {
          cleaned[key] = String(value);
        }
      });
      const res = await apiClient.post('/telegram/bulk-links', cleaned);
      const data = res.data.data;
      if (data.jobId) {
        setBulkJobId(data.jobId);
      } else if (data.eligible === 0) {
        setBulkError(
          data.alreadyLinked > 0
            ? 'كل الطلاب في النطاق ده مربوطين بتليجرام بالفعل ✅'
            : 'مفيش طلاب برقم ولي أمر صالح في النطاق المختار',
        );
      }
    } catch (err: any) {
      setBulkError(mapSendError(err));
    } finally {
      setIsBulkSending(false);
    }
  };

  if (!canView) return null;

  return (
    <div className="space-y-4" dir="rtl">
      <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
        <div>
          <h3 className="font-bold text-[#0E3B2E] text-base">حالة الربط بتليجرام</h3>
          <p className="text-xs text-gray-500 mt-1">
            حدد نطاق (كل الطلاب / مجموعة / مدرس...) لتعرف مين ربط حسابه بتليجرام ومين لسه لأ
          </p>
        </div>

        <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">النطاق</label>
            <div className="grid grid-cols-2 gap-2">
              {AUDIENCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setAudienceType(opt.value)}
                  className={`py-2 px-3 rounded-lg text-xs border transition-all text-right ${
                    audienceType === opt.value
                      ? 'bg-[#0E3B2E] text-white border-[#0E3B2E]'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {audienceType === 'group' && (
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="">اختر مجموعة</option>
              {groups.map((g: any) => <option key={g.id} value={g.id}>{getGroupSelectLabel(g)}</option>)}
            </select>
          )}

          {audienceType === 'subjectGrade' && (
            <select value={subjectGradeId} onChange={(e) => setSubjectGradeId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="">اختر المادة والصف</option>
              {subjectGradeOptions.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}

          {audienceType === 'grade' && (
            <select value={grade} onChange={(e) => setGrade(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="">اختر الصف الدراسي</option>
              {GRADE_OPTIONS.map((g: string) => <option key={g} value={g}>{g}</option>)}
            </select>
          )}

          {audienceType === 'teacher' && (
            <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="">اختر المدرس</option>
              {teachers.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}

          <div className="flex items-center justify-between text-xs text-gray-500 bg-white rounded-lg px-3 py-2 border border-gray-100">
            <span>
              {resolvingAudience || loadingStatus
                ? 'جاري الحساب...'
                : `👥 ${statuses.length} طالب — ✅ ${linkedCount} مرتبط — ❌ ${notLinkedCount} غير مرتبط`}
            </span>
            <button onClick={() => refetchStatus()} className="text-[#0E3B2E] hover:underline">تحديث</button>
          </div>
        </div>

        {canSend && notLinkedCount > 0 && (
          <div className="space-y-2">
            {!bulkJobId ? (
              <>
                {bulkError && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{bulkError}</p>}
                <button
                  onClick={handleSendAllUnlinked}
                  disabled={isBulkSending}
                  className="w-full py-2.5 border border-[#0E3B2E] text-[#0E3B2E] text-sm font-medium rounded-lg hover:bg-[#0E3B2E]/5 disabled:opacity-50"
                >
                  {isBulkSending ? 'جاري البدء...' : `إرسال رابط لكل الغير مربوطين (${notLinkedCount})`}
                </button>
              </>
            ) : (
              <div className="space-y-2 bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">
                    {isBulkRunning ? 'جاري الإرسال...' : 'اكتمل'} — {bulkProgress?.sent ?? 0} وصلت / {bulkProgress?.failed ?? 0} فشلت من {bulkProgress?.total ?? 0}
                  </span>
                  {!isBulkRunning && (
                    <button onClick={() => { setBulkJobId(null); refetchStatus(); }} className="text-xs text-[#0E3B2E] hover:underline">
                      إغلاق
                    </button>
                  )}
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div className="bg-[#4FBF9F] h-1.5 rounded-full transition-all" style={{ width: `${bulkProgress?.progress ?? 0}%` }} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {sortedAudience.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-400">
                <th className="py-2.5 px-3 font-medium">الكود</th>
                <th className="py-2.5 px-3 font-medium">الاسم</th>
                <th className="py-2.5 px-3 font-medium">رقم ولي الأمر</th>
                <th className="py-2.5 px-3 font-medium">الحالة</th>
                <th className="py-2.5 px-3 font-medium">تاريخ الربط</th>
                <th className="py-2.5 px-3 font-medium">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {sortedAudience.map((s) => (
                <LinkStatusRow key={s.studentId} student={s} status={statusMap.get(s.studentId)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
