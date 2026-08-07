import { useState } from 'react';
import { useTenants, useToggleTenantActive } from '../hooks/useTenants';
import { usePlans } from '../hooks/usePlans';
import { TenantFormModal } from '../components/TenantFormModal';
import { Plus, Search, Power } from 'lucide-react';
import type { TenantDto } from '../types/tenant.types';

export default function TenantsPage() {
  const [search, setSearch] = useState('');
  const { data: tenants = [], isLoading } = useTenants(search || undefined);
  const { data: plans = [] } = usePlans();
  const toggleActive = useToggleTenantActive();
  const [modalOpen, setModalOpen] = useState(false);
  const [editTenant, setEditTenant] = useState<TenantDto | null>(null);

  const planMap = Object.fromEntries(plans.map((p) => [p.id, p]));

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">المراكز</h1>
          <p className="text-gray-500 text-sm mt-1">إدارة مراكز التعليم</p>
        </div>
        <button
          onClick={() => { setEditTenant(null); setModalOpen(true); }}
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800 transition-colors"
        >
          <Plus size={16} />
          مركز جديد
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-5 border-b border-gray-100">
          <div className="relative max-w-xs">
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
        ) : tenants.length === 0 ? (
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
              {tenants.map((tenant) => (
                <tr key={tenant.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-medium text-gray-900 text-sm">{tenant.name}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded" dir="ltr">
                      {tenant.slug}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700">
                    {planMap[tenant.planId]?.name ?? '—'}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${
                      tenant.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
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
                          tenant.isActive ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'
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
