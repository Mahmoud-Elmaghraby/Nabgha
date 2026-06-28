import { useState } from 'react';
import { usePayments, usePaymentMutations } from '../hooks/useFinance';
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from '../types/finance.types';
import type { Payment, PaymentStatus } from '../types/finance.types';

export function PaymentsTab() {
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | ''>('');
  const [cancelModal, setCancelModal] = useState<Payment | null>(null);
  const [refundModal, setRefundModal] = useState<Payment | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundNotes, setRefundNotes] = useState('');

  const { data, isLoading } = usePayments({ status: statusFilter || undefined, limit: 50 });
  const { cancel, refund } = usePaymentMutations();

  const payments = data?.data ?? [];

  const handleCancel = async () => {
    if (!cancelModal || !cancelReason.trim()) return;
    try {
      await cancel.mutateAsync({ id: cancelModal.id, reason: cancelReason });
      setCancelModal(null);
      setCancelReason('');
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'حدث خطأ');
    }
  };

  const handleRefund = async () => {
    if (!refundModal || !refundAmount) return;
    try {
      await refund.mutateAsync({ id: refundModal.id, amount: Number(refundAmount), notes: refundNotes || undefined });
      setRefundModal(null);
      setRefundAmount('');
      setRefundNotes('');
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'حدث خطأ');
    }
  };

  const totalAmount = payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-4" dir="rtl">
      {/* Stats */}
      <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center justify-between">
        <p className="text-sm text-emerald-700 font-medium">إجمالي المحصّل</p>
        <p className="text-xl font-bold text-emerald-700">{totalAmount.toLocaleString('ar-EG')} جنيه</p>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as PaymentStatus | '')}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20">
          <option value="">كل الإيصالات</option>
          {Object.entries(PAYMENT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      ) : payments.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">💰</p>
          <p className="text-sm">لا توجد إيصالات</p>
        </div>
      ) : (
        <div className="space-y-2">
          {payments.map(p => (
            <div key={p.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-900 text-sm">إيصال #{p.receiptNumber}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${PAYMENT_STATUS_LABELS[p.status].class}`}>
                      {PAYMENT_STATUS_LABELS[p.status].label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{p.studentName} — {p.subjectName}</p>
                  <p className="text-xs text-gray-400">{PAYMENT_METHOD_LABELS[p.paymentMethod]} • {p.treasuryName}</p>
                  <p className="text-xs text-gray-400">{new Date(p.paidAt).toLocaleDateString('ar-EG')}</p>
                </div>
                <div className="text-left shrink-0">
                  <p className="text-lg font-bold text-gray-900">{p.amount.toLocaleString('ar-EG')} ج</p>
                  {p.status === 'paid' && (
                    <div className="flex gap-1 mt-2">
                      <button onClick={() => { setRefundModal(p); setRefundAmount(String(p.amount)); }}
                        className="text-xs px-2 py-1 border border-orange-200 text-orange-600 rounded-lg hover:bg-orange-50">
                        استرجاع
                      </button>
                      <button onClick={() => { setCancelModal(p); setCancelReason(''); }}
                        className="text-xs px-2 py-1 border border-red-200 text-red-500 rounded-lg hover:bg-red-50">
                        إلغاء
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {p.cancelReason && (
                <p className="text-xs text-red-400 mt-2 pt-2 border-t border-gray-50">سبب الإلغاء: {p.cancelReason}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Cancel Modal */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" dir="rtl">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-5 space-y-4">
            <h2 className="text-base font-bold text-red-600">إلغاء الإيصال #{cancelModal.receiptNumber}</h2>
            <p className="text-sm text-gray-500">سيتم سحب {cancelModal.amount.toLocaleString('ar-EG')} جنيه من الخزينة</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">سبب الإلغاء</label>
              <input value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" placeholder="مطلوب" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleCancel} disabled={cancel.isPending || !cancelReason.trim()}
                className="flex-1 bg-red-500 text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-60">
                {cancel.isPending ? 'جاري الإلغاء...' : 'تأكيد الإلغاء'}
              </button>
              <button onClick={() => setCancelModal(null)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm">إلغاء</button>
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
              <input type="number" value={refundAmount} onChange={e => setRefundAmount(e.target.value)}
                max={refundModal.amount}
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
                {refund.isPending ? 'جاري الاسترجاع...' : 'تأكيد الاسترجاع'}
              </button>
              <button onClick={() => setRefundModal(null)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
