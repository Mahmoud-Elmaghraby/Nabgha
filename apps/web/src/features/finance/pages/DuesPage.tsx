import { useState } from 'react';
import { useDues, useDueMutations, useTreasuries, usePaymentMutations } from '../hooks/useFinance';
import { DUE_STATUS_LABELS } from '../types/finance.types';
import { FinanceLayout } from '../components/FinanceLayout';
import type { MonthlyDue, DueStatus } from '../types/finance.types';

const getCurrentMonth = () => new Date().toISOString().slice(0, 7);

export default function DuesPage() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [statusFilter, setStatusFilter] = useState<DueStatus | ''>('');
  const [search, setSearch] = useState('');
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedDue, setSelectedDue] = useState<MonthlyDue | null>(null);
  const [payForm, setPayForm] = useState({ treasuryId: '', amount: '', paymentMethod: 'cash', notes: '' });

  const { data, isLoading } = useDues({ month, status: statusFilter || undefined, limit: 100 });
  const { generate, waive } = useDueMutations();
  const { create: createPayment } = usePaymentMutations();
  const { data: treasuries = [] } = useTreasuries();

  const allDues = data?.data ?? [];
  const dues = search
    ? allDues.filter(d => d.studentName?.includes(search) || d.studentCode?.includes(search) || d.subjectName?.includes(search))
    : allDues;

  const totalDues = allDues.reduce((s, d) => s + d.dueAmount - d.discountApplied, 0);
  const totalPaid = allDues.reduce((s, d) => s + d.paidAmount, 0);

  const handleGenerate = async () => {
    if (!confirm(`توليد فواتير شهر ${month}؟`)) return;
    try {
      const r = await generate.mutateAsync(month);
      alert(`تم توليد ${r.created} فاتورة — ${r.skipped} مكررة`);
    } catch (err: any) { alert(err?.response?.data?.error?.message || 'حدث خطأ'); }
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
    } catch (err: any) { alert(err?.response?.data?.error?.message || 'حدث خطأ'); }
  };

  return (
    <FinanceLayout>
      <div className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
            <p className="text-xl font-bold text-gray-900">{allDues.length}</p>
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
          <div className="flex gap-2 flex-wrap">
            <input type="month" value={month} onChange={e => setMonth(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20" />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as DueStatus | '')}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20">
              <option value="">كل الحالات</option>
              {Object.entries(DUE_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <button onClick={handleGenerate} disabled={generate.isPending}
              className="mr-auto bg-[#0E3B2E] text-white rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-60">
              {generate.isPending ? '...' : 'توليد الفواتير'}
            </button>
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
        ) : dues.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-5xl mb-4">📋</p>
            <p className="font-medium">{search ? 'لا نتائج للبحث' : 'لا توجد فواتير'}</p>
            {!search && <p className="text-sm mt-1">اضغط "توليد الفواتير" لإنشائها</p>}
          </div>
        ) : (
          <div className="space-y-2">
            {dues.map(due => {
              const remaining = due.dueAmount - due.discountApplied - due.paidAmount;
              const isOpen = due.status === 'unpaid' || due.status === 'partial';
              return (
                <div key={due.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900 text-sm">{due.studentName}</p>
                        <span className="text-xs text-gray-400 font-mono">{due.studentCode}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${DUE_STATUS_LABELS[due.status].class}`}>
                          {DUE_STATUS_LABELS[due.status].label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{due.subjectName} — {due.gradeName}</p>
                      {due.discountApplied > 0 && (
                        <p className="text-xs text-amber-600 mt-0.5">خصم: {due.discountApplied.toLocaleString('ar-EG')} ج</p>
                      )}
                    </div>
                    <div className="text-left shrink-0">
                      <p className="text-base font-bold text-gray-900">{(due.dueAmount - due.discountApplied).toLocaleString('ar-EG')} ج</p>
                      {remaining > 0 && due.status !== 'waived' && (
                        <p className="text-xs text-red-500">متبقي: {remaining.toLocaleString('ar-EG')}</p>
                      )}
                      {due.paidAmount > 0 && due.status !== 'paid' && (
                        <p className="text-xs text-emerald-500">مدفوع: {due.paidAmount.toLocaleString('ar-EG')}</p>
                      )}
                    </div>
                  </div>
                  {isOpen && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
                      <button onClick={() => handlePay(due)}
                        className="flex-1 bg-[#0E3B2E] text-white rounded-xl py-2 text-xs font-bold hover:bg-[#1a5c44] transition-colors">
                        💰 تسجيل دفعة
                      </button>
                      <button onClick={async () => { if (confirm('إعفاء هذه الفاتورة؟')) { try { await waive.mutateAsync({ id: due.id }); } catch(e: any) { alert(e?.response?.data?.error?.message || 'خطأ'); } } }}
                        className="px-3 border border-gray-200 rounded-xl py-2 text-xs text-gray-500 hover:bg-gray-50">
                        إعفاء
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
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
