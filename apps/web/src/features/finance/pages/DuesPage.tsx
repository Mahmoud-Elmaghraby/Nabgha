import { useEffect, useState } from 'react';
import { useToast } from '@/shared/components/Toast';
import { useConfirm } from '@/shared/components/Confirm';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { useDues, useDueMutations, useTreasuries, usePaymentMutations } from '../hooks/useFinance';
import { DUE_STATUS_LABELS } from '../types/finance.types';
import { FinanceLayout } from '../components/FinanceLayout';
import { usePermissions } from '@/shared/hooks/usePermissions';
import { DataTable } from '@/shared/components/DataTable';
import type { Column } from '@/shared/components/DataTable';
import { ActionsDropdown } from '@/shared/components/ActionsDropdown';
import type { MonthlyDue, DueStatus } from '../types/finance.types';

const getCurrentMonth = () => new Date().toISOString().slice(0, 7);
const PAGE_SIZE = 30;

export default function DuesPage() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('finance.manage');
  const canCollect = hasPermission('finance.collect');
  // فاضي = كل الشهور (مش بس الشهر الحالي)
  const [month, setMonth] = useState('');
  const [statusFilter, setStatusFilter] = useState<DueStatus | ''>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedDue, setSelectedDue] = useState<MonthlyDue | null>(null);
  const [payForm, setPayForm] = useState({ treasuryId: '', amount: '', paymentMethod: 'cash', notes: '' });

  useEffect(() => { setPage(1); }, [month, statusFilter, debouncedSearch, fromDate, toDate]);

  const { data, isLoading } = useDues({
    month: month || undefined,
    status: statusFilter || undefined,
    search: debouncedSearch || undefined,
    from: fromDate || undefined,
    to: toDate || undefined,
    page, limit: PAGE_SIZE,
  });
  const toast = useToast();
  const confirm = useConfirm();
  const { generate, waive, remove } = useDueMutations();
  const { create: createPayment } = usePaymentMutations();
  const { data: treasuries = [] } = useTreasuries();

  const dues = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const totalDues = (data?.totalDueAmount ?? 0) - (data?.totalDiscountApplied ?? 0);
  const totalPaid = data?.totalPaidAmount ?? 0;

  const handleGenerate = async () => {
    const genMonth = month || getCurrentMonth();
    if (!(await confirm(`توليد فواتير شهر ${genMonth}؟`))) return;
    try {
      const r = await generate.mutateAsync(genMonth);
      toast.success(`تم توليد ${r.created} فاتورة — ${r.skipped} مكررة`);
    } catch (err: any) { toast.error(err?.response?.data?.error?.message || 'حدث خطأ'); }
  };

  const handlePay = (due: MonthlyDue) => {
    setSelectedDue(due);
    const remaining = due.dueAmount - due.discountApplied - due.paidAmount;
    setPayForm({ treasuryId: treasuries[0]?.id || '', amount: String(remaining), paymentMethod: 'cash', notes: '' });
    setShowPayModal(true);
  };

  const handlePaySubmit = async () => {
    if (!selectedDue || !payForm.treasuryId || !payForm.amount) return;
    try {
      await createPayment.mutateAsync({ monthlyDueId: selectedDue.id, treasuryId: payForm.treasuryId, amount: Number(payForm.amount), paymentMethod: payForm.paymentMethod, notes: payForm.notes || undefined });
      setShowPayModal(false);
    } catch (err: any) { toast.error(err?.response?.data?.error?.message || 'حدث خطأ'); }
  };

  const handleDelete = async (due: MonthlyDue) => {
    if (await confirm('هل أنت متأكد من حذف هذه الفاتورة؟ لا يمكن التراجع عن هذا الإجراء.')) {
      try { await remove.mutateAsync(due.id); }
      catch (e: any) { toast.error(e?.response?.data?.error?.message || 'خطأ أثناء الحذف'); }
    }
  };

  const handleWaive = async (due: MonthlyDue, remaining: number) => {
    const confirmMsg = due.paidAmount > 0
      ? `الفاتورة متحصل منها ${due.paidAmount.toLocaleString('ar-EG')} ج بالفعل — الإعفاء هيسامح بس في المتبقي (${remaining.toLocaleString('ar-EG')} ج). تأكيد؟`
      : 'إعفاء هذه الفاتورة؟';
    if (await confirm(confirmMsg)) {
      try { await waive.mutateAsync({ id: due.id }); }
      catch (e: any) { toast.error(e?.response?.data?.error?.message || 'خطأ'); }
    }
  };

  const columns: Column<MonthlyDue>[] = [
    {
      key: 'student',
      header: 'الطالب',
      render: (due) => (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-900">{due.studentName}</span>
          <span className="text-xs text-gray-400 font-mono">{due.studentCode}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ${DUE_STATUS_LABELS[due.status].class}`}>
            {DUE_STATUS_LABELS[due.status].label}
          </span>
        </div>
      ),
    },
    {
      key: 'subject',
      header: 'المادة',
      render: (due) => (
        <div className="text-xs text-gray-500 whitespace-nowrap">
          {due.subjectName} — {due.gradeName} · {due.month}
          {due.discountApplied > 0 && (
            <span className="block text-amber-600 mt-0.5">خصم: {due.discountApplied.toLocaleString('ar-EG')} ج</span>
          )}
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'المبلغ',
      render: (due) => (
        <span className="text-sm font-bold text-gray-900 whitespace-nowrap">
          {(due.dueAmount - due.discountApplied).toLocaleString('ar-EG')} ج
        </span>
      ),
    },
    {
      key: 'remaining',
      header: 'المتبقي/المدفوع',
      render: (due) => {
        const remaining = due.dueAmount - due.discountApplied - due.paidAmount;
        return (
          <div className="text-xs whitespace-nowrap">
            {remaining > 0 && due.status !== 'waived' && (
              <p className="text-red-500">متبقي: {remaining.toLocaleString('ar-EG')}</p>
            )}
            {due.paidAmount > 0 && due.status !== 'paid' && (
              <p className="text-emerald-500">مدفوع: {due.paidAmount.toLocaleString('ar-EG')}</p>
            )}
            {remaining <= 0 && due.paidAmount <= 0 && <span className="text-gray-300">—</span>}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      render: (due) => {
        const remaining = due.dueAmount - due.discountApplied - due.paidAmount;
        const isOpen = due.status === 'unpaid' || due.status === 'partial';
        if (!isOpen || (!canCollect && !canManage)) return null;
        return (
          <div className="flex items-center gap-1.5 justify-end">
            {canCollect && (
              <button onClick={() => handlePay(due)}
                className="text-xs px-3 py-1.5 bg-[#0E3B2E] text-white rounded-lg hover:bg-[#1F6B4E] transition-colors whitespace-nowrap">
                💰 تسجيل دفعة
              </button>
            )}
            {canManage && (
              <ActionsDropdown items={[
                { label: 'إعفاء', onClick: () => handleWaive(due, remaining) },
                { label: 'حذف', onClick: () => handleDelete(due), variant: 'danger', hidden: due.status !== 'unpaid' },
              ]} />
            )}
          </div>
        );
      },
    },
  ];

  return (
    <FinanceLayout>
      <div className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
            <p className="text-xl font-bold text-gray-900">{total}</p>
            <p className="text-xs text-gray-400 mt-1">إجمالي</p>
          </div>
          <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 text-center">
            <p className="text-xl font-bold text-emerald-600">{totalPaid.toLocaleString('ar-EG')}</p>
            <p className="text-xs text-emerald-500 mt-1">محصّل</p>
          </div>
          <div className="bg-red-50 rounded-2xl p-4 border border-red-100 text-center">
            <p className="text-xl font-bold text-red-500">{(totalDues - totalPaid).toLocaleString('ar-EG')}</p>
            <p className="text-xs text-red-400 mt-1">متبقي</p>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="bg-white rounded-2xl p-3 border border-gray-100 space-y-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الكود أو المادة..."
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20" />
          <div className="flex gap-2 flex-wrap items-center">
            <input type="month" value={month} onChange={e => setMonth(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20" />
            {month && (
              <button onClick={() => setMonth('')} className="text-xs text-gray-400 hover:text-gray-600 underline">
                عرض كل الشهور
              </button>
            )}
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20" title="من تاريخ" />
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20" title="إلى تاريخ" />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as DueStatus | '')}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20">
              <option value="">كل الحالات</option>
              {Object.entries(DUE_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            {canManage && (
              <button onClick={handleGenerate} disabled={generate.isPending}
                className="mr-auto bg-[#0E3B2E] text-white rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-60">
                {generate.isPending ? '...' : 'توليد الفواتير'}
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <DataTable<MonthlyDue>
            columns={columns}
            data={dues}
            keyExtractor={(d) => d.id}
            isLoading={isLoading}
            emptyIcon="/Logo-icon-192.png"
            emptyTitle={search ? 'لا نتائج للبحث' : 'لا توجد فواتير'}
            emptySubtitle={search ? 'جرّب تعديل كلمة البحث أو الفلاتر' : 'اضغط "توليد الفواتير" لإنشائها'}
          />
        </div>

        {/* Pagination */}
        {!isLoading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
              السابق
            </button>
            <span className="text-xs text-gray-500">صفحة {page} من {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
              التالي
            </button>
          </div>
        )}
      </div>

      {/* Pay Modal */}
      {showPayModal && selectedDue && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" dir="rtl">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-5 space-y-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">تسجيل دفعة</h2>
              <p className="text-sm text-gray-400 mt-0.5">{selectedDue.studentName} — {selectedDue.subjectName}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">المبلغ</label>
                <input type="number" value={payForm.amount} onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">طريقة الدفع</label>
                <select value={payForm.paymentMethod} onChange={e => setPayForm(p => ({ ...p, paymentMethod: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20">
                  <option value="cash">كاش</option>
                  <option value="visa">فيزا</option>
                  <option value="instapay">إنستاباي</option>
                  <option value="vodafone">فودافون</option>
                  <option value="bank">تحويل</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">الخزينة</label>
              <select value={payForm.treasuryId} onChange={e => setPayForm(p => ({ ...p, treasuryId: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20">
                {treasuries.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">ملاحظات</label>
              <input value={payForm.notes} onChange={e => setPayForm(p => ({ ...p, notes: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20" placeholder="اختياري" />
            </div>
            <div className="flex gap-2">
              <button onClick={handlePaySubmit} disabled={createPayment.isPending}
                className="flex-1 bg-[#0E3B2E] text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-60">
                {createPayment.isPending ? 'جاري...' : '✓ تأكيد الدفع'}
              </button>
              <button onClick={() => setShowPayModal(false)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </FinanceLayout>
  );
}
