import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/lib/api/client';
import { reportsApi } from '../api/reports.api';
import { downloadBlob } from '@/shared/lib/downloadBlob';
import { useToast } from '@/shared/components/Toast';
import { useReportsStudentStore } from '../stores/selected-student.store';
import { SectionDataTable } from '../components/SectionDataTable';
import { usePermissions } from '@/shared/hooks/usePermissions';

function useStudentsSearch(q: string) {
  return useQuery({
    queryKey: ['reports-student-search', q],
    queryFn: async () => {
      if (q.trim().length < 2) return [];
      const res = await apiClient.get('/students', { params: { search: q, limit: 20 } });
      return res.data.data?.data ?? [];
    },
    enabled: q.trim().length >= 2,
  });
}

export default function StudentStatementReportPage() {
  const toast = useToast();
  const { hasPermission } = usePermissions();
  const [search, setSearch] = useState('');
  const { selectedStudent, setSelectedStudent } = useReportsStudentStore();
  const [downloadLoading, setDownloadLoading] = useState<'xlsx' | 'pdf' | null>(null);

  const { data: results = [] } = useStudentsSearch(search);

  const canView = hasPermission('finance.view');

  const { data: previewData, isFetching } = useQuery({
    queryKey: ['reports-preview', 'student-statement', selectedStudent?.id],
    queryFn: () => reportsApi.preview('student-statement', { studentId: selectedStudent!.id }),
    enabled: !!selectedStudent && canView,
  });

  const handleGenerate = async (format: 'xlsx' | 'pdf') => {
    if (!selectedStudent) return;
    setDownloadLoading(format);
    try {
      const blob = await reportsApi.generate('student-statement', { studentId: selectedStudent.id }, format);
      downloadBlob(blob, `كشف-حساب-${selectedStudent.fullName}-${Date.now()}.${format}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'حدث خطأ أثناء توليد التقرير');
    } finally {
      setDownloadLoading(null);
    }
  };

  if (!canView) {
    return (
      <div className="p-8 text-center text-gray-400">
        <p className="text-sm">مالك صلاحية لعرض كشف الحساب المالي — الشاشة دي بتعرض بيانات مدفوعات وخصومات الطالب</p>
      </div>
    );
  }

  return (
            <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <label className="text-xs text-gray-500 mb-1.5 block">اختر الطالب</label>
            {selectedStudent ? (
              <div className="flex items-center justify-between border border-[#0E3B2E]/30 bg-[#0E3B2E]/5 rounded-lg px-3 py-2 max-w-md">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{selectedStudent.fullName}</p>
                  {selectedStudent.studentCode && (
                    <p className="text-xs text-gray-400 font-mono">{selectedStudent.studentCode}</p>
                  )}
                </div>
                <button onClick={() => { setSelectedStudent(null); setSearch(''); }}
                  className="text-xs text-red-500 hover:text-red-700">تغيير</button>
              </div>
            ) : (
              <div className="max-w-md relative">
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="ابحث بالاسم أو الكود أو الهاتف..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20"
                />
                {results.length > 0 && (
                  <div className="mt-2 border border-gray-100 rounded-lg overflow-hidden max-h-48 overflow-y-auto absolute bg-white w-full z-10 shadow-lg">
                    {results.map((s: any) => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedStudent({ id: s.id, fullName: s.fullName, studentCode: s.studentCode })}
                        className="w-full text-right px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0"
                      >
                        <span className="font-medium text-gray-900">{s.fullName}</span>
                        {s.studentCode && <span className="text-gray-400 text-xs mr-2 font-mono">{s.studentCode}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {selectedStudent && previewData && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-2xl">
                {previewData.summary?.map((item, i) => (
                  <div key={i} className="bg-white rounded-xl p-4 text-center border border-gray-100">
                    <p className="text-xs text-gray-400 mb-1">{item.label}</p>
                    <p className="text-lg font-bold text-[#0E3B2E]">{item.value}</p>
                  </div>
                ))}
              </div>

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

              {previewData.sections.map((section, i) => (
                <SectionDataTable key={i} section={section} isLoading={isFetching} />
              ))}
            </>
          )}
        </div>

  );
}
