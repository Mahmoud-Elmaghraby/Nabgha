import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/lib/api/client';
import { useGroups } from '@/features/groups/hooks/useGroups';
import { getGroupSelectLabel } from '@/features/groups/utils/formatGroupLabel';
import { reportsApi } from '../api/reports.api';
import { downloadBlob } from '@/shared/lib/downloadBlob';
import { useToast } from '@/shared/components/Toast';
import { SectionDataTable } from '../components/SectionDataTable';

interface SelectedStudent {
  id: string;
  fullName: string;
  studentCode: string | null;
}

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

function useAllStudents(enabled: boolean) {
  return useQuery({
    queryKey: ['reports-all-students'],
    queryFn: async () => {
      const res = await apiClient.get('/students', { params: { limit: 5000 } });
      return (res.data.data?.data ?? []) as any[];
    },
    enabled,
  });
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function useMonthlyPreview(studentId: string | undefined, month: string) {
  return useQuery({
    queryKey: ['reports-preview', 'student-monthly-report', studentId, month],
    queryFn: () => reportsApi.preview('student-monthly-report', { studentId, month }),
    enabled: !!studentId,
  });
}

function useWaProgress(jobId: string | null) {
  return useQuery({
    queryKey: ['reports-monthly-wa-progress', jobId],
    queryFn: () => reportsApi.getMonthlyWhatsappProgress(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 2000;
      return data.status === 'running' || data.status === 'pending' ? 2000 : false;
    },
  });
}

export default function MonthlyReportsPage() {
  const toast = useToast();
  const { data: groupsData } = useGroups({ limit: 1000 });
  const groups = groupsData?.data || [];

  const [month, setMonth] = useState(currentMonth());
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<SelectedStudent[]>([]);
  const [searchQ, setSearchQ] = useState('');
  const [wantAll, setWantAll] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState<'xlsx' | 'pdf' | null>(null);
  const [printLoading, setPrintLoading] = useState(false);

  const { data: results = [] } = useStudentsSearch(searchQ);
  const { data: allStudents = [] } = useAllStudents(wantAll);
  const { data: progress } = useWaProgress(jobId);
  const isRunning = progress?.status === 'running' || progress?.status === 'pending';

  const isSingleStudent = selectedStudents.length === 1;
  const { data: previewData, isFetching: previewFetching } = useMonthlyPreview(
    isSingleStudent ? selectedStudents[0].id : undefined,
    month,
  );

  const toggleGroup = async (groupId: string) => {
    if (selectedGroupIds.includes(groupId)) {
      setSelectedGroupIds(prev => prev.filter(g => g !== groupId));
      return;
    }
    setSelectedGroupIds(prev => [...prev, groupId]);
    try {
      const res = await apiClient.get(`/groups/${groupId}/students`);
      const students = (res.data.data ?? []).map((s: any) => ({
        id: s.studentId, fullName: s.fullName, studentCode: s.studentCode ?? null,
      }));
      setSelectedStudents(prev => {
        const existingIds = new Set(prev.map(s => s.id));
        return [...prev, ...students.filter((s: SelectedStudent) => !existingIds.has(s.id))];
      });
    } catch {
      toast.error('تعذر جلب طلاب المجموعة');
    }
  };

  const selectAllStudents = () => {
    setWantAll(true);
    setSelectedGroupIds([]);
  };

  // لما بيانات "كل الطلاب" توصل، نحدّث القائمة المختارة فعلياً
  if (wantAll && allStudents.length > 0 && selectedStudents.length === 0) {
    setSelectedStudents(allStudents.map(s => ({ id: s.id, fullName: s.fullName, studentCode: s.studentCode ?? null })));
  }

  const addStudent = (s: any) => {
    setWantAll(false);
    setSelectedStudents(prev => {
      if (prev.some(p => p.id === s.id)) return prev;
      return [...prev, { id: s.id, fullName: s.fullName, studentCode: s.studentCode ?? null }];
    });
    setSearchQ('');
  };

  const removeStudent = (id: string) => {
    setWantAll(false);
    setSelectedStudents(prev => prev.filter(s => s.id !== id));
  };

  const clearAll = () => {
    setSelectedStudents([]);
    setSelectedGroupIds([]);
    setWantAll(false);
  };

  const handleDownload = async (format: 'xlsx' | 'pdf') => {
    if (!isSingleStudent) return;
    setDownloadLoading(format);
    try {
      const blob = await reportsApi.generate('student-monthly-report', { studentId: selectedStudents[0].id, month }, format);
      downloadBlob(blob, `تقرير-شهري-${selectedStudents[0].fullName}-${month}.${format}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'حدث خطأ أثناء توليد التقرير');
    } finally {
      setDownloadLoading(null);
    }
  };

  // تحميل PDF واحد يجمع تقارير كل الطلاب المختارين — كل طالب في صفحة/صفحات منفصلة
  // ورا بعض، عشان المدرس يقدر يطبعهم كلهم مرة واحدة (بديل عن إرسال الواتساب،
  // مش بديل لزر "تحميل PDF" الخاص بمعاينة الطالب الواحد اللي فوق).
  const handlePrintAll = async () => {
    if (selectedStudents.length === 0) return;
    setPrintLoading(true);
    try {
      const res = await apiClient.post(
        '/reports/monthly-print',
        { studentIds: selectedStudents.map(s => s.id), month },
        { responseType: 'blob' },
      );
      downloadBlob(res.data, `التقارير-الشهرية-${month}.pdf`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'حدث خطأ أثناء توليد ملف الطباعة');
    } finally {
      setPrintLoading(false);
    }
  };

  const handleSendWhatsapp = async () => {
    if (selectedStudents.length === 0) {
      toast.error('اختر طالباً واحداً على الأقل');
      return;
    }
    setSending(true);
    try {
      const result = await reportsApi.sendMonthlyWhatsapp(selectedStudents.map(s => s.id), month);
      setJobId(result.jobId);
    } catch (err: any) {
      const code = err?.response?.data?.error?.code;
      if (code === 'WA_NOT_CONNECTED') toast.error('الواتساب غير متصل حالياً');
      else if (code === 'WA_DISABLED') toast.error('خدمة الواتساب معطّلة');
      else toast.error(err?.response?.data?.error?.message || 'حدث خطأ أثناء بدء الإرسال');
    } finally {
      setSending(false);
    }
  };

  return (
            <div className="space-y-4">
          {jobId ? (
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  progress?.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                  progress?.status === 'cancelled' ? 'bg-red-50 text-red-600' :
                  'bg-amber-50 text-amber-700'
                }`}>
                  {progress?.status === 'completed' ? 'اكتمل' :
                   progress?.status === 'cancelled' ? 'ملغي' :
                   progress?.status === 'running' ? 'جاري الإرسال (تقرير بتقرير)' : 'في الانتظار'}
                </span>
                <span className="text-sm font-bold text-[#0E3B2E]">{progress?.progress ?? 0}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
                <div className="h-full bg-[#0E3B2E] rounded-full transition-all"
                  style={{ width: `${progress?.progress ?? 0}%` }} />
              </div>
              <div className="grid grid-cols-3 gap-3 text-center mb-4">
                <div>
                  <div className="text-lg font-bold text-gray-900">{progress?.total ?? 0}</div>
                  <div className="text-xs text-gray-400">الإجمالي</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-emerald-700">{progress?.sent ?? 0}</div>
                  <div className="text-xs text-gray-400">تم الإرسال</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-red-600">{progress?.failed ?? 0}</div>
                  <div className="text-xs text-gray-400">فشل</div>
                </div>
              </div>
              {!isRunning && (
                <button onClick={() => { setJobId(null); clearAll(); }}
                  className="w-full py-2.5 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50">
                  دفعة جديدة
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <label className="text-xs text-gray-500 mb-1.5 block">الشهر</label>
                <input type="month" value={month} onChange={e => setMonth(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20" />
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-gray-700">اختر المستلمين</p>
                  <button onClick={selectAllStudents}
                    className={`text-xs px-3 py-1.5 rounded-lg border ${wantAll ? 'bg-[#0E3B2E] text-white border-[#0E3B2E]' : 'border-gray-200 text-gray-600 hover:border-[#0E3B2E]/30'}`}>
                    كل الطلاب
                  </button>
                </div>

                <p className="text-xs text-gray-500 mb-2">مجموعات (يضيف كل طلابها تلقائياً)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mb-4">
                  {groups.filter(g => g.isActive).map(g => (
                    <button key={g.id} onClick={() => toggleGroup(g.id)}
                      className={`px-3 py-2 rounded-xl text-sm border transition-all text-right ${
                        selectedGroupIds.includes(g.id)
                          ? 'bg-[#0E3B2E] text-white border-[#0E3B2E]'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-[#0E3B2E]/30'
                      }`}>
                      {getGroupSelectLabel(g)}
                    </button>
                  ))}
                </div>

                <p className="text-xs text-gray-500 mb-2">أو أضف طالباً فرداً</p>
                <div className="relative max-w-md">
                  <input
                    value={searchQ}
                    onChange={e => setSearchQ(e.target.value)}
                    placeholder="ابحث بالاسم أو الكود..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20"
                  />
                  {results.length > 0 && (
                    <div className="mt-2 border border-gray-100 rounded-lg overflow-hidden max-h-48 overflow-y-auto absolute bg-white w-full z-10 shadow-lg">
                      {results.map((s: any) => (
                        <button key={s.id} onClick={() => addStudent(s)}
                          className="w-full text-right px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0">
                          {s.fullName} {s.studentCode && <span className="text-gray-400 text-xs mr-2 font-mono">{s.studentCode}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-gray-700">
                    سيستلم التقرير ({selectedStudents.length} طالب)
                  </p>
                  {selectedStudents.length > 0 && (
                    <button onClick={clearAll} className="text-xs text-red-500 hover:text-red-700">مسح الكل</button>
                  )}
                </div>
                {selectedStudents.length === 0 ? (
                  <p className="text-sm text-gray-400">لم يتم اختيار أي طالب بعد</p>
                ) : (
                  <div className="border border-gray-100 rounded-lg divide-y divide-gray-50 max-h-64 overflow-y-auto">
                    {selectedStudents.map(s => (
                      <div key={s.id} className="flex items-center justify-between px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{s.fullName}</p>
                          {s.studentCode && <p className="text-xs text-gray-400 font-mono">{s.studentCode}</p>}
                        </div>
                        <button onClick={() => removeStudent(s.id)}
                          className="text-xs text-red-500 hover:text-red-700 px-2 py-1">إزالة</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {isSingleStudent && previewData && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {previewData.summary?.map((item, i) => (
                      <div key={i} className="bg-white rounded-xl p-4 text-center border border-gray-100">
                        <p className="text-xs text-gray-400 mb-1">{item.label}</p>
                        <p className="text-base font-bold text-[#0E3B2E]">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleDownload('xlsx')} disabled={downloadLoading !== null}
                      className="px-4 py-2 text-sm border border-[#0E3B2E] text-[#0E3B2E] rounded-lg hover:bg-[#0E3B2E]/5 disabled:opacity-50">
                      {downloadLoading === 'xlsx' ? 'جاري...' : 'تحميل Excel'}
                    </button>
                    <button onClick={() => handleDownload('pdf')} disabled={downloadLoading !== null}
                      className="px-4 py-2 text-sm border border-[#0E3B2E] text-[#0E3B2E] rounded-lg hover:bg-[#0E3B2E]/5 disabled:opacity-50">
                      {downloadLoading === 'pdf' ? 'جاري...' : 'تحميل PDF'}
                    </button>
                  </div>
                  {previewData.sections.map((section, i) => (
                    <SectionDataTable key={i} section={section} isLoading={previewFetching} />
                  ))}
                </>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <button onClick={handleSendWhatsapp} disabled={sending || selectedStudents.length === 0}
                  className="flex-1 py-3 text-sm font-bold bg-[#0E3B2E] text-white rounded-xl hover:bg-[#1F6B4E] disabled:opacity-50">
                  {sending ? 'جاري البدء...' : `إرسال عبر واتساب (${selectedStudents.length} طالب)`}
                </button>
                {selectedStudents.length > 1 && (
                  <button onClick={handlePrintAll} disabled={printLoading}
                    className="flex-1 py-3 text-sm font-bold border border-[#0E3B2E] text-[#0E3B2E] rounded-xl hover:bg-[#0E3B2E]/5 disabled:opacity-50">
                    {printLoading ? 'جاري التجهيز...' : `تحميل / طباعة PDF (${selectedStudents.length} طالب)`}
                  </button>
                )}
              </div>
            </>
          )}
        </div>

  );
}
