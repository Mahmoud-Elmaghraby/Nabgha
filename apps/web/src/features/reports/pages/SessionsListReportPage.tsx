import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useGroups } from '@/features/groups/hooks/useGroups';
import { getGroupSelectLabel } from '@/features/groups/utils/formatGroupLabel';
import { reportsApi } from '../api/reports.api';
import { downloadBlob } from '@/shared/lib/downloadBlob';
import { useToast } from '@/shared/components/Toast';
import { SectionDataTable } from '../components/SectionDataTable';

const TYPE_OPTIONS = [
  { value: '', label: 'كل الأنواع' },
  { value: 'lesson', label: 'حصة عادية' },
  { value: 'lesson_revision', label: 'حصة + تسميع' },
  { value: 'lesson_exam', label: 'حصة + امتحان' },
  { value: 'exam', label: 'امتحان' },
  { value: 'grade_exam', label: 'امتحان مرحلة' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'كل الحالات' },
  { value: 'scheduled', label: 'مجدولة' },
  { value: 'ongoing', label: 'جارية' },
  { value: 'completed', label: 'مكتملة' },
  { value: 'cancelled', label: 'ملغاة' },
];

function firstDayOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

export default function SessionsListReportPage() {
  const toast = useToast();
  const { data: groupsData } = useGroups({ limit: 1000 });
  const groups = groupsData?.data || [];

  const [startDate, setStartDate] = useState(firstDayOfMonth());
  const [endDate, setEndDate] = useState(today());
  const [groupId, setGroupId] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [downloadLoading, setDownloadLoading] = useState<'xlsx' | 'pdf' | null>(null);

  const params = {
    startDate, endDate,
    groupId: groupId || undefined,
    type: type || undefined,
    status: status || undefined,
  };

  const { data: previewData, isFetching } = useQuery({
    queryKey: ['reports-preview', 'sessions-list', params],
    queryFn: () => reportsApi.preview('sessions-list', params),
    enabled: !!startDate && !!endDate,
    placeholderData: keepPreviousData,
  });

  const section = previewData?.sections?.[0];
  const hasRows = (section?.rows.length ?? 0) > 0;

  const handleGenerate = async (format: 'xlsx' | 'pdf') => {
    setDownloadLoading(format);
    try {
      const blob = await reportsApi.generate('sessions-list', params, format);
      downloadBlob(blob, `قائمة-الحصص-${Date.now()}.${format}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'حدث خطأ أثناء توليد التقرير');
    } finally {
      setDownloadLoading(null);
    }
  };

  return (
            <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-wrap items-end gap-3">
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
              <label className="text-xs text-gray-500 mb-1 block">المجموعة</label>
              <select value={groupId} onChange={e => setGroupId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20">
                <option value="">كل المجموعات</option>
                {groups.filter(g => g.isActive).map(g => (
                  <option key={g.id} value={g.id}>{getGroupSelectLabel(g)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">النوع</label>
              <select value={type} onChange={e => setType(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20">
                {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">الحالة</label>
              <select value={status} onChange={e => setStatus(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20">
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleGenerate('xlsx')} disabled={downloadLoading !== null || !hasRows}
                className="px-4 py-2 text-sm border border-[#0E3B2E] text-[#0E3B2E] rounded-lg hover:bg-[#0E3B2E]/5 disabled:opacity-50">
                {downloadLoading === 'xlsx' ? 'جاري...' : 'تحميل Excel'}
              </button>
              <button onClick={() => handleGenerate('pdf')} disabled={downloadLoading !== null || !hasRows}
                className="px-4 py-2 text-sm bg-[#0E3B2E] text-white rounded-lg hover:bg-[#1F6B4E] disabled:opacity-50">
                {downloadLoading === 'pdf' ? 'جاري...' : 'تحميل PDF'}
              </button>
            </div>
          </div>

          {section && <SectionDataTable section={section} isLoading={isFetching && !previewData} showTitle={false} />}
        </div>

  );
}
