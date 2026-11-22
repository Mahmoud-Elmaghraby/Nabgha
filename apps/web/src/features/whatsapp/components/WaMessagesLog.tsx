import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/lib/api/client';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { useToast } from '@/shared/components/Toast';
import { WA_QUERY_KEYS } from '../hooks/useWhatsapp';

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  sent:    { label: 'أُرسلت', class: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  pending: { label: 'معلقة',  class: 'bg-amber-50 text-amber-700 border border-amber-200' },
  failed:  { label: 'فشلت',   class: 'bg-red-50 text-red-600 border border-red-200' },
};

const TEMPLATE_LABELS: Record<string, string> = {
  GROUP_ADDED:     'إضافة لمجموعة',
  GROUP_REMOVED:   'إزالة من مجموعة',
  ABSENT:          'غياب',
  PRESENT:         'حضور',
  LATE:            'تأخر',
  THREE_ABSENCES:  '3 غيابات',
  PAYMENT_CONFIRM: 'تأكيد دفع',
  PAYMENT_DUE:     'تذكير دفع',
  PAYMENT_OVERDUE: 'تأخر دفع',
  NEW_STUDENT:     'طالب جديد',
  ABSENCE_EXCUSED: 'إعفاء غياب',
  GRADE_RECORDED:  'تسجيل درجة',
};

const ERROR_LABELS: Record<string, string> = {
  not_connected:        'واتساب غير متصل',
  wa_disabled:          'واتساب معطل',
  outside_send_hours:   'خارج ساعات الإرسال',
  daily_limit_reached:  'تم الوصول للحد اليومي',
  template_not_found:   'القالب غير موجود',
  notification_disabled: 'الإشعار معطل من الإعدادات',
  session_banned:       'الجلسة محظورة',
};

const STATUS_FILTER_OPTIONS = [
  { value: '',        label: 'كل الحالات' },
  { value: 'sent',    label: 'أُرسلت' },
  { value: 'pending', label: 'معلقة' },
  { value: 'failed',  label: 'فشلت' },
];

function todayStr(): string {
  return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD (local)
}

export function WaMessagesLog() {
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const limit = 15;

  const debouncedSearch = useDebounce(search, 400);

  const { data, isLoading } = useQuery({
    queryKey: WA_QUERY_KEYS.messages({ status: statusFilter, search: debouncedSearch, from: fromDate, to: toDate, page }),
    queryFn: async () => {
      const params: Record<string, any> = { page, limit };
      if (statusFilter) params.status = statusFilter;
      if (debouncedSearch) params.search = debouncedSearch;
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;
      const res = await apiClient.get('/whatsapp/messages', { params });
      return res.data.data;
    },
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });

  const messages = data?.data || [];
  const total    = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const toast = useToast();
  const qc = useQueryClient();

  // إعادة إرسال يدوية لرسالة فشلت (زر ↻) — الباك إند بيتحقق من كل شروط الأمان
  // (اتصال، ساعات إرسال، الحد اليومي) قبل أي محاولة فعلية، فمفيش داعي نكرر التحقق هنا.
  const retryMessage = useMutation({
    mutationFn: (id: string) => apiClient.post(`/whatsapp/messages/${id}/retry`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wa', 'messages'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || 'فشلت إعادة الإرسال');
    },
  });

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleFromChange = (value: string) => {
    setFromDate(value);
    setPage(1);
  };

  const handleToChange = (value: string) => {
    setToDate(value);
    setPage(1);
  };

  const handleToday = () => {
    const t = todayStr();
    setFromDate(t);
    setToDate(t);
    setPage(1);
  };

  const clearDates = () => {
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* ─── Filters ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
            </svg>
          </span>
          <input
            type="text"
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="ابحث باسم الطالب أو رقم الهاتف..."
            className="w-full bg-gray-50 border border-gray-200 rounded-lg pr-9 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20 focus:border-[#0E3B2E]/40 placeholder:text-gray-400"
          />
          {search && (
            <button
              onClick={() => handleSearchChange('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {STATUS_FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleStatusChange(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                statusFilter === opt.value
                  ? 'bg-[#0E3B2E] text-white border-[#0E3B2E]'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <span className="text-sm text-gray-400 flex-shrink-0 self-center">
          {total} رسالة
        </span>
      </div>

      {/* ─── Date range filter ──────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="flex items-center gap-2 flex-1">
          <label className="text-xs text-gray-400 flex-shrink-0">من</label>
          <input
            type="date"
            value={fromDate}
            max={toDate || undefined}
            onChange={e => handleFromChange(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20 focus:border-[#0E3B2E]/40"
          />
          <label className="text-xs text-gray-400 flex-shrink-0">إلى</label>
          <input
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={e => handleToChange(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20 focus:border-[#0E3B2E]/40"
          />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleToday}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
              fromDate === todayStr() && toDate === todayStr()
                ? 'bg-[#0E3B2E] text-white border-[#0E3B2E]'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            اليوم
          </button>
          {(fromDate || toDate) && (
            <button
              onClick={clearDates}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
            >
              مسح
            </button>
          )}
        </div>
      </div>

      {/* ─── Messages ────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : messages.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 mx-auto mb-3 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
          </svg>
          <p className="text-sm">
            {search || statusFilter || fromDate || toDate ? 'لا توجد رسائل تطابق البحث' : 'لا توجد رسائل بعد'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {messages.map((msg: any) => (
            <div
              key={msg.id}
              className="bg-white border border-gray-100 rounded-xl p-4 hover:border-gray-200 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Row 1: Name + code + template */}
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900">
                      {msg.studentName || '—'}
                    </span>
                    {msg.studentCode && (
                      <span className="text-xs text-gray-400 font-mono bg-gray-50 px-1.5 py-0.5 rounded">
                        {msg.studentCode}
                      </span>
                    )}
                    <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full border border-blue-100">
                      {TEMPLATE_LABELS[msg.templateKey] || msg.templateKey}
                    </span>
                  </div>

                  {/* Row 2: Message body */}
                  <p className="text-xs text-gray-500 truncate mb-1.5">{msg.body}</p>

                  {/* Row 3: Phone + date + error */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-400 font-mono">{msg.phone}</span>
                    <span className="text-gray-200">·</span>
                    <span className="text-xs text-gray-400">
                      {new Date(msg.createdAt).toLocaleString('ar-EG')}
                    </span>
                    {msg.errorMessage && (
                      <>
                        <span className="text-gray-200">·</span>
                        <span className="text-xs text-red-400 flex items-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                          </svg>
                          {ERROR_LABELS[msg.errorMessage] || msg.errorMessage}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Status badge + إعادة إرسال */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    STATUS_LABELS[msg.status]?.class || 'bg-gray-100 text-gray-500 border border-gray-200'
                  }`}>
                    {STATUS_LABELS[msg.status]?.label || msg.status}
                  </span>
                  {msg.status === 'failed' && (
                    <button
                      onClick={() => retryMessage.mutate(msg.id)}
                      disabled={retryMessage.isPending && retryMessage.variables === msg.id}
                      title="إعادة الإرسال"
                      className="p-1.5 rounded-full text-gray-400 hover:text-[#0E3B2E] hover:bg-[#0E3B2E]/5 disabled:opacity-40 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg"
                        className={`w-3.5 h-3.5 ${retryMessage.isPending && retryMessage.variables === msg.id ? 'animate-spin' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Pagination ──────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            السابق
          </button>
          <span className="text-sm text-gray-500 px-2">{page} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            التالي
          </button>
        </div>
      )}
    </div>
  );
}
