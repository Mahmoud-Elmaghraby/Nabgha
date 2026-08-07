import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCreateTeacher, useUpdateTeacher } from '../hooks/useTeacherMutations';
import type { TeacherDto } from '../types/teacher.types';

const FormSchema = z.object({
  name: z.string().min(2, 'الاسم يجب أن يكون حرفين على الأقل'),
  phone: z.string().optional().or(z.literal('')),
  phone2: z.string().optional().or(z.literal('')),
  email: z.string().email('البريد الإلكتروني غير صحيح').optional().or(z.literal('')),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof FormSchema>;

interface TeacherFormModalProps {
  open: boolean;
  onClose: () => void;
  teacher?: TeacherDto | null;
}

export function TeacherFormModal({ open, onClose, teacher }: TeacherFormModalProps) {
  const isEdit = !!teacher;
  const { mutate: create, isPending: isCreating } = useCreateTeacher();
  const { mutate: update, isPending: isUpdating } = useUpdateTeacher();
  const isPending = isCreating || isUpdating;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(FormSchema) });

  useEffect(() => {
    if (!open) return;
    if (teacher) {
      reset({ name: teacher.name, phone: teacher.phone || '', phone2: teacher.phone2 || '', email: teacher.email || '', notes: teacher.notes || '' });
    } else {
      reset({ name: '', phone: '', phone2: '', email: '', notes: '' });
    }
  }, [open, teacher, reset]);

  const onSubmit = (data: FormValues) => {
    const payload = {
      name: data.name,
      phone: data.phone || null,
      phone2: data.phone2 || null,
      email: data.email || null,
      notes: data.notes || null,
    };
    if (isEdit && teacher) {
      update({ id: teacher.id, payload }, { onSuccess: onClose });
    } else {
      create(payload, { onSuccess: onClose });
    }
  };

  const inputClass =
    'w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20 focus:border-[#0E3B2E] focus:bg-white transition-all';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-white rounded-2xl shadow-xl border-0 p-6" dir="rtl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-gray-900">
            {isEdit ? 'تعديل مدرس' : 'إضافة مدرس جديد'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">الاسم الكامل</label>
            <input {...register('name')} className={inputClass} placeholder="أحمد محمد" />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                رقم الهاتف <span className="text-gray-400 font-normal">(اختياري)</span>
              </label>
              <input {...register('phone')} className={inputClass} placeholder="01234567890" dir="ltr" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                رقم هاتف إضافي <span className="text-gray-400 font-normal">(اختياري)</span>
              </label>
              <input {...register('phone2')} className={inputClass} placeholder="01234567890" dir="ltr" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              البريد الإلكتروني <span className="text-gray-400 font-normal">(اختياري)</span>
            </label>
            <input {...register('email')} type="email" className={inputClass} placeholder="ahmed@example.com" dir="ltr" />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              ملاحظات <span className="text-gray-400 font-normal">(اختياري)</span>
            </label>
            <textarea {...register('notes')} rows={3} className={`${inputClass} resize-none`} placeholder="أي ملاحظات..." />
          </div>

          <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-medium border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors">
              إلغاء
            </button>
            <button type="submit" disabled={isPending} className="px-5 py-2.5 text-sm font-semibold bg-[#0E3B2E] text-white rounded-xl hover:bg-[#1F6B4E] disabled:bg-gray-300 transition-colors">
              {isPending ? 'جاري الحفظ...' : isEdit ? 'حفظ التعديلات' : 'إضافة المدرس'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
