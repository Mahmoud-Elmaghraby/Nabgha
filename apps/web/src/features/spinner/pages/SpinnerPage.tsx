import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Maximize2, Minimize2, RotateCcw, RefreshCw, Volume2, VolumeX } from 'lucide-react';
import { useGroups } from '@/features/groups/hooks/useGroups';
import { getGroupSelectLabel } from '@/features/groups/utils/formatGroupLabel';
import { useSubjects } from '@/features/subjects/hooks/useSubjects';
import { spinnerApi, type SpinnerStudent } from '../api/spinner.api';
import { SpinWheel } from '../components/SpinWheel';
import { PageHeader } from '@/shared/components';

type SourceMode = 'session' | 'group' | 'subject';

const selectCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20';

export default function SpinnerPage() {
  const { data: groupsData } = useGroups({ limit: 1000 });
  const { data: subjects = [] } = useSubjects();
  const groups = groupsData?.data || [];

  const [mode, setMode]           = useState<SourceMode>('session');
  const [groupId, setGroupId]     = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [students, setStudents]   = useState<SpinnerStudent[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [removeWinners, setRemoveWinners] = useState(true);
  const [soundOn, setSoundOn]     = useState(true);
  const [winners, setWinners]     = useState<SpinnerStudent[]>([]);
  const [wheelKey, setWheelKey]   = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  const { data: todaySessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ['spinner-today-sessions'],
    queryFn: () => spinnerApi.getTodaySessions(),
    enabled: mode === 'session',
    refetchInterval: mode === 'session' ? 30_000 : false,
  });

  // لو فيه حصة واحدة بس النهارده نختارها على طول
  useEffect(() => {
    if (mode === 'session' && !sessionId && todaySessions.length === 1) setSessionId(todaySessions[0].id);
  }, [mode, sessionId, todaySessions]);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const canLoad = mode === 'session' ? !!sessionId : mode === 'group' ? !!groupId : !!subjectId;

  const switchMode = (m: SourceMode) => { setMode(m); setStudents([]); setError(''); setWinners([]); };

  const handleLoadStudents = async () => {
    setLoading(true);
    setError('');
    try {
      let result: SpinnerStudent[] = [];
      if (mode === 'session')    result = await spinnerApi.getPresentStudentsInSession(sessionId);
      else if (mode === 'group') result = await spinnerApi.getGroupStudents(groupId);
      else                       result = await spinnerApi.getSubjectStudents(subjectId);

      if (result.length === 0) {
        setError(mode === 'session' ? 'مفيش طلاب متسجّل حضورهم في الحصة دي لسه' : 'مفيش طلاب في الاختيار ده');
      }
      setStudents(result);
      setWinners([]);
      setWheelKey((k) => k + 1); // عجلة جديدة = قائمة فايزين جديدة
    } catch {
      setError('حصل خطأ أثناء جلب الطلاب');
    } finally {
      setLoading(false);
    }
  };

  const resetWheel = () => { setWinners([]); setWheelKey((k) => k + 1); };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stageRef.current?.requestFullscreen();
    } catch { /* بعض المتصفحات مش بتدعمه */ }
  };

  return (
    <div className="min-h-screen" dir="rtl">
      <PageHeader title="عجلة الحظ 🎯" subtitle="اختيار طالب عشوائي بطريقة عادلة وممتعة" />

      <div className="p-4 md:p-6 space-y-4 max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
          <div className="flex gap-2 flex-wrap">
            {([['session', 'حصة النهارده'], ['group', 'مجموعة'], ['subject', 'مادة']] as Array<[SourceMode, string]>).map(([m, label]) => (
              <button key={m} onClick={() => switchMode(m)}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${mode === m ? 'bg-[#0E3B2E] text-white' : 'bg-gray-100 text-gray-600'}`}>
                {label}
              </button>
            ))}
          </div>

          {mode === 'session' && (
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">الحصة (الطلاب اللي حضروا بس)</label>
              {sessionsLoading ? (
                <p className="text-sm text-gray-400">جاري التحميل...</p>
              ) : todaySessions.length === 0 ? (
                <p className="text-sm text-gray-400">مفيش حصص مفتوحة النهارده — اختار "مجموعة" بدلها</p>
              ) : (
                <select value={sessionId} onChange={(e) => setSessionId(e.target.value)} className={selectCls}>
                  <option value="">اختر حصة</option>
                  {todaySessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.status === 'ongoing' ? '🟢 ' : ''}{s.title} — {s.groupName ?? s.grade ?? ''}{s.startTime ? ` (${s.startTime.slice(0, 5)})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {mode === 'group' && (
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">المجموعة (كل الطلاب النشطين)</label>
              <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className={selectCls}>
                <option value="">اختر مجموعة</option>
                {groups.filter((g) => g.isActive).map((g) => (
                  <option key={g.id} value={g.id}>{getGroupSelectLabel(g)}</option>
                ))}
              </select>
            </div>
          )}

          {mode === 'subject' && (
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">المادة (كل الطلاب النشطين في كل مجموعاتها)</label>
              <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={selectCls}>
                <option value="">اختر مادة</option>
                {subjects.map((s: any) => <option key={s.subject.id} value={s.subject.id}>{s.subject.name}</option>)}
              </select>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-600">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={removeWinners} onChange={(e) => { setRemoveWinners(e.target.checked); resetWheel(); }} />
              الطالب اللي يكسب مايتكررش
            </label>
            <button type="button" onClick={() => setSoundOn((v) => !v)} className="flex items-center gap-1.5 text-gray-500 hover:text-[#0E3B2E]">
              {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              {soundOn ? 'الصوت شغال' : 'الصوت مقفول'}
            </button>
          </div>

          <button onClick={handleLoadStudents} disabled={!canLoad || loading}
            className="w-full py-2.5 text-sm font-bold bg-[#1F6B4E] text-white rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
            {students.length > 0 && <RefreshCw className="w-4 h-4" />}
            {loading ? 'جاري التحميل...' : students.length > 0 ? 'تحديث قائمة الطلاب' : 'تجهيز العجلة'}
          </button>

          {error && <p className="text-sm text-red-500 text-center">{error}</p>}
        </div>

        {students.length > 0 && (
          <div ref={stageRef} className={`bg-white rounded-2xl border border-gray-100 p-6 ${fullscreen ? 'flex flex-col justify-center overflow-auto' : ''}`}>
            <div className="flex items-center justify-between mb-4 text-sm text-gray-500">
              <span>في العجلة: {students.length} طالب{winners.length > 0 && removeWinners ? ` — اتختار ${winners.length}` : ''}</span>
              <div className="flex items-center gap-1">
                {winners.length > 0 && (
                  <button onClick={resetWheel} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-gray-100" title="رجّع كل الطلاب للعجلة">
                    <RotateCcw className="w-4 h-4" /> من الأول
                  </button>
                )}
                <button onClick={toggleFullscreen} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-gray-100" title="ملء الشاشة (للبروجكتور)">
                  {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  {fullscreen ? 'خروج' : 'ملء الشاشة'}
                </button>
              </div>
            </div>

            <SpinWheel
              key={wheelKey}
              students={students}
              removeWinners={removeWinners}
              soundOn={soundOn}
              onWinner={(w) => setWinners((list) => [...list, w])}
            />

            {winners.length > 0 && (
              <div className="mt-6 border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-gray-500 mb-2">الفايزين بالترتيب</p>
                <div className="flex flex-wrap gap-2">
                  {winners.map((w, i) => (
                    <span key={`${w.id}-${i}`} className="px-3 py-1 rounded-full bg-[#0E3B2E]/5 text-[#0E3B2E] text-sm">
                      <span className="text-[#B8893A] font-bold">{(i + 1).toLocaleString('ar-EG')}.</span> {w.fullName}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
