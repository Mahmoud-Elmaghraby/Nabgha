import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useGroups } from '@/features/groups/hooks/useGroups';
import { getGroupSelectLabel } from '@/features/groups/utils/formatGroupLabel';
import { reportsApi } from '../api/reports.api';
import { downloadBlob } from '@/shared/lib/downloadBlob';
import { useToast } from '@/shared/components/Toast';
import { SectionDataTable } from '../components/SectionDataTable';

function firstDayOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
}
function today(): string {
  return new Date().toISOString().split('T')[0];
}

export default function GroupGradesReportPage() {
  const toast = useToast();
  const { data: groupsData } = useGroups({ limit: 1000 });
  const groups = groupsData?.data || [];

  const [groupId, setGroupId] = useState('');
  const [startDate, setStartDate] = useState(firstDayOfMonth());
  const [endDate, setEndDate] = useState(today());
  const [downloadLoading, setDownloadLoading] = useState<'xlsx' | 'pdf' | null>(null);

  const params = { groupId, startDate, endDate };

  const { data: previewData, isFetching } = useQuery({
    queryKey: ['reports-preview', 'group-grades', params],
    queryFn: () => reportsApi.preview('group-grades', params),
    enabled: !!groupId && !!startDate && !!endDate,
    placeholderData: keepPreviousData,
  });

  const handleGenerate = async (format: 'xlsx' | 'pdf') => {
    setDownloadLoading(format);
    try {
      const blob = await reportsApi.generate('group-grades', params, format);
      downloadBlob(blob, `درجات-مجموعة-${Date.now()}.${format}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'حدث خطأ أثناء توليد التقرير');
    } finally {
      setDownloadLoading(null);
    }
  };

  return (
            <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <label className="text-xs text-gray-500 mb-1 block">المجموعة</label>
              <select value={groupId} onChange={e => setGroupId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20">
                <option value="">اختر مجموعة</option>
                {groups.filter(g => g.isActive).map(g => (
                  <option key={g.id} value={g.id}>{getGroupSelectLabel(g)}</option>
                ))}
              </select>
            </div>
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
            {groupId && (
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

          {!groupId ? (
            <p className="text-sm text-gray-400 text-center py-10">اختر مجموعة لعرض تقرير الدرجات</p>
          ) : previewData?.sections.map((section, i) => (
            <SectionDataTable key={i} section={section} isLoading={isFetching && !previewData} />
          ))}
        </div>

  );
}
