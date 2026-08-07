import { useState } from 'react';
import { usePlatformStats, useTenants, useToggleTenantActive } from '../hooks/useTenants';
import { usePlans } from '../hooks/usePlans';
import { TenantFormModal } from '../components/TenantFormModal';
import { Building2, Users, CheckCircle, XCircle, Plus, Search, Power } from 'lucide-react';
import type { TenantDto } from '../types/tenant.types';

export default function PlatformDashboardPage() {
  const { data: stats } = usePlatformStats();
  const { data: tenants = [], isLoading } = useTenants();
  const { data: plans = [] } = usePlans();
  const toggleActive = useToggleTenantActive();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTenant, setEditTenant] = useState<TenantDto | null>(null);

  const planMap = Object.fromEntries(plans.map((p) => [p.id, p]));

  const filtered = tenants.filter(
    (t) =>
      t.name.includes(search) || t.slug.includes(search)
  );

  return (
    <div dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">لوحة التحكم</h1>
          <p className="text-gray-500 text-sm mt-1">إدارة مراكز نبغة</p>
        </div>
        <button
          onClick={() => { setEditTenant(null); setModalOpen(true); }}
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800 transition-colors"
        >
          <Plus size={16} />
          مركز جديد
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'إجمالي المراكز', value: stats?.total ?? 0, icon: Building2, color: 'text-blue-600 bg-blue-50' },
          { label: 'المراكز النشطة', value: stats?.active ?? 0, icon: CheckCircle, color: 'text-green-600 bg-green-50' },
          { label: 'المراكز المعطلة', value: stats?.inactive ?? 0, icon: XCircle, color: 'text-red-600 bg-red-50' },
          { label: 'الخطط المتاحة', value: stats?.plans ?? 0, icon: Users, color: 'text-purple-600 bg-purple-50' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${s.color}`}>
              <s.icon size={20} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-gray-500 text-sm mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tenants Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-5 border-b border-gray-100 flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث عن مركز..."
              className="w-full border border-gray-200 rounded-lg pr-9 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-gray-400 text-sm">جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">لا توجد مراكز</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-right text-xs font-medium text-gray-500 px-5 py-3">المركز</th>
                <th className="text-right text-xs font-medium text-gray-500 px-5 py-3">الـ Slug</th>
                <th className="text-right text-xs font-medium text-gray-500 px-5 py-3">الخطة</th>
                <th className="text-right text-xs font-medium text-gray-500 px-5 py-3">الحالة</th>
                <th className="text-right text-xs font-medium text-gray-500 px-5 py-3">تاريخ الإنشاء</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((tenant) => (
                <tr key={tenant.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-medium text-gray-900 text-sm">{tenant.name}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded" dir="ltr">
                      {tenant.slug}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm text-gray-700">
                      {planMap[tenant.planId]?.name ?? '—'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${
                      tenant.isActive
                        ? 'bg-green-50 text-green-700'
                        : 'bg-red-50 text-red-700'
                    }`}>
                      {tenant.isActive ? 'نشط' : 'معطل'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-500">
                    {new Date(tenant.createdAt).toLocaleDateString('ar-EG')}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => { setEditTenant(tenant); setModalOpen(true); }}
                        className="text-xs text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                      >
                        تعديل
                      </button>
                      <button
                        onClick={() => toggleActive.mutate(tenant.id)}
                        disabled={toggleActive.isPending}
                        className={`text-xs px-2 py-1 rounded flex items-center gap-1 transition-colors ${
                          tenant.isActive
                            ? 'text-red-600 hover:bg-red-50'
                            : 'text-green-600 hover:bg-green-50'
                        }`}
                      >
                        <Power size={12} />
                        {tenant.isActive ? 'تعطيل' : 'تفعيل'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <TenantFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTenant(null); }}
        tenant={editTenant}
      />
    </div>
  );
}
