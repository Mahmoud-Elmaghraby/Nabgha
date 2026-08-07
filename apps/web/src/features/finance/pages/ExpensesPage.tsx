import { useState } from 'react';
import { useToast } from '@/shared/components/Toast';
import { useConfirm } from '@/shared/components/Confirm';
import { useExpenses, useExpenseMutations, useTreasuries } from '../hooks/useFinance';
import { EXPENSE_CATEGORY_LABELS } from '../types/finance.types';
import { FinanceLayout } from '../components/FinanceLayout';
import { usePermissions } from '@/shared/hooks/usePermissions';
import { DataTable } from '@/shared/components/DataTable';
import type { Column } from '@/shared/components/DataTable';
import type { Expense, ExpenseCategory } from '../types/finance.types';

const getCurrentMonthRange = () => {
  const now = new Date();
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
    to: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10),
  };
};

export default function ExpensesPage() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('finance.manage');
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | ''>('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ treasuryId: '', category: 'other' as ExpenseCategory, title: '', amount: '', expenseDate: new Date().toISOString().slice(0, 10), notes: '' });

  const { from, to } = getCurrentMonthRange();
  const { data, isLoading } = useExpenses({ category: categoryFilter || undefined, from, to, limit: 100 });
  const toast = useToast();
  const confirm = useConfirm();
  const { create, remove } = useExpenseMutations();
  const { data: treasuries = [] } = useTreasuries();

  const expenses = data?.data ?? [];
  const total = expenses.reduce((s, e) => s + e.amount, 0);

  const byCategory = Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, v]) => ({
    key: k as ExpenseCategory, ...v,
    amount: expenses.filter(e => e.category === k).reduce((s, e) => s + e.amount, 0),
  })).filter(c => c.amount > 0);

  const handleSubmit = async () => {
    if (!form.treasuryId || !form.title.trim() || !form.amount) return;
    try {
      await create.mutateAsync({ treasuryId: form.treasuryId, category: form.category, title: form.title, amount: Number(form.amount), expenseDate: form.expenseDate || undefined, notes: form.notes || undefined });
      setShowForm(false);
      setForm({ treasuryId: treasuries[0]?.id || '', category: 'other', title: '', amount: '', expenseDate: new Date().toISOString().slice(0, 10), notes: '' });
    } catch (err: any) { toast.error(err?.response?.data?.error?.message || 'حدث خطأ'); }
  };

  const handleRemove = async (e: Expense) => {
    if (await confirm('حذف هذا المصروف؟', { danger: true })) {
      try { await remove.mutateAsync(e.id); }
      catch (err: any) { toast.error(err?.response?.data?.error?.message || 'خطأ'); }
    }
  };

  const columns: Column<Expense>[] = [
    {
      key: 'title',
      header: 'المصروف',
      render: (e) => (
        <div className="flex items-center gap-2">
          <span className="text-lg shrink-0">{EXPENSE_CATEGORY_LABELS[e.category].icon}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{e.title}</p>
            <p className="text-xs text-gray-400">{EXPENSE_CATEGORY_LABELS[e.category].label}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'treasury',
      header: 'الخزينة',
      render: (e) => <span className="text-xs text-gray-500 whitespace-nowrap">{e.treasuryName}</span>,
    },
    {
      key: 'date',
      header: 'التاريخ',
      render: (e) => (
        <span className="text-xs text-gray-500 whitespace-nowrap">
          {new Date(e.expenseDate).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'المبلغ',
      render: (e) => <span className="text-sm font-bold text-red-600 whitespace-nowrap">{e.amount.toLocaleString('ar-EG')} ج</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (e) => {
        if (!canManage) return null;
        return (
          <div className="flex justify-end">
            <button onClick={() => handleRemove(e)}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-400 transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>
              </svg>
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <FinanceLayout>
      <div className="space-y-4">
        {/* Header Stats */}
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center justify-between">
          <p className="text-sm text-red-700 font-medium">إجمالي مصروفات الشهر</p>
          <p className="text-xl font-bold text-red-700">{total.toLocaleString('ar-EG')} جنيه</p>
        </div>

        {/* By Category */}
        {byCategory.length > 0 && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <p className="text-sm font-semibold text-gray-700 mb-3">توزيع المصروفات</p>
            <div className="space-y-2">
              {byCategory.map(c => (
                <div key={c.key} className="flex items-center gap-3">
                  <span className="text-lg w-6">{c.icon}</span>
                  <p className="text-xs text-gray-600 flex-1">{c.label}</p>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-red-400 rounded-full" style={{ width: `${Math.round((c.amount / total) * 100)}%` }} />
                  </div>
                  <p className="text-xs font-bold text-gray-700 w-20 text-left">{c.amount.toLocaleString('ar-EG')} ج</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter + Add */}
        <div className="flex gap-2 flex-wrap">
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value as ExpenseCategory | '')}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20">
            <option value="">كل الفئات</option>
            {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
          {canManage && (
            <button onClick={() => { setForm(p => ({ ...p, treasuryId: treasuries[0]?.id || '' })); setShowForm(true); }}
              className="mr-auto bg-[#0E3B2E] text-white rounded-xl px-4 py-2 text-sm font-medium">
              + مصروف جديد
            </button>
          )}
        </div>

        {/* List */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <DataTable<Expense>
            columns={columns}
            data={expenses}
            keyExtractor={(e) => e.id}
            isLoading={isLoading}
            emptyIcon="/Logo-icon-192.png"
            emptyTitle="لا توجد مصروفات هذا الشهر"
          />
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" dir="rtl">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-5 space-y-4">
            <h2 className="text-base font-bold text-gray-900">مصروف جديد</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">الفئة</label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value as ExpenseCategory }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20">
                  {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">التاريخ</label>
                <input type="date" value={form.expenseDate} onChange={e => setForm(p => ({ ...p, expenseDate: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">العنوان</label>
              <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20" placeholder="مثال: فاتورة كهرباء يونيو" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">المبلغ</label>
                <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">الخزينة</label>
                <select value={form.treasuryId} onChange={e => setForm(p => ({ ...p, treasuryId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20">
                  {treasuries.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">ملاحظات</label>
              <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20" placeholder="اختياري" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSubmit} disabled={create.isPending}
                className="flex-1 bg-[#0E3B2E] text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-60">
                {create.isPending ? '...' : 'حفظ'}
              </button>
              <button onClick={() => setShowForm(false)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </FinanceLayout>
  );
}
