import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { reportsApi } from '../api/reports.api';
import { downloadBlob } from '@/shared/lib/downloadBlob';
import { useToast } from '@/shared/components/Toast';
import { useSubjects } from '@/features/subjects/hooks/useSubjects';
import { useGroups } from '@/features/groups/hooks/useGroups';
import { getGroupSelectLabel } from '@/features/groups/utils/formatGroupLabel';
import { useTenantCapabilities } from '@/shared/hooks/useTenantCapabilities';
import { SectionDataTable } from '../components/SectionDataTable';

export default function OverdueDuesReportPage() {
  const toast = useToast();
  const { data: subjects = [] } = useSubjects();
  const { data: groupsData } = useGroups({ limit: 1000 });
  const { data: capabilities } = useTenantCapabilities();
  const groups = groupsData?.data || [];
  // من غير ما المدرس يحدد تاريخ، الباك إند بيرجع افتراضيًا الشهر الحالي + اللي فاته بس —
  // فمحتاجين الحقلين يفضلوا فاضيين هنا (مش متعبيين بالشهر الحالي) عشان الافتراضي ده يشتغل.
  const [fromMonth, setFromMonth] = useState('');
  const [toMonth, setToMonth] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [downloadLoading, setDownloadLoading] = useState<'xlsx' | 'pdf' | null>(null);

  const params = {
    toMonth: toMonth || undefined,
    fromMonth: fromMonth || undefined,
    subjectId: subjectId || undefined,
    groupId: groupId || undefined,
  };

  const { data: previewData, isFetching } = useQuery({
    queryKey: ['reports-preview', 'overdue-dues', params],
    queryFn: () => reportsApi.preview('overdue-dues', params),
    placeholderData: keepPreviousData,
  });

  const handleGenerate = async (format: 'xlsx' | 'pdf') => {
    setDownloadLoading(format);
    try {
      const blob = await reportsApi.generate('overdue-dues', params, format);
      downloadBlob(blob, `المستحقات-المتأخرة-${Date.now()}.${format}`);
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
              <label className="text-xs text-gray-500 mb-1 block">من شهر (اختياري)</label>
              <input type="month" value={fromMonth} onChange={e => setFromMonth(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">حتى شهر (اختياري)</label>
              <input type="month" value={toMonth} onChange={e => setToMonth(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20" />
            </div>
            {capabilities?.hasMultipleSubjects && (
              <div className="flex-1 min-w-[160px]">
                <label className="text-xs text-gray-500 mb-1 block">المادة (اختياري)</label>
                <select value={subjectId} onChange={e => setSubjectId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20">
                  <option value="">كل المواد</option>
                  {subjects.map(s => <option key={s.subject.id} value={s.subject.id}>{s.subject.name}</option>)}
                </select>
              </div>
            )}
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
            {!fromMonth && !toMonth && (
              <p className="text-xs text-gray-400 basis-full">
                بدون تحديد شهر: هيظهر الشهر الحالي والشهر السابق بس. اختر شهر عشان تفلتر بتاريخ تاني.
              </p>
            )}
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
          </div>

          {previewData?.summary && previewData.summary.length > 0 && (
            <div className="grid grid-cols-2 gap-3 max-w-md">
              {previewData.summary.map((item, i) => (
                <div key={i} className="bg-white rounded-xl p-4 text-center border border-gray-100">
                  <p className="text-xs text-gray-400 mb-1">{item.label}</p>
                  <p className="text-lg font-bold text-[#0E3B2E]">{item.value}</p>
                </div>
              ))}
            </div>
          )}

          {previewData?.sections.map((section, i) => (
            <SectionDataTable key={i} section={section} isLoading={isFetching && !previewData} />
          ))}
        </div>

  );
}
