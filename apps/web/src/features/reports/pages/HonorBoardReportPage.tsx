import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/lib/api/client';
import { useGroups } from '@/features/groups/hooks/useGroups';
import { getGroupSelectLabel } from '@/features/groups/utils/formatGroupLabel';
import { useSubjects } from '@/features/subjects/hooks/useSubjects';
import { GRADE_OPTIONS } from '@nabgha/types';
import { reportsApi } from '../api/reports.api';
import { downloadBlob } from '@/shared/lib/downloadBlob';
import { useToast } from '@/shared/components/Toast';
import { SectionDataTable } from '../components/SectionDataTable';

const GRADED_TYPES = ['lesson_revision', 'lesson_exam', 'exam'];

function useGroupExams(groupId: string) {
  return useQuery({
    queryKey: ['reports-group-exams', groupId],
    queryFn: async () => {
      const res = await apiClient.get('/sessions', { params: { groupId, limit: 100 } });
      return (res.data.data?.data ?? []).filter((s: any) => GRADED_TYPES.includes(s.type));
    },
    enabled: !!groupId,
  });
}

function firstDayOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
}
function today(): string {
  return new Date().toISOString().split('T')[0];
}

export default function HonorBoardReportPage() {
  const toast = useToast();
  const { data: groupsData } = useGroups({ limit: 1000 });
  const { data: subjects = [] } = useSubjects();
  const groups = groupsData?.data || [];

  const [mode, setMode] = useState<'exam' | 'period'>('exam');
  const [groupId, setGroupId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [grade, setGrade] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [startDate, setStartDate] = useState(firstDayOfMonth());
  const [endDate, setEndDate] = useState(today());
  const [topCount, setTopCount] = useState('3');
  const [downloadLoading, setDownloadLoading] = useState(false);

  const { data: exams = [] } = useGroupExams(groupId);

  const params = mode === 'exam'
    ? { mode, sessionId, topCount }
    : { mode, groupId: groupId || undefined, grade: grade || undefined, subjectId: subjectId || undefined, startDate, endDate, topCount };

  const isReady = mode === 'exam' ? !!sessionId : !!startDate && !!endDate;

  const { data: previewData, isFetching } = useQuery({
    queryKey: ['reports-preview', 'honor-board', params],
    queryFn: () => reportsApi.preview('honor-board', params),
    enabled: isReady,
  });

  const handleGenerate = async () => {
    setDownloadLoading(true);
    try {
      const blob = await reportsApi.generate('honor-board', params, 'pdf');
      downloadBlob(blob, `لوحة-الشرف-${Date.now()}.pdf`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'حدث خطأ أثناء توليد اللوحة');
    } finally {
      setDownloadLoading(false);
    }
  };

  return (
            <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
            <div className="flex gap-2">
              <button onClick={() => setMode('exam')}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${mode === 'exam' ? 'bg-[#0E3B2E] text-white' : 'bg-gray-100 text-gray-600'}`}>
                امتحان واحد
              </button>
              <button onClick={() => setMode('period')}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${mode === 'period' ? 'bg-[#0E3B2E] text-white' : 'bg-gray-100 text-gray-600'}`}>
                متوسط فترة
              </button>
            </div>

            {mode === 'exam' ? (
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs text-gray-500 mb-1 block">المجموعة</label>
                  <select value={groupId} onChange={e => { setGroupId(e.target.value); setSessionId(''); }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20">
                    <option value="">اختر مجموعة</option>
                    {groups.filter(g => g.isActive).map(g => (
                      <option key={g.id} value={g.id}>{getGroupSelectLabel(g)}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs text-gray-500 mb-1 block">الامتحان</label>
                  <select value={sessionId} onChange={e => setSessionId(e.target.value)} disabled={!groupId}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20 disabled:opacity-50">
                    <option value="">اختر امتحاناً</option>
                    {exams.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.title} — {new Date(s.startDate).toLocaleDateString('en-GB')}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">من تاريخ</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">إلى تاريخ</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20" />
                </div>
                <div className="flex-1 min-w-[180px]">
                  <label className="text-xs text-gray-500 mb-1 block">المجموعة (اختياري)</label>
                  <select value={groupId} onChange={e => setGroupId(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20">
                    <option value="">كل المجموعات</option>
                    {groups.filter(g => g.isActive).map(g => (
                      <option key={g.id} value={g.id}>{getGroupSelectLabel(g)}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className="text-xs text-gray-500 mb-1 block">المرحلة (اختياري)</label>
                  <select value={grade} onChange={e => setGrade(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20">
                    <option value="">كل المراحل</option>
                    {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className="text-xs text-gray-500 mb-1 block">المادة (اختياري)</label>
                  <select value={subjectId} onChange={e => setSubjectId(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20">
                    <option value="">كل المواد</option>
                    {subjects.map(s => <option key={s.subject.id} value={s.subject.id}>{s.subject.name}</option>)}
                  </select>
                </div>
              </div>
            )}

            <div className="flex items-end gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">عدد الطلاب في اللوحة</label>
                <input type="number" min={1} max={50} value={topCount} onChange={e => setTopCount(e.target.value)}
                  className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20" />
              </div>
              {isReady && (
                <button onClick={handleGenerate} disabled={downloadLoading}
                  className="px-5 py-2 text-sm font-bold bg-[#D4AB53] text-white rounded-lg hover:opacity-90 disabled:opacity-50">
                  {downloadLoading ? 'جاري التوليد...' : '🏆 تحميل لوحة الشرف PDF'}
                </button>
              )}
            </div>
          </div>

          {previewData?.sections.map((section, i) => (
            <SectionDataTable key={i} section={section} isLoading={isFetching && !previewData} showTitle={false} />
          ))}
        </div>

  );
}
