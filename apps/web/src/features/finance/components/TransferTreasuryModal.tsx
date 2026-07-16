import { useEffect, useState } from 'react';
import { useToast } from '@/shared/components/Toast';
import { useTransferBetweenTreasuries } from '../hooks/useFinance';
import type { Treasury } from '../types/finance.types';

interface Props {
  open: boolean;
  onClose: () => void;
  treasuries: Treasury[];
  defaultFromTreasuryId?: string;
}

export function TransferTreasuryModal({ open, onClose, treasuries, defaultFromTreasuryId }: Props) {
  const toast = useToast();
  const transfer = useTransferBetweenTreasuries();
  const [fromTreasuryId, setFromTreasuryId] = useState(defaultFromTreasuryId || '');
  const [toTreasuryId, setToTreasuryId] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    setFromTreasuryId(defaultFromTreasuryId || '');
    setToTreasuryId('');
    setAmount('');
    setNotes('');
  }, [open, defaultFromTreasuryId]);

  if (!open) return null;

  const fromTreasury = treasuries.find(t => t.id === fromTreasuryId);
  const amountNumber = Number(amount);
  const isValid =
    !!fromTreasuryId && !!toTreasuryId && fromTreasuryId !== toTreasuryId &&
    amountNumber > 0 && (!fromTreasury || amountNumber <= fromTreasury.balance);

  const handleSubmit = async () => {
    if (!isValid) return;
    try {
      await transfer.mutateAsync({
        fromTreasuryId, toTreasuryId, amount: amountNumber,
        notes: notes.trim() || undefined,
      });
      toast.success('تم التحويل بنجاح');
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'حدث خطأ أثناء التحويل');
    }
  };

  const inputClass = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20';

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" dir="rtl">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-5 space-y-4">
        <h2 className="text-base font-bold text-gray-900">تحويل بين الخزائن</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">من خزينة</label>
          <select value={fromTreasuryId} onChange={e => setFromTreasuryId(e.target.value)} className={inputClass}>
            <option value="">اختر الخزينة</option>
            {treasuries.map(t => (
              <option key={t.id} value={t.id}>{t.name} — {t.balance.toLocaleString('ar-EG')} ج.م</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">إلى خزينة</label>
          <select value={toTreasuryId} onChange={e => setToTreasuryId(e.target.value)} className={inputClass}>
            <option value="">اختر الخزينة</option>
            {treasuries.filter(t => t.id !== fromTreasuryId).map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ</label>
          <input type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)}
            className={inputClass} placeholder="0.00" dir="ltr" />
          {fromTreasury && amountNumber > fromTreasury.balance && (
            <p className="text-xs text-red-500 mt-1">المبلغ أكبر من رصيد الخزينة ({fromTreasury.balance.toLocaleString('ar-EG')} ج.م)</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} className={inputClass} placeholder="اختياري" />
        </div>

        <div className="flex gap-2">
          <button onClick={handleSubmit} disabled={!isValid || transfer.isPending}
            className="flex-1 bg-[#0E3B2E] text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-60">
            {transfer.isPending ? '...' : 'تحويل'}
          </button>
          <button onClick={onClose} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm">إلغاء</button>
        </div>
      </div>
    </div>
  );
}
