import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreatePlan, useUpdatePlan } from '../hooks/usePlans';
import type { PlanDto } from '../types/plan.types';

const CreateSchema = z.object({
  name: z.string().min(2, 'اسم الخطة مطلوب'),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'حروف إنجليزية صغيرة وأرقام وشرطة فقط'),
  maxStudents: z.coerce.number().int().min(1, 'عدد الطلاب مطلوب'),
  price: z.coerce.number().min(0).default(0),
});

const UpdateSchema = z.object({
  name: z.string().min(2, 'اسم الخطة مطلوب'),
  maxStudents: z.coerce.number().int().min(1, 'عدد الطلاب مطلوب'),
  price: z.coerce.number().min(0),
});

type CreateForm = z.infer<typeof CreateSchema>;
type UpdateForm = z.infer<typeof UpdateSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  plan?: PlanDto | null;
}

export function PlanFormModal({ open, onClose, plan }: Props) {
  const isEdit = !!plan;
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();

  const createForm = useForm<CreateForm>({ resolver: zodResolver(CreateSchema) });
  const updateForm = useForm<UpdateForm>({ resolver: zodResolver(UpdateSchema) });

  useEffect(() => {
    if (plan) {
      updateForm.reset({ name: plan.name, maxStudents: plan.maxStudents, price: plan.price });
    } else {
      createForm.reset();
    }
  }, [plan, open]);

  const onCreateSubmit = (data: CreateForm) => {
    createPlan.mutate(data, { onSuccess: onClose });
  };

  const onUpdateSubmit = (data: UpdateForm) => {
    if (!plan) return;
    updatePlan.mutate({ id: plan.id, payload: data }, { onSuccess: onClose });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm bg-white shadow-xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "تعديل الخطة" : "إضافة خطة جديدة"}</DialogTitle>
        </DialogHeader>

        {isEdit ? (
          <form onSubmit={updateForm.handleSubmit(onUpdateSubmit)} className="space-y-4">
            <div>
              <Label>اسم الخطة</Label>
              <Input {...updateForm.register("name")} className="mt-1" />
              {updateForm.formState.errors.name && (
                <p className="text-red-500 text-xs mt-1">{updateForm.formState.errors.name.message}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>عدد الطلاب</Label>
                <Input {...updateForm.register("maxStudents")} type="number" className="mt-1" />
                {updateForm.formState.errors.maxStudents && (
                  <p className="text-red-500 text-xs mt-1">{updateForm.formState.errors.maxStudents.message}</p>
                )}
              </div>
              <div>
                <Label>السعر (ج.م)</Label>
                <Input {...updateForm.register("price")} type="number" className="mt-1" />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
              <Button type="submit" disabled={updatePlan.isPending}>
                {updatePlan.isPending ? "جاري الحفظ..." : "حفظ"}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>اسم الخطة</Label>
                <Input {...createForm.register("name")} className="mt-1" placeholder="Pro" />
                {createForm.formState.errors.name && (
                  <p className="text-red-500 text-xs mt-1">{createForm.formState.errors.name.message}</p>
                )}
              </div>
              <div>
                <Label>الـ Slug</Label>
                <Input {...createForm.register("slug")} className="mt-1" placeholder="pro" dir="ltr" />
                {createForm.formState.errors.slug && (
                  <p className="text-red-500 text-xs mt-1">{createForm.formState.errors.slug.message}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>عدد الطلاب</Label>
                <Input {...createForm.register("maxStudents")} type="number" className="mt-1" placeholder="500" />
                {createForm.formState.errors.maxStudents && (
                  <p className="text-red-500 text-xs mt-1">{createForm.formState.errors.maxStudents.message}</p>
                )}
              </div>
              <div>
                <Label>السعر (ج.م)</Label>
                <Input {...createForm.register("price")} type="number" className="mt-1" placeholder="0" />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
              <Button type="submit" disabled={createPlan.isPending}>
                {createPlan.isPending ? "جاري الإنشاء..." : "إنشاء الخطة"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
