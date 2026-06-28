import { useState } from 'react';
import { useExpenses, useExpenseMutations, useTreasuries } from '../hooks/useFinance';
import { EXPENSE_CATEGORY_LABELS } from '../types/finance.types';
import type { ExpenseCategory } from '../types/finance.types';

const getCurrentMonth = () => {
  const now = new Date();
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
    to: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10),
  };
};

export function ExpensesTab() {
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | ''>('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    treasuryId: '', category: 'other' as ExpenseCategory,
    title: '', amount: '', expenseDate: new Date().toISOString().slice(0, 10), notes: '',
  });

  const { from, to } = getCurrentMonth();
  const { data, isLoading } = useExpenses({ category: categoryFilter || undefined, from, to, limit: 50 });
  const { create, remove } = useExpenseMutations();
  const { data: treasuries = [] } = useTreasuries();

  const expenses = data?.data ?? [];
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  const handleSubmit = async () => {
    if (!form.treasuryId || !form.title.trim() || !form.amount) return;
    try {
      await create.mutateAsync({
        treasuryId: form.treasuryId,
        category: form.category,
        title: form.title,
        amount: Number(form.amount),
        expenseDate: form.expenseDate || undefined,
        notes: form.notes || undefined,
      });
      setShowForm(false);
      setForm({ treasuryId: treasuries[0]?.id || '', category: 'other', title: '', amount: '', expenseDate: new Date().toISOString().slice(0, 10), notes: '' });
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'حدث خطأ');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل تريد حذف هذا المصروف؟')) return;
    try {
      await remove.mutateAsync(id);
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'حدث خطأ');
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Stats */}
      <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center justify-between">
        <p className="text-sm text-red-700 font-medium">إجمالي مصروفات الشهر</p>
        <p className="text-xl font-bold text-red-700">{totalExpenses.toLocaleString('ar-EG')} جنيه</p>
      </div>

      {/* Filters + Add */}
      <div className="flex gap-2 flex-wrap">
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value as ExpenseCategory | '')}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20">
          <option value="">كل الفئات</option>
          {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v.icon} {v.label}</option>
          ))}
        </select>
        <button onClick={() => { setForm(p => ({ ...p, treasuryId: treasuries[0]?.id || '' })); setShowForm(true); }}
          className="mr-auto bg-[#0E3B2E] text-white rounded-xl px-4 py-2 text-sm font-medium">
          + مصروف جديد
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">📤</p>
          <p className="text-sm">لا توجد مصروفات هذا الشهر</p>
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map(e => (
            <div key={e.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-lg shrink-0">
                    {EXPENSE_CATEGORY_LABELS[e.category].icon}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{e.title}</p>
                    <p className="text-xs text-gray-400">{EXPENSE_CATEGORY_LABELS[e.category].label} • {e.treasuryName}</p>
                    <p className="text-xs text-gray-400">{new Date(e.expenseDate).toLocaleDateString('ar-EG')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <p className="font-bold text-red-600">{e.amount.toLocaleString('ar-EG')} ج</p>
                  <button onClick={() => handleDelete(e.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-400">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" dir="rtl">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-5 space-y-4">
            <h2 className="text-base font-bold text-gray-900">مصروف جديد</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الفئة</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value as ExpenseCategory }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20">
                {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v.icon} {v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">العنوان</label>
              <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20"
                placeholder="مثال: فاتورة كهرباء يونيو" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ</label>
              <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">التاريخ</label>
              <input type="date" value={form.expenseDate} onChange={e => setForm(p => ({ ...p, expenseDate: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الخزينة</label>
              <select value={form.treasuryId} onChange={e => setForm(p => ({ ...p, treasuryId: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20">
                {treasuries.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات</label>
              <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20"
                placeholder="اختياري" />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleSubmit} disabled={create.isPending}
                className="flex-1 bg-[#0E3B2E] text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-60">
                {create.isPending ? 'جاري الحفظ...' : 'حفظ'}
              </button>
              <button onClick={() => setShowForm(false)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-600">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
