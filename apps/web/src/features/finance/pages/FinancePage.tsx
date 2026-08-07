import { useFinanceStats, useTreasuries } from '../hooks/useFinance';
import { FinanceLayout } from '../components/FinanceLayout';
import { useNavigate } from 'react-router-dom';

const getCurrentMonth = () => new Date().toISOString().slice(0, 7);

export default function FinancePage() {
  const month = getCurrentMonth();
  const { data: stats } = useFinanceStats(month);
  const { data: treasuries = [] } = useTreasuries();
  const navigate = useNavigate();
  const totalBalance = treasuries.reduce((s, t) => s + t.balance, 0);

  return (
    <FinanceLayout>
      <div className="space-y-4">
        {/* Month */}
        <p className="text-sm text-gray-400 font-medium">
          {new Date().toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}
        </p>

        {/* Main Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#0E3B2E] rounded-2xl p-5 text-white col-span-2">
            <p className="text-sm text-white/70">إجمالي رصيد الخزائن</p>
            <p className="text-3xl font-black mt-1">{totalBalance.toLocaleString('ar-EG')} <span className="text-base font-normal">جنيه</span></p>
          </div>
          <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
            <p className="text-xs text-emerald-600 font-medium">محصّل الشهر</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{(stats?.totalCollected ?? 0).toLocaleString('ar-EG')}</p>
            <p className="text-xs text-emerald-500 mt-0.5">جنيه</p>
          </div>
          <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
            <p className="text-xs text-red-600 font-medium">متبقي الشهر</p>
            <p className="text-2xl font-bold text-red-700 mt-1">{(stats?.totalPending ?? 0).toLocaleString('ar-EG')}</p>
            <p className="text-xs text-red-500 mt-0.5">جنيه</p>
          </div>
        </div>

        {/* Progress */}
        {stats && stats.totalDues > 0 && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm font-medium text-gray-700">نسبة التحصيل</p>
              <p className="text-sm font-bold text-[#0E3B2E]">
                {Math.round((stats.totalCollected / stats.totalDues) * 100)}%
              </p>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-[#0E3B2E] rounded-full transition-all"
                style={{ width: `${Math.min(100, Math.round((stats.totalCollected / stats.totalDues) * 100))}%` }} />
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-400">
              <span>{stats.paidCount} مدفوع</span>
              <span>{stats.unpaidCount} غير مدفوع</span>
            </div>
          </div>
        )}

        {/* Expenses */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <div className="flex justify-between items-center">
            <p className="text-sm font-medium text-gray-700">مصروفات الشهر</p>
            <p className="text-sm font-bold text-red-600">{(stats?.totalExpenses ?? 0).toLocaleString('ar-EG')} ج</p>
          </div>
          <div className="flex justify-between mt-1">
            <p className="text-xs text-gray-400">صافي الربح</p>
            <p className="text-xs font-bold text-gray-700">
              {((stats?.totalCollected ?? 0) - (stats?.totalExpenses ?? 0)).toLocaleString('ar-EG')} ج
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'الفواتير', path: '/finance/dues', icon: '📋', color: 'bg-blue-50 text-blue-700' },
            { label: 'الإيصالات', path: '/finance/payments', icon: '💰', color: 'bg-emerald-50 text-emerald-700' },
            { label: 'المصروفات', path: '/finance/expenses', icon: '📤', color: 'bg-red-50 text-red-700' },
            { label: 'الخزائن', path: '/finance/treasuries', icon: '🏦', color: 'bg-amber-50 text-amber-700' },
          ].map(item => (
            <button key={item.path} onClick={() => navigate(item.path)}
              className={`${item.color} rounded-2xl p-4 text-right border border-current/10`}>
              <p className="text-2xl mb-2">{item.icon}</p>
              <p className="text-sm font-bold">{item.label}</p>
            </button>
          ))}
        </div>
      </div>
    </FinanceLayout>
  );
}
