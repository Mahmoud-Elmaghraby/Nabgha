import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/shared/components/Toast';
import { useConfirm } from '@/shared/components/Confirm';
import { useTreasuries, useTreasuryMutations } from '../hooks/useFinance';
import { TREASURY_TYPE_LABELS } from '../types/finance.types';
import { FinanceLayout } from '../components/FinanceLayout';
import { TransferTreasuryModal } from '../components/TransferTreasuryModal';
import { MaskedAmount } from '../components/MaskedAmount';
import { usePermissions } from '@/shared/hooks/usePermissions';
import type { Treasury, TreasuryType } from '../types/finance.types';

export default function TreasuriesPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('finance.manage');
  const { data: treasuries = [], isLoading } = useTreasuries();
  const toast = useToast();
  const confirm = useConfirm();
  const { create, update, remove } = useTreasuryMutations();
  const [showForm, setShowForm] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [editing, setEditing] = useState<Treasury | null>(null);
  const [form, setForm] = useState({ name: '', type: 'cash' as TreasuryType, notes: '' });

  const totalBalance = treasuries.reduce((s, t) => s + t.balance, 0);

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    try {
      if (editing) { await update.mutateAsync({ id: editing.id, data: form }); }
      else { await create.mutateAsync(form); }
      setShowForm(false); setEditing(null);
      setForm({ name: '', type: 'cash', notes: '' });
    } catch (err: any) { toast.error(err?.response?.data?.error?.message || 'حدث خطأ'); }
  };

  const handleEdit = (t: Treasury) => {
    setEditing(t); setForm({ name: t.name, type: t.type, notes: t.notes || '' }); setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm('حذف هذه الخزينة؟', { danger: true }))) return;
    try { await remove.mutateAsync(id); }
    catch (err: any) { toast.error(err?.response?.data?.error?.message || 'لا يمكن حذف خزينة بها رصيد'); }
  };

  return (
    <FinanceLayout>
      <div className="space-y-4">
        {/* Total */}
        <div className="bg-[#0E3B2E] rounded-2xl p-5 text-white">
          <p className="text-sm text-white/70">إجمالي رصيد الخزائن</p>
          <p className="text-3xl font-black mt-1">
            <MaskedAmount maskWidth="lg">{totalBalance.toLocaleString('ar-EG')} <span className="text-base font-normal">جنيه</span></MaskedAmount>
          </p>
          <p className="text-xs text-white/50 mt-2">{treasuries.length} خزينة نشطة</p>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {treasuries.map(t => (
              <div key={t.id} onClick={() => navigate(`/finance/treasuries/${t.id}`)}
                className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm cursor-pointer hover:border-[#0E3B2E]/30 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-gray-900">{t.name}</p>
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{TREASURY_TYPE_LABELS[t.type]}</span>
                  </div>
                  {canManage && (
                    <div className="flex gap-1">
                      <button onClick={(e) => { e.stopPropagation(); handleEdit(t); }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-400 transition-colors">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                      </button>
                    </div>
                  )}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-50">
                  <p className="text-2xl font-bold text-[#0E3B2E]"><MaskedAmount>{t.balance.toLocaleString('ar-EG')}</MaskedAmount></p>
                  <p className="text-xs text-gray-400">جنيه</p>
                </div>
                {!t.isActive && <span className="text-xs text-red-500 mt-2 block">غير نشطة</span>}
              </div>
            ))}
          </div>
        )}

        {/* Add + Transfer */}
        {canManage && (
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => { setEditing(null); setForm({ name: '', type: 'cash', notes: '' }); setShowForm(true); }}
              className="py-3 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 hover:border-[#0E3B2E] hover:text-[#0E3B2E] transition-colors text-sm font-medium">
              + إضافة خزينة جديدة
            </button>
            <button onClick={() => setShowTransfer(true)} disabled={treasuries.length < 2}
              className="py-3 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 hover:border-[#0E3B2E] hover:text-[#0E3B2E] transition-colors text-sm font-medium disabled:opacity-50 disabled:hover:border-gray-200 disabled:hover:text-gray-400">
              ⇄ تحويل بين الخزائن
            </button>
          </div>
        )}

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" dir="rtl">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-5 space-y-4">
              <h2 className="text-base font-bold text-gray-900">{editing ? 'تعديل الخزينة' : 'خزينة جديدة'}</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم الخزينة</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20" placeholder="مثال: درج السكرتيرة" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">النوع</label>
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as TreasuryType }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20">
                  {Object.entries(TREASURY_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات</label>
                <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20" placeholder="اختياري" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSubmit} disabled={create.isPending || update.isPending}
                  className="flex-1 bg-[#0E3B2E] text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-60">
                  {create.isPending || update.isPending ? '...' : 'حفظ'}
                </button>
                <button onClick={() => setShowForm(false)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm">إلغاء</button>
              </div>
            </div>
          </div>
        )}

        <TransferTreasuryModal
          open={showTransfer}
          onClose={() => setShowTransfer(false)}
          treasuries={treasuries}
        />
      </div>
    </FinanceLayout>
  );
}
