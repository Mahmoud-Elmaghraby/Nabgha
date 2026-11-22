import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTreasuryDetail, useTreasuries } from '../hooks/useFinance';
import { usePermissions } from '@/shared/hooks/usePermissions';
import { TREASURY_TYPE_LABELS, TRANSACTION_TYPE_LABELS } from '../types/finance.types';
import { TransferTreasuryModal } from '../components/TransferTreasuryModal';
import { MaskedAmount } from '../components/MaskedAmount';
import { FinancePrivacyToggle } from '../components/FinancePrivacyToggle';

export default function TreasuryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('finance.manage');
  const { data, isLoading } = useTreasuryDetail(id!);
  const { data: treasuries = [] } = useTreasuries();
  const [showTransfer, setShowTransfer] = useState(false);

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-gray-400">جاري التحميل...</div>
    </div>
  );

  if (!data) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400">الخزينة غير موجودة</p>
    </div>
  );

  const { treasury, transactions, summary } = data;

  return (
    <div className="min-h-screen bg-[#F7F7F7]" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 md:px-6 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/finance/treasuries')}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">{treasury.name}</h1>
            <p className="text-xs text-gray-400">{TREASURY_TYPE_LABELS[treasury.type]}</p>
          </div>
          <FinancePrivacyToggle />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">

        {/* بطاقة الرصيد */}
        <div className="bg-[#0E3B2E] rounded-2xl p-5 text-white">
          <p className="text-sm text-white/70">الرصيد الحالي</p>
          <p className="text-3xl font-black mt-1">
            <MaskedAmount maskWidth="lg">{treasury.balance.toLocaleString('ar-EG')} <span className="text-base font-normal">جنيه</span></MaskedAmount>
          </p>
          {!treasury.isActive && <span className="text-xs text-red-300 mt-2 block">غير نشطة</span>}
          {canManage && (
            <button onClick={() => setShowTransfer(true)}
              className="mt-4 flex items-center gap-1.5 px-3 py-2 text-sm bg-white/10 hover:bg-white/20 rounded-xl transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              تحويل إلى خزينة أخرى
            </button>
          )}
        </div>

        {/* إحصائيات */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
            <p className="text-xs text-emerald-600 mb-1">إجمالي الإيرادات</p>
            <p className="text-base font-bold text-emerald-700"><MaskedAmount maskWidth="sm">{summary.totalIncome.toLocaleString('ar-EG')}</MaskedAmount></p>
          </div>
          <div className="bg-red-50 rounded-xl p-3 text-center border border-red-100">
            <p className="text-xs text-red-500 mb-1">إجمالي المصروفات</p>
            <p className="text-base font-bold text-red-600"><MaskedAmount maskWidth="sm">{summary.totalExpenses.toLocaleString('ar-EG')}</MaskedAmount></p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
            <p className="text-xs text-blue-600 mb-1">تحويلات واردة</p>
            <p className="text-base font-bold text-blue-700"><MaskedAmount maskWidth="sm">{summary.totalTransfersIn.toLocaleString('ar-EG')}</MaskedAmount></p>
          </div>
          <div className="bg-purple-50 rounded-xl p-3 text-center border border-purple-100">
            <p className="text-xs text-purple-600 mb-1">تحويلات صادرة</p>
            <p className="text-base font-bold text-purple-700"><MaskedAmount maskWidth="sm">{summary.totalTransfersOut.toLocaleString('ar-EG')}</MaskedAmount></p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-200">
            <p className="text-xs text-gray-500 mb-1">إيصالات ملغاة</p>
            <p className="text-base font-bold text-gray-600"><MaskedAmount maskWidth="sm">{summary.totalCancellations.toLocaleString('ar-EG')}</MaskedAmount></p>
          </div>
          <div className="bg-orange-50 rounded-xl p-3 text-center border border-orange-100">
            <p className="text-xs text-orange-600 mb-1">مبالغ مسترجعة</p>
            <p className="text-base font-bold text-orange-700"><MaskedAmount maskWidth="sm">{summary.totalRefunds.toLocaleString('ar-EG')}</MaskedAmount></p>
          </div>
        </div>

        {/* سجل الحركات */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-700">سجل الحركات ({transactions.length})</p>
          </div>
          <div className="p-4">
            {transactions.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">لا يوجد حركات على هذه الخزينة</p>
            ) : (
              <div className="space-y-2">
                {transactions.map(tx => {
                  const isCredit = tx.type === 'income' || tx.type === 'transfer_in';
                  return (
                    <div key={tx.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded-full border ${TRANSACTION_TYPE_LABELS[tx.type]?.class}`}>
                            {TRANSACTION_TYPE_LABELS[tx.type]?.label}
                          </span>
                          {tx.relatedTreasuryName && (
                            <span className="text-xs text-gray-400">
                              {tx.type === 'transfer_out' ? `إلى ${tx.relatedTreasuryName}` : `من ${tx.relatedTreasuryName}`}
                            </span>
                          )}
                        </div>
                        {tx.notes && <p className="text-xs text-gray-400 mt-1 truncate">{tx.notes}</p>}
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(tx.createdAt).toLocaleString('ar-EG')}
                        </p>
                      </div>
                      <div className="text-left shrink-0 mr-2">
                        <p className={`text-sm font-bold ${isCredit ? 'text-emerald-700' : 'text-red-600'}`}>
                          {isCredit ? '+' : '−'}{tx.amount.toLocaleString('ar-EG')} ج
                        </p>
                        <p className="text-xs text-gray-400">رصيد: <MaskedAmount maskWidth="sm">{tx.balanceAfter.toLocaleString('ar-EG')}</MaskedAmount></p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <TransferTreasuryModal
        open={showTransfer}
        onClose={() => setShowTransfer(false)}
        treasuries={treasuries}
        defaultFromTreasuryId={treasury.id}
      />
    </div>
  );
}
