import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useStudentMutations } from '../hooks/useStudents';
import { GRADE_OPTIONS } from '@nabgha/types';
import type { StudentDto } from '../types/student.types';

const FormSchema = z.object({
  fullName: z.string().min(2, 'الاسم يجب أن يكون حرفين على الأقل'),
  parentPhone: z.string().min(7, 'رقم الهاتف غير صحيح'),
  studentPhone: z.string().optional().or(z.literal('')),
  dateOfBirth: z.string().optional().or(z.literal('')),
  grade: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof FormSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  student?: StudentDto | null;
}

export function StudentFormModal({ open, onClose, student }: Props) {
  const isEdit = !!student;
  const { createStudent, updateStudent } = useStudentMutations();
  const isPending = createStudent.isPending || updateStudent.isPending;

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
  });

  useEffect(() => {
    if (!open) return;
    if (student) {
      reset({
        fullName: student.fullName,
        parentPhone: student.parentPhone,
        studentPhone: student.studentPhone || '',
        dateOfBirth: student.dateOfBirth ? student.dateOfBirth.split('T')[0] : '',
        grade: student.grade || '',
        notes: student.notes || '',
      });
    } else {
      reset({ fullName: '', parentPhone: '', studentPhone: '', dateOfBirth: '', grade: '', notes: '' });
    }
  }, [open, student, reset]);

  const onSubmit = (data: FormValues) => {
    const payload = {
      fullName: data.fullName,
      parentPhone: data.parentPhone,
      studentPhone: data.studentPhone || null,
      dateOfBirth: data.dateOfBirth || null,
      grade: data.grade || null,
      notes: data.notes || null,
    };
    if (isEdit && student) {
      updateStudent.mutate({ id: student.id, data: payload }, { onSuccess: onClose });
    } else {
      createStudent.mutate(payload, { onSuccess: onClose });
    }
  };

  const inputClass = 'w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20 focus:border-[#0E3B2E] focus:bg-white transition-all';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-white rounded-2xl shadow-xl border-0 p-6" dir="rtl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-gray-900">
            {isEdit ? 'تعديل بيانات الطالب' : 'إضافة طالب جديد'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">الاسم الكامل *</label>
            <input {...register('fullName')} className={inputClass} placeholder="محمد أحمد" />
            {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">هاتف ولي الأمر *</label>
              <input {...register('parentPhone')} className={inputClass} placeholder="01234567890" dir="ltr" />
              {errors.parentPhone && <p className="text-red-500 text-xs mt-1">{errors.parentPhone.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                هاتف الطالب <span className="text-gray-400 font-normal">(اختياري)</span>
              </label>
              <input {...register('studentPhone')} className={inputClass} placeholder="01234567890" dir="ltr" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">المرحلة الدراسية</label>
              <select {...register('grade')} className={inputClass}>
                <option value="">اختر المرحلة</option>
                {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                تاريخ الميلاد <span className="text-gray-400 font-normal">(اختياري)</span>
              </label>
              <input {...register('dateOfBirth')} type="date" className={inputClass} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              ملاحظات <span className="text-gray-400 font-normal">(اختياري)</span>
            </label>
            <textarea
              {...register('notes')}
              rows={2}
              className={`${inputClass} resize-none`}
              placeholder="أي ملاحظات..."
            />
          </div>

          <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-medium border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors">
              إلغاء
            </button>
            <button type="submit" disabled={isPending} className="px-5 py-2.5 text-sm font-semibold bg-[#0E3B2E] text-white rounded-xl hover:bg-[#1F6B4E] disabled:opacity-50 transition-colors">
              {isPending ? 'جاري الحفظ...' : isEdit ? 'حفظ التعديلات' : 'إضافة الطالب'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
