import { useState, useMemo } from 'react';
import { apiClient } from '@/shared/lib/api/client';
import { usePermissions } from '@/shared/hooks/usePermissions';
import { useResolveAudience, useWaBulkProgress } from '../../whatsapp/hooks/useWhatsapp';
import { useGroups } from '@/features/groups/hooks/useGroups';
import { getGroupSelectLabel } from '@/features/groups/utils/formatGroupLabel';
import { useSubjects } from '@/features/subjects/hooks/useSubjects';
import { useTeachers } from '@/features/teachers/hooks/useTeachers';
import { GRADE_OPTIONS } from '@nabgha/types';
import type { AudienceType, ResolveAudienceParams } from '../../whatsapp/types/whatsapp.types';

const AUDIENCE_OPTIONS: { value: AudienceType; label: string }[] = [
  { value: 'all', label: 'كل الطلاب' },
  { value: 'group', label: 'مجموعة معينة' },
  { value: 'subjectGrade', label: 'مادة + صف معين' },
  { value: 'grade', label: 'صف دراسي كامل' },
  { value: 'teacher', label: 'مدرس معين' },
];

interface BulkLinksResult {
  jobId: string | null;
  total: number;
  eligible: number;
  alreadyLinked: number;
}

// إرسال جماعي لروابط التليجرام — بيبعت رابط شخصي لكل طالب على واتساب ولي
// أمره (عبر بوت الواتساب المتصل بالفعل)، مش تليجرام نفسه. بيعيد استخدام نفس
// آلية اختيار الجمهور وتتبع التقدّم المستخدمة في الإرسال الجماعي للواتساب.
export function TelegramBulkSend() {
  const { hasPermission } = usePermissions();
  const canSend = hasPermission('reports.send_whatsapp');

  const [audienceType, setAudienceType] = useState<AudienceType>('all');
  const [groupId, setGroupId] = useState('');
  const [subjectGradeId, setSubjectGradeId] = useState('');
  const [grade, setGrade] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [summary, setSummary] = useState<BulkLinksResult | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

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
  const { data: progress } = useWaBulkProgress(jobId);
  const isRunning = progress?.status === 'running' || progress?.status === 'pending';

  const handleSend = async () => {
    setError('');
    setIsSending(true);
    try {
      // ننظّف الحقول الفاضية (زي subjectGradeId: '') قبل الإرسال — الباك إند
      // بيتحقق منها كـ UUID صريح عبر Zod، والـ string الفاضي مش UUID صالح حتى لو
      // الحقل اختياري أصلاً. نفس التنظيف المستخدم في whatsappApi.resolveAudience.
      const cleaned: Record<string, string> = {};
      Object.entries(audienceParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') cleaned[key] = String(value);
      });
      const res = await apiClient.post('/telegram/bulk-links', cleaned);
      const data: BulkLinksResult = res.data.data;
      setSummary(data);
      if (data.jobId) {
        setJobId(data.jobId);
      } else if (data.eligible === 0) {
        setError(
          data.alreadyLinked > 0
            ? 'كل الطلاب في النطاق ده مربوطين بتليجرام بالفعل ✅'
            : 'مفيش طلاب برقم ولي أمر صالح في النطاق المختار',
        );
      }
    } catch (err: any) {
      // شكل رسالة الخطأ الفعلي من GlobalExceptionFilter هو
      // { success:false, error:{ code, message, ... } } — مش { message }
      // مباشرة، فلازم نقرأ err.response.data.error.message
      const msg = err?.response?.data?.error?.message ?? err?.response?.data?.message ?? err?.message ?? 'حدث خطأ أثناء الإرسال';
      setError(
        msg === 'not_connected' ? 'الواتساب غير متصل — يرجى الاتصال أولاً من تبويب واتساب' :
        msg === 'wa_disabled' ? 'الواتساب معطّل — يرجى تفعيله من الإعدادات' :
        msg === 'telegram_not_connected' ? 'بوت التليجرام غير متصل — لازم توصّل بوت من تبويب "الاتصال" الأول عشان يتولّد رابط صحيح لكل طالب' :
        msg === 'bulk_job_already_running' ? 'فيه إرسال جماعي شغال بالفعل — انتظر لحد ما يخلص قبل ما تبدأ واحد جديد' :
        msg,
      );
    } finally {
      setIsSending(false);
    }
  };

  const resetAll = () => {
    setJobId(null); setSummary(null); setError('');
    setAudienceType('all'); setGroupId(''); setSubjectGradeId(''); setGrade(''); setTeacherId('');
  };

  if (!canSend) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4" dir="rtl">
      <div>
        <h3 className="font-bold text-[#0E3B2E] text-base">إرسال جماعي لروابط التليجرام</h3>
        <p className="text-xs text-gray-500 mt-1">
          بيبعت رابط شخصي لكل طالب على واتساب ولي أمره — واللي مربوط بالفعل بيتستبعد تلقائيًا
        </p>
      </div>

      {!jobId ? (
        <>
          <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">الجمهور</label>
              <div className="grid grid-cols-2 gap-2">
                {AUDIENCE_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => setAudienceType(opt.value)}
                    className={`py-2 px-3 rounded-lg text-xs border transition-all text-right ${
                      audienceType === opt.value
                        ? 'bg-[#0E3B2E] text-white border-[#0E3B2E]'
                        : 'bg-white text-gray-600 border-gray-200'
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {audienceType === 'group' && (
              <select value={groupId} onChange={e => setGroupId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="">اختر مجموعة</option>
                {groups.map((g: any) => (
                  <option key={g.id} value={g.id}>{getGroupSelectLabel(g)}</option>
                ))}
              </select>
            )}

            {audienceType === 'subjectGrade' && (
              <select value={subjectGradeId} onChange={e => setSubjectGradeId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="">اختر المادة والصف</option>
                {subjectGradeOptions.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}

            {audienceType === 'grade' && (
              <select value={grade} onChange={e => setGrade(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="">اختر الصف الدراسي</option>
                {GRADE_OPTIONS.map((g: string) => <option key={g} value={g}>{g}</option>)}
              </select>
            )}

            {audienceType === 'teacher' && (
              <select value={teacherId} onChange={e => setTeacherId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="">اختر المدرس</option>
                {teachers.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}

            <div className="text-xs text-gray-500 bg-white rounded-lg px-3 py-2 border border-gray-100">
              {resolvingAudience ? 'جاري حساب الجمهور...' : `👥 ${audience.length} طالب مطابق للنطاق المختار`}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            onClick={handleSend}
            disabled={isSending || audience.length === 0}
            className="w-full py-2.5 bg-[#0E3B2E] text-white text-sm font-medium rounded-lg hover:bg-[#1F6B4E] transition-colors disabled:opacity-50"
          >
            {isSending ? 'جاري الإرسال...' : 'إرسال روابط التليجرام'}
          </button>
        </>
      ) : (
        <div className="space-y-4">
          {/* لو الـ job "اكتمل" لكن محدش وصله حاجة فعليًا (كل الرسايل فشلت)، مينفعش
              نوريه بادج أخضر "اكتمل" — ده بيدّي انطباع مضلل إن الإرسال نجح. */}
          {(() => {
            const completedButAllFailed =
              progress?.status === 'completed' && (progress?.total ?? 0) > 0 && (progress?.sent ?? 0) === 0;
            const badgeClass =
              progress?.status === 'cancelled' ? 'bg-red-50 text-red-600' :
              completedButAllFailed ? 'bg-red-50 text-red-600' :
              progress?.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
              'bg-amber-50 text-amber-700';
            const badgeLabel =
              progress?.status === 'cancelled' ? 'ملغي' :
              completedButAllFailed ? 'فشل الإرسال بالكامل' :
              progress?.status === 'completed' ? 'اكتمل' :
              progress?.status === 'running' ? 'جاري الإرسال' : 'في الانتظار';
            return (
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium px-2.5 py-1 rounded-full ${badgeClass}`}>
                  {badgeLabel}
                </span>
                <span className="text-sm font-bold text-[#0E3B2E]">{progress?.progress ?? 0}%</span>
              </div>
            );
          })()}

          {progress?.status === 'completed' && (progress?.total ?? 0) > 0 && (progress?.sent ?? 0) === 0 && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
              كل الرسايل فشلت — على الأغلب بوت التليجرام اتقطع أثناء الإرسال. تأكد من الاتصال من تبويب "الاتصال" وجرّب تاني.
            </p>
          )}

          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-[#4FBF9F] h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress?.progress ?? 0}%` }}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-gray-900">{progress?.total ?? 0}</div>
              <div className="text-xs text-gray-400">الإجمالي</div>
            </div>
            <div className="bg-emerald-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-emerald-700">{progress?.sent ?? 0}</div>
              <div className="text-xs text-emerald-600">وصلت</div>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-red-600">{progress?.failed ?? 0}</div>
              <div className="text-xs text-red-500">فشلت</div>
            </div>
          </div>

          {summary && summary.alreadyLinked > 0 && (
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
              ملحوظة: {summary.alreadyLinked} طالب من النطاق ده مربوط بتليجرام بالفعل واتستبعد من الإرسال
            </p>
          )}

          {!isRunning && (
            <button
              onClick={resetAll}
              className="w-full py-2.5 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50"
            >
              إرسال جديد
            </button>
          )}
        </div>
      )}
    </div>
  );
}
