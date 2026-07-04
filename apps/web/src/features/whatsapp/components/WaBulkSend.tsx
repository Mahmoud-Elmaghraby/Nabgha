import { useState, useMemo } from 'react';
import { useWaMutations, useWaBulkProgress, useResolveAudience } from '../hooks/useWhatsapp';
import { usePermissions } from '@/shared/hooks/usePermissions';
import { useGroups } from '@/features/groups/hooks/useGroups';
import { useSubjects } from '@/features/subjects/hooks/useSubjects';
import { useTeachers } from '@/features/teachers/hooks/useTeachers';
import { GRADE_OPTIONS } from '@nabgha/types';
import type { AudienceType, PhoneSource, ResolveAudienceParams } from '../types/whatsapp.types';

const AUDIENCE_OPTIONS: { value: AudienceType; label: string }[] = [
  { value: 'all', label: 'كل الطلاب' },
  { value: 'group', label: 'مجموعة معينة' },
  { value: 'subjectGrade', label: 'مادة + صف معين' },
  { value: 'grade', label: 'صف دراسي كامل' },
  { value: 'teacher', label: 'مدرس معين' },
];

export function WaBulkSend() {
  const { hasPermission } = usePermissions();
  const canSend = hasPermission('reports.send_whatsapp');
  const { sendBulk } = useWaMutations();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audienceType, setAudienceType] = useState<AudienceType>('all');
  const [groupId, setGroupId] = useState('');
  const [subjectGradeId, setSubjectGradeId] = useState('');
  const [grade, setGrade] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [phoneSource, setPhoneSource] = useState<PhoneSource>('parent');
  const [manualMode, setManualMode] = useState(false);
  const [manualPhones, setManualPhones] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const { data: groupsData } = useGroups({ limit: 100 });
  const { data: subjects = [] } = useSubjects();
  const { data: teachersData } = useTeachers();

  const groups = groupsData?.data || [];
  const teachers = teachersData?.data || [];
  const subjectGradeOptions = subjects.flatMap(item =>
    item.grades.map(g => ({ value: g.id, label: `${item.subject.name} — ${g.grade}` }))
  );

  const audienceParams: ResolveAudienceParams | null = useMemo(() => {
    if (manualMode) return null;
    return { type: audienceType, groupId, subjectGradeId, grade, teacherId };
  }, [manualMode, audienceType, groupId, subjectGradeId, grade, teacherId]);

  const { data: audience = [], isFetching: resolvingAudience } = useResolveAudience(audienceParams);

  const parseManualPhones = (text: string): string[] => {
    return text
      .split(/[\n,،]/)
      .map(p => p.trim().replace(/\D/g, ''))
      .filter(p => p.length >= 10);
  };

  const resolvedPhones = useMemo(() => {
    if (manualMode) return parseManualPhones(manualPhones);
    const raw = audience
      .map(s => phoneSource === 'parent' ? s.parentPhone : s.studentPhone)
      .filter((p): p is string => !!p);
    return [...new Set(raw)];
  }, [manualMode, manualPhones, audience, phoneSource]);

  const { data: progress } = useWaBulkProgress(jobId);
  const isRunning = progress?.status === 'running' || progress?.status === 'pending';

  const handleSend = async () => {
    setError('');
    if (!title.trim()) return setError('العنوان مطلوب');
    if (!body.trim()) return setError('نص الرسالة مطلوب');
    if (resolvedPhones.length === 0) return setError('لا يوجد أي رقم صحيح ضمن الجمهور المختار');

    const result = await sendBulk.mutateAsync({ title, body, phones: resolvedPhones });
    setJobId(result.jobId);
  };

  const resetAll = () => {
    setJobId(null); setTitle(''); setBody('');
    setAudienceType('all'); setGroupId(''); setSubjectGradeId(''); setGrade(''); setTeacherId('');
    setManualMode(false); setManualPhones('');
  };

  if (!canSend) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-5 text-center text-sm text-gray-400">
        لا تملك صلاحية الإرسال الجماعي
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
      <h3 className="font-bold text-[#0E3B2E] text-base">إرسال جماعي</h3>

      {!jobId ? (
        <>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">عنوان الحملة</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="مثال: تذكير امتحان الأسبوع القادم"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">نص الرسالة</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="اكتب الرسالة هنا..."
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20"
            />
            <div className="text-left text-xs text-gray-400 mt-1">{body.length}/1000</div>
          </div>

          {/* تبديل بين اختيار الجمهور والإدخال اليدوي */}
          <div className="flex gap-2 p-1 bg-gray-50 rounded-lg">
            <button onClick={() => setManualMode(false)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${!manualMode ? 'bg-white shadow-sm text-[#0E3B2E]' : 'text-gray-400'}`}>
              اختيار الجمهور
            </button>
            <button onClick={() => setManualMode(true)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${manualMode ? 'bg-white shadow-sm text-[#0E3B2E]' : 'text-gray-400'}`}>
              إدخال أرقام يدوي
            </button>
          </div>

          {!manualMode ? (
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
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              )}

              {audienceType === 'subjectGrade' && (
                <select value={subjectGradeId} onChange={e => setSubjectGradeId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="">اختر المادة والصف</option>
                  {subjectGradeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              )}

              {audienceType === 'grade' && (
                <select value={grade} onChange={e => setGrade(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="">اختر الصف الدراسي</option>
                  {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              )}

              {audienceType === 'teacher' && (
                <select value={teacherId} onChange={e => setTeacherId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="">اختر المدرس</option>
                  {teachers.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              )}

              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">الرسالة تتبعت على</label>
                <div className="flex gap-2">
                  <button onClick={() => setPhoneSource('parent')}
                    className={`flex-1 py-1.5 text-xs rounded-lg border ${phoneSource === 'parent' ? 'bg-[#0E3B2E] text-white border-[#0E3B2E]' : 'bg-white text-gray-600 border-gray-200'}`}>
                    رقم ولي الأمر
                  </button>
                  <button onClick={() => setPhoneSource('student')}
                    className={`flex-1 py-1.5 text-xs rounded-lg border ${phoneSource === 'student' ? 'bg-[#0E3B2E] text-white border-[#0E3B2E]' : 'bg-white text-gray-600 border-gray-200'}`}>
                    رقم الطالب
                  </button>
                </div>
              </div>

              <div className="text-xs text-gray-500 bg-white rounded-lg px-3 py-2 border border-gray-100">
                {resolvingAudience ? 'جاري حساب الجمهور...' : `📱 ${resolvedPhones.length} رقم صحيح من أصل ${audience.length} طالب مطابق`}
              </div>
            </div>
          ) : (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                أرقام التليفون <span className="text-gray-400">(كل رقم في سطر أو مفصول بفاصلة)</span>
              </label>
              <textarea
                value={manualPhones}
                onChange={e => setManualPhones(e.target.value)}
                rows={4}
                placeholder="01012345678&#10;01098765432&#10;..."
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20 font-mono"
                dir="ltr"
              />
              <p className="text-xs text-gray-400 mt-1">{resolvedPhones.length} رقم صحيح</p>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            onClick={handleSend}
            disabled={sendBulk.isPending || resolvedPhones.length === 0}
            className="w-full py-2.5 bg-[#0E3B2E] text-white text-sm font-medium rounded-lg hover:bg-[#1F6B4E] transition-colors disabled:opacity-50"
          >
            {sendBulk.isPending ? 'جاري الإرسال...' : `إرسال لـ ${resolvedPhones.length} رقم`}
          </button>
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className={`text-sm font-medium px-2.5 py-1 rounded-full ${
              progress?.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
              progress?.status === 'cancelled' ? 'bg-red-50 text-red-600' :
              'bg-amber-50 text-amber-700'
            }`}>
              {progress?.status === 'completed' ? 'اكتمل' :
               progress?.status === 'cancelled' ? 'ملغي' :
               progress?.status === 'running' ? 'جاري الإرسال' : 'في الانتظار'}
            </span>
            <span className="text-sm font-bold text-[#0E3B2E]">{progress?.progress ?? 0}%</span>
          </div>

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
