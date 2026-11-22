import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/lib/api/client';
import { useGroups } from '@/features/groups/hooks/useGroups';
import { getGroupSelectLabel } from '@/features/groups/utils/formatGroupLabel';
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
      const sessions = res.data.data?.data ?? [];
      return sessions.filter((s: any) => GRADED_TYPES.includes(s.type));
    },
    enabled: !!groupId,
  });
}

export default function ExamResultReportPage() {
  const toast = useToast();
  const { data: groupsData } = useGroups({ limit: 1000 });
  const groups = groupsData?.data || [];

  const [groupId, setGroupId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [passThreshold, setPassThreshold] = useState('50');
  const [downloadLoading, setDownloadLoading] = useState<'xlsx' | 'pdf' | null>(null);

  const { data: exams = [] } = useGroupExams(groupId);

  const params = { sessionId, passThreshold };

  const { data: previewData, isFetching } = useQuery({
    queryKey: ['reports-preview', 'exam-result', params],
    queryFn: () => reportsApi.preview('exam-result', params),
    enabled: !!sessionId,
  });

  const handleGenerate = async (format: 'xlsx' | 'pdf') => {
    setDownloadLoading(format);
    try {
      const blob = await reportsApi.generate('exam-result', params, format);
      downloadBlob(blob, `نتيجة-امتحان-${Date.now()}.${format}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'حدث خطأ أثناء توليد التقرير');
    } finally {
      setDownloadLoading(null);
    }
  };

  return (
            <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-wrap items-end gap-3">
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
                  <option key={s.id} value={s.id}>
                    {s.title} — {new Date(s.startDate).toLocaleDateString('en-GB')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">حد النجاح %</label>
              <input type="number" min={0} max={100} value={passThreshold} onChange={e => setPassThreshold(e.target.value)}
                className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20" />
            </div>
            {sessionId && (
              <div className="flex gap-2">
                <button onClick={() => handleGenerate('xlsx')} disabled={downloadLoading !== null}
                  className="px-4 py-2 text-sm border border-[#0E3B2E] text-[#0E3B2E] rounded-lg hover:bg-[#0E3B2E]/5 disabled:opacity-50">
                  {downloadLoading === 'xlsx' ? 'جاري...' : 'تحميل Excel'}
                </button>
                <button onClick={() => handleGenerate('pdf')} disabled={downloadLoading !== null}
                  className="px-4 py-2 text-sm bg-[#0E3B2E] text-white rounded-lg hover:bg-[#1F6B4E] disabled:opacity-50">
                  {downloadLoading === 'pdf' ? 'جاري...' : 'تحميل PDF'}
                </button>
              </div>
            )}
          </div>

          {previewData?.summary && previewData.summary.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {previewData.summary.map((item, i) => (
                <div key={i} className="bg-white rounded-xl p-4 text-center border border-gray-100">
                  <p className="text-xs text-gray-400 mb-1">{item.label}</p>
                  <p className="text-lg font-bold text-[#0E3B2E]">{item.value}</p>
                </div>
              ))}
            </div>
          )}

          {previewData?.sections.map((section, i) => (
            <SectionDataTable key={i} section={section} isLoading={isFetching && !previewData} showTitle={false} />
          ))}
        </div>

  );
}
