import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useCreateTenant, useUpdateTenant } from '../hooks/useTenants';
import { usePlans } from '../hooks/usePlans';
import type { TenantDto } from '../types/tenant.types';

const CreateSchema = z.object({
  name: z.string().min(2, 'اسم المركز مطلوب'),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'حروف إنجليزية صغيرة وأرقام وشرطة فقط'),
  planId: z.string().min(1, 'اختر الخطة'),
  adminUsername: z.string().min(3, 'اسم المستخدم مطلوب'),
  adminPassword: z.string().min(6, 'كلمة المرور 6 أحرف على الأقل'),
  adminName: z.string().min(2, 'اسم المدير مطلوب'),
});

const UpdateSchema = z.object({
  name: z.string().min(2, 'اسم المركز مطلوب'),
  planId: z.string().min(1, 'اختر الخطة'),
});

type CreateForm = z.infer<typeof CreateSchema>;
type UpdateForm = z.infer<typeof UpdateSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  tenant?: TenantDto | null;
}

export function TenantFormModal({ open, onClose, tenant }: Props) {
  const isEdit = !!tenant;
  const { data: plans = [] } = usePlans();
  const createTenant = useCreateTenant();
  const updateTenant = useUpdateTenant();

  const createForm = useForm<CreateForm>({ resolver: zodResolver(CreateSchema) });
  const updateForm = useForm<UpdateForm>({ resolver: zodResolver(UpdateSchema) });

  useEffect(() => {
    if (tenant) {
      updateForm.reset({ name: tenant.name, planId: tenant.planId });
    } else {
      createForm.reset();
    }
  }, [tenant, open]);

  const onCreateSubmit = (data: CreateForm) => {
    createTenant.mutate(data, { onSuccess: onClose });
  };

  const onUpdateSubmit = (data: UpdateForm) => {
    if (!tenant) return;
    updateTenant.mutate({ id: tenant.id, payload: data }, { onSuccess: onClose });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-white shadow-xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "تعديل المركز" : "إضافة مركز جديد"}</DialogTitle>
        </DialogHeader>

        {isEdit ? (
          <form onSubmit={updateForm.handleSubmit(onUpdateSubmit)} className="space-y-4">
            <div>
              <Label>اسم المركز</Label>
              <Input {...updateForm.register("name")} className="mt-1" />
              {updateForm.formState.errors.name && (
                <p className="text-red-500 text-xs mt-1">{updateForm.formState.errors.name.message}</p>
              )}
            </div>
            <div>
              <Label>الخطة</Label>
              <select {...updateForm.register("planId")} className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                <option value="">اختر الخطة</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} — {p.price === 0 ? "مجاني" : `${p.price} ج.م`}</option>
                ))}
              </select>
              {updateForm.formState.errors.planId && (
                <p className="text-red-500 text-xs mt-1">{updateForm.formState.errors.planId.message}</p>
              )}
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
              <Button type="submit" disabled={updateTenant.isPending}>
                {updateTenant.isPending ? "جاري الحفظ..." : "حفظ"}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>اسم المركز</Label>
                <Input {...createForm.register("name")} className="mt-1" placeholder="مركز النجاح" />
                {createForm.formState.errors.name && (
                  <p className="text-red-500 text-xs mt-1">{createForm.formState.errors.name.message}</p>
                )}
              </div>
              <div>
                <Label>الـ Slug</Label>
                <Input {...createForm.register("slug")} className="mt-1" placeholder="al-najah" dir="ltr" />
                {createForm.formState.errors.slug && (
                  <p className="text-red-500 text-xs mt-1">{createForm.formState.errors.slug.message}</p>
                )}
              </div>
            </div>
            <div>
              <Label>الخطة</Label>
              <select {...createForm.register("planId")} className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                <option value="">اختر الخطة</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} — {p.price === 0 ? "مجاني" : `${p.price} ج.م`}</option>
                ))}
              </select>
              {createForm.formState.errors.planId && (
                <p className="text-red-500 text-xs mt-1">{createForm.formState.errors.planId.message}</p>
              )}
            </div>
            <div className="border-t pt-3">
              <p className="text-xs text-gray-500 mb-3">بيانات المدير</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>الاسم</Label>
                  <Input {...createForm.register("adminName")} className="mt-1" placeholder="محمد علي" />
                  {createForm.formState.errors.adminName && (
                    <p className="text-red-500 text-xs mt-1">{createForm.formState.errors.adminName.message}</p>
                  )}
                </div>
                <div>
                  <Label>اسم المستخدم</Label>
                  <Input {...createForm.register("adminUsername")} className="mt-1" placeholder="admin" dir="ltr" />
                  {createForm.formState.errors.adminUsername && (
                    <p className="text-red-500 text-xs mt-1">{createForm.formState.errors.adminUsername.message}</p>
                  )}
                </div>
              </div>
              <div className="mt-3">
                <Label>كلمة المرور</Label>
                <Input {...createForm.register("adminPassword")} type="password" className="mt-1" placeholder="••••••••" />
                {createForm.formState.errors.adminPassword && (
                  <p className="text-red-500 text-xs mt-1">{createForm.formState.errors.adminPassword.message}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
              <Button type="submit" disabled={createTenant.isPending}>
                {createTenant.isPending ? "جاري الإنشاء..." : "إنشاء المركز"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
