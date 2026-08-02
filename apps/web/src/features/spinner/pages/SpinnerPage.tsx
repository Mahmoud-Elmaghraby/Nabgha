import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useGroups } from '@/features/groups/hooks/useGroups';
import { getGroupSelectLabel } from '@/features/groups/utils/formatGroupLabel';
import { useSubjects } from '@/features/subjects/hooks/useSubjects';
import { spinnerApi, type SpinnerStudent } from '../api/spinner.api';
import { SpinWheel } from '../components/SpinWheel';
import { PageHeader } from '@/shared/components';

type SourceMode = 'ongoing' | 'group' | 'subject';

export default function SpinnerPage() {
  const { data: groupsData } = useGroups({ limit: 1000 });
  const { data: subjects = [] } = useSubjects();
  const groups = groupsData?.data || [];

  const [mode, setMode] = useState<SourceMode>('ongoing');
  const [groupId, setGroupId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [ongoingSessionId, setOngoingSessionId] = useState('');
  const [students, setStudents] = useState<SpinnerStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: ongoingSessions = [] } = useQuery({
    queryKey: ['spinner-ongoing-sessions'],
    queryFn: () => spinnerApi.getOngoingSessions(),
    refetchInterval: 15000, // تحديث كل 15 ثانية عشان يلحق أي حصة تبدأ جديدة
  });

  const canLoad = mode === 'ongoing' ? !!ongoingSessionId : mode === 'group' ? !!groupId : !!subjectId;

  const handleLoadStudents = async () => {
    setLoading(true);
    setError('');
    try {
      let result: SpinnerStudent[] = [];
      if (mode === 'ongoing') result = await spinnerApi.getPresentStudentsInSession(ongoingSessionId);
      else if (mode === 'group') result = await spinnerApi.getGroupStudents(groupId);
      else if (mode === 'subject') result = await spinnerApi.getSubjectStudents(subjectId);

      if (result.length === 0) {
        setError(mode === 'ongoing' ? 'لا يوجد طلاب حاضرين في هذه الحصة حالياً' : 'لا يوجد طلاب في هذا الاختيار');
      }
      setStudents(result);
    } catch {
      setError('حدث خطأ أثناء جلب الطلاب');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen" dir="rtl">
      <PageHeader title="عجلة الحظ 🎯" subtitle="اختيار طالب عشوائي بطريقة ممتعة" />

      <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => { setMode('ongoing'); setStudents([]); setError(''); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${mode === 'ongoing' ? 'bg-[#0E3B2E] text-white' : 'bg-gray-100 text-gray-600'}`}>
              حصة جارية دلوقتي
            </button>
            <button onClick={() => { setMode('group'); setStudents([]); setError(''); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${mode === 'group' ? 'bg-[#0E3B2E] text-white' : 'bg-gray-100 text-gray-600'}`}>
              مجموعة
            </button>
            <button onClick={() => { setMode('subject'); setStudents([]); setError(''); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${mode === 'subject' ? 'bg-[#0E3B2E] text-white' : 'bg-gray-100 text-gray-600'}`}>
              مادة
            </button>
          </div>

          {mode === 'ongoing' && (
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">اختر الحصة الجارية</label>
              {ongoingSessions.length === 0 ? (
                <p className="text-sm text-gray-400">لا توجد حصص جارية حالياً</p>
              ) : (
                <select value={ongoingSessionId} onChange={e => setOngoingSessionId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20">
                  <option value="">اختر حصة</option>
                  {ongoingSessions.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.title} — {s.groupName ?? s.grade}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {mode === 'group' && (
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">اختر المجموعة</label>
              <select value={groupId} onChange={e => setGroupId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20">
                <option value="">اختر مجموعة</option>
                {groups.filter(g => g.isActive).map(g => (
                  <option key={g.id} value={g.id}>{getGroupSelectLabel(g)}</option>
                ))}
              </select>
            </div>
          )}

          {mode === 'subject' && (
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">اختر المادة</label>
              <select value={subjectId} onChange={e => setSubjectId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20">
                <option value="">اختر مادة</option>
                {subjects.map(s => <option key={s.subject.id} value={s.subject.id}>{s.subject.name}</option>)}
              </select>
            </div>
          )}

          <button onClick={handleLoadStudents} disabled={!canLoad || loading}
            className="w-full py-2.5 text-sm font-bold bg-[#1F6B4E] text-white rounded-lg hover:opacity-90 disabled:opacity-50">
            {loading ? 'جاري التحميل...' : 'تجهيز العجلة'}
          </button>

          {error && <p className="text-sm text-red-500 text-center">{error}</p>}
        </div>

        {students.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <p className="text-sm text-gray-500 text-center mb-4">عدد الطلاب في العجلة: {students.length}</p>
            <SpinWheel students={students} />
          </div>
        )}
      </div>
    </div>
  );
}
