import { useState } from 'react';
import { usePlans, useDeletePlan } from '../hooks/usePlans';
import { PlanFormModal } from '../components/PlanFormModal';
import { Plus, Pencil, Trash2, Users } from 'lucide-react';
import { useConfirm } from '@/shared/components/Confirm';
import type { PlanDto } from '../types/plan.types';

export default function PlansPage() {
  const { data: plans = [], isLoading } = usePlans();
  const confirm = useConfirm();
  const deletePlan = useDeletePlan();
  const [modalOpen, setModalOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<PlanDto | null>(null);

  const handleDelete = async (plan: PlanDto) => {
    if (!(await confirm(`هل تريد حذف خطة "${plan.name}"؟`, { danger: true }))) return;
    deletePlan.mutate(plan.id);
  };

  return (
    <div dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">الخطط</h1>
          <p className="text-gray-500 text-sm mt-1">إدارة خطط الاشتراك</p>
        </div>
        <button
          onClick={() => { setEditPlan(null); setModalOpen(true); }}
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800 transition-colors"
        >
          <Plus size={16} />
          خطة جديدة
        </button>
      </div>

      {isLoading ? (
        <div className="text-center text-gray-400 text-sm py-20">جاري التحميل...</div>
      ) : (
        <div className="grid grid-cols-3 gap-5">
          {plans.map((plan) => (
            <div key={plan.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-bold text-gray-900">{plan.name}</h3>
                  <span className="text-xs font-mono text-gray-400" dir="ltr">{plan.slug}</span>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => { setEditPlan(plan); setModalOpen(true); }}
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(plan)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-bold text-gray-900">
                    {plan.price === 0 ? 'مجاني' : `${plan.price}`}
                  </span>
                  {plan.price > 0 && <span className="text-gray-500 text-sm">ج.م / شهر</span>}
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Users size={14} />
                  <span>حتى {plan.maxStudents === 999999 ? 'غير محدود' : plan.maxStudents} طالب</span>
                </div>

                {Object.keys(plan.features).length > 0 && (
                  <div className="border-t pt-3 space-y-1.5">
                    {Object.entries(plan.features).map(([key, val]) => (
                      <div key={key} className="flex items-center gap-2 text-xs text-gray-600">
                        <span className={val ? 'text-green-500' : 'text-gray-300'}>
                          {val ? '✓' : '✗'}
                        </span>
                        <span>{key}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <PlanFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditPlan(null); }}
        plan={editPlan}
      />
    </div>
  );
}
