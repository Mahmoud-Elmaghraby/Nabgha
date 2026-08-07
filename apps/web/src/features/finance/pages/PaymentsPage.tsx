import { useState, useEffect } from 'react';
import { useToast } from '@/shared/components/Toast';
import { usePayments, usePaymentMutations } from '../hooks/useFinance';
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from '../types/finance.types';
import { FinanceLayout } from '../components/FinanceLayout';
import { ThermalReceipt } from '../components/ThermalReceipt';
import { usePermissions } from '@/shared/hooks/usePermissions';
import { DataTable } from '@/shared/components/DataTable';
import type { Column } from '@/shared/components/DataTable';
import { ActionsDropdown } from '@/shared/components/ActionsDropdown';
import type { Payment, PaymentStatus } from '../types/finance.types';

const PAGE_SIZE = 30;

export default function PaymentsPage() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('finance.manage');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | ''>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [statusFilter, search, fromDate, toDate]);
  const [cancelModal, setCancelModal] = useState<Payment | null>(null);
  const [refundModal, setRefundModal] = useState<Payment | null>(null);
  const [printReceipt, setPrintReceipt] = useState<Payment | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundNotes, setRefundNotes] = useState('');

  const { data, isLoading } = usePayments({
    status: statusFilter || undefined,
    from: fromDate || undefined,
    to: toDate || undefined,
    page, limit: PAGE_SIZE,
  });
  const toast = useToast();
  const { cancel, refund } = usePaymentMutations();

  const allPayments = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const payments = search
    ? allPayments.filter(p => p.studentName?.includes(search) || p.studentCode?.includes(search) || String(p.receiptNumber).includes(search))
    : allPayments;

  const totalAmount = allPayments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);

  const handleCancel = async () => {
    if (!cancelModal || !cancelReason.trim()) return;
    try {
      await cancel.mutateAsync({ id: cancelModal.id, reason: cancelReason });
      setCancelModal(null); setCancelReason('');
    } catch (err: any) { toast.error(err?.response?.data?.error?.message || 'حدث خطأ'); }
  };

  const handleRefund = async () => {
    if (!refundModal || !refundAmount) return;
    try {
      await refund.mutateAsync({ id: refundModal.id, amount: Number(refundAmount), notes: refundNotes || undefined });
      setRefundModal(null); setRefundAmount(''); setRefundNotes('');
    } catch (err: any) { toast.error(err?.response?.data?.error?.message || 'حدث خطأ'); }
  };

  const columns: Column<Payment>[] = [
    {
      key: 'receipt',
      header: 'الإيصال',
      render: (p) => (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-900">إيصال #{p.receiptNumber}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ${PAYMENT_STATUS_LABELS[p.status].class}`}>
            {PAYMENT_STATUS_LABELS[p.status].label}
          </span>
          {p.cancelReason && <span className="text-xs text-red-400">سبب الإلغاء: {p.cancelReason}</span>}
        </div>
      ),
    },
    {
      key: 'student',
      header: 'الطالب',
      render: (p) => (
        <div className="text-xs text-gray-500 whitespace-nowrap">
          <p className="text-gray-700 font-medium">{p.studentName}</p>
          <p>{p.subjectName} — {p.month}</p>
        </div>
      ),
    },
    {
      key: 'method',
      header: 'طريقة الدفع',
      render: (p) => (
        <span className="text-xs text-gray-500 whitespace-nowrap">
          {PAYMENT_METHOD_LABELS[p.paymentMethod]} • {p.treasuryName}
        </span>
      ),
    },
    {
      key: 'date',
      header: 'التاريخ',
      render: (p) => (
        <span className="text-xs text-gray-500 whitespace-nowrap">
          {new Date(p.paidAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'المبلغ',
      render: (p) => (
        <span className="text-sm font-bold text-gray-900 whitespace-nowrap">{p.amount.toLocaleString('ar-EG')} ج</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (p) => (
        <div className="flex items-center gap-1.5 justify-end">
          <button onClick={() => setPrintReceipt(p)}
            className="text-xs px-3 py-1.5 border border-[#0E3B2E]/30 text-[#0E3B2E] rounded-lg hover:bg-[#0E3B2E]/5 transition-colors flex items-center gap-1 whitespace-nowrap">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 6 2 18 2 18 9"/>
              <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            طباعة
          </button>
          {canManage && p.status === 'paid' && (
            <ActionsDropdown items={[
              { label: 'استرجاع', onClick: () => { setRefundModal(p); setRefundAmount(String(p.amount)); }, variant: 'warning' },
              { label: 'إلغاء', onClick: () => { setCancelModal(p); setCancelReason(''); }, variant: 'danger' },
            ]} />
          )}
        </div>
      ),
    },
  ];

  return (
    <FinanceLayout>
      <div className="space-y-4">
        {/* Stats */}
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center justify-between">
          <p className="text-sm text-emerald-700 font-medium">إجمالي المحصّل</p>
          <p className="text-xl font-bold text-emerald-700">{totalAmount.toLocaleString('ar-EG')} جنيه</p>
        </div>

        {/* Search + Filter */}
        <div className="bg-white rounded-2xl p-3 border border-gray-100 space-y-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث برقم الإيصال أو اسم الطالب..."
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20" />
          <div className="flex gap-2 flex-wrap items-center">
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20" title="من تاريخ" />
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20" title="إلى تاريخ" />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as PaymentStatus | '')}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20">
              <option value="">كل الإيصالات</option>
              {Object.entries(PAYMENT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>

        {/* List */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <DataTable<Payment>
            columns={columns}
            data={payments}
            keyExtractor={(p) => p.id}
            isLoading={isLoading}
            emptyIcon="/Logo-icon-192.png"
            emptyTitle={search ? 'لا نتائج للبحث' : 'لا توجد إيصالات'}
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

      {/* Print Modal */}
      {printReceipt && (
        <ThermalReceipt
          receipt={{
            receiptNumber: printReceipt.receiptNumber,
            studentName: printReceipt.studentName ?? '',
            studentCode: printReceipt.studentCode ?? '',
            amount: printReceipt.amount,
            paymentMethod: printReceipt.paymentMethod,
            subjectName: printReceipt.subjectName,
            month: printReceipt.month,
            treasuryName: printReceipt.treasuryName ?? undefined,
            paidAt: printReceipt.paidAt,
            monthlyDueId: printReceipt.monthlyDueId,
            discountApplied: printReceipt.discountApplied,
          }}
          onClose={() => setPrintReceipt(null)}
        />
      )}

      {/* Cancel Modal */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" dir="rtl">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-5 space-y-4">
            <h2 className="text-base font-bold text-red-600">إلغاء إيصال #{cancelModal.receiptNumber}</h2>
            <p className="text-sm text-gray-500">سيتم خصم {cancelModal.amount.toLocaleString('ar-EG')} جنيه من الخزينة</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">سبب الإلغاء <span className="text-red-500">*</span></label>
              <input value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleCancel} disabled={cancel.isPending || !cancelReason.trim()}
                className="flex-1 bg-red-500 text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-60">
                {cancel.isPending ? '...' : 'تأكيد الإلغاء'}
              </button>
              <button onClick={() => setCancelModal(null)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm">إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {refundModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" dir="rtl">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-5 space-y-4">
            <h2 className="text-base font-bold text-orange-600">استرجاع — إيصال #{refundModal.receiptNumber}</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">مبلغ الاسترجاع</label>
              <input type="number" value={refundAmount} onChange={e => setRefundAmount(e.target.value)} max={refundModal.amount}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات</label>
              <input value={refundNotes} onChange={e => setRefundNotes(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200" placeholder="اختياري" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleRefund} disabled={refund.isPending || !refundAmount}
                className="flex-1 bg-orange-500 text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-60">
                {refund.isPending ? '...' : 'تأكيد الاسترجاع'}
              </button>
              <button onClick={() => setRefundModal(null)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm">إغلاق</button>
            </div>
          </div>
        </div>
      )}
    </FinanceLayout>
  );
}
