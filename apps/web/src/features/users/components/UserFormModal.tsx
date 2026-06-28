import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UserPermissions } from './UserPermissions';
import { useCreateUser, useUpdateUser } from '../hooks/useUserMutations';
import type { UserDto } from '../types/user.types';
import { ROLES, DEFAULT_ROLE_PERMISSIONS } from '@nabgha/types';

const FormSchema = z.object({
  name: z.string().min(2, 'الاسم يجب أن يكون حرفين على الأقل'),
  email: z.string().email('البريد الإلكتروني غير صحيح').optional().or(z.literal('')),
  username: z.string().optional(),
  password: z.string().optional(),
  role: z.string().min(1, 'الدور مطلوب'),
});

type FormValues = z.infer<typeof FormSchema>;

const SERVER_ERROR_MESSAGES: Record<string, string> = {
  USERNAME_ALREADY_EXISTS: 'اسم المستخدم مستخدم بالفعل، اختر اسماً آخر',
  VALIDATION_ERROR: 'تأكد من صحة البيانات المدخلة',
};

interface UserFormModalProps {
  open: boolean;
  onClose: () => void;
  user?: UserDto | null;
}

export function UserFormModal({ open, onClose, user }: UserFormModalProps) {
  const isEdit = !!user;
  const [permissions, setPermissions] = useState<string[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);

  const { mutate: createUser, isPending: isCreating } = useCreateUser();
  const { mutate: updateUser, isPending: isUpdating } = useUpdateUser();
  const isPending = isCreating || isUpdating;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
  });

  const selectedRole = watch('role');

  // إعادة تهيئة الفورم عند الفتح
  useEffect(() => {
    if (!open) return;
    setServerError(null);
    if (user) {
      reset({ name: user.name, email: user.email || '', role: user.role, username: '', password: '' });
      setPermissions(user.permissions);
    } else {
      reset({ name: '', username: '', password: '', email: '', role: 'teacher' });
      setPermissions(DEFAULT_ROLE_PERMISSIONS['teacher']);
    }
  }, [open, user, reset]);

  // تحديث الصلاحيات الافتراضية عند تغيير الدور (في الإضافة والتعديل)
  const [lastRole, setLastRole] = useState<string | null>(null);
  useEffect(() => {
    if (!open || !selectedRole) return;
    // أول تحميل: مانعملش reset للصلاحيات
    if (lastRole === null) {
      setLastRole(selectedRole);
      return;
    }
    // المستخدم غيّر الدور فعلاً
    if (selectedRole !== lastRole) {
      setPermissions(DEFAULT_ROLE_PERMISSIONS[selectedRole as keyof typeof DEFAULT_ROLE_PERMISSIONS] || []);
      setLastRole(selectedRole);
    }
  }, [selectedRole, open, lastRole]);

  useEffect(() => {
    if (!open) setLastRole(null);
  }, [open]);

  const handleServerError = (error: any) => {
    const code = error?.response?.data?.error?.code;
    if (code === 'USERNAME_ALREADY_EXISTS') {
      setError('username', { message: 'اسم المستخدم مستخدم بالفعل' });
    }
    setServerError(SERVER_ERROR_MESSAGES[code] || 'حدث خطأ، حاول مرة أخرى');
  };

  const onSubmit = (data: FormValues) => {
    setServerError(null);

    // تحقق يدوي من الحقول الإلزامية في الإضافة
    if (!isEdit) {
      if (!data.username || data.username.length < 3) {
        setError('username', { message: 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل' });
        return;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(data.username)) {
        setError('username', { message: 'أحرف إنجليزية وأرقام فقط' });
        return;
      }
      if (!data.password || data.password.length < 6) {
        setError('password', { message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
        return;
      }
    }

    if (isEdit && user) {
      updateUser(
        { id: user.id, payload: { name: data.name, email: data.email || null, role: data.role, permissions } },
        { onSuccess: onClose, onError: handleServerError },
      );
    } else {
      createUser(
        {
          name: data.name,
          username: data.username!,
          password: data.password!,
          email: data.email || null,
          role: data.role,
          permissions,
        },
        { onSuccess: onClose, onError: handleServerError },
      );
    }
  };

  const inputClass =
    'w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/20 focus:border-[#0E3B2E] focus:bg-white transition-all';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-xl border-0 p-6" dir="rtl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-gray-900">
            {isEdit ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'}
          </DialogTitle>
        </DialogHeader>

        {serverError && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-2">
          {/* بيانات المستخدم */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">الاسم الكامل</label>
              <input {...register('name')} className={inputClass} placeholder="أحمد محمد" />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                البريد الإلكتروني <span className="text-gray-400 font-normal">(اختياري)</span>
              </label>
              <input {...register('email')} type="email" className={inputClass} placeholder="ahmed@example.com" />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            {!isEdit && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">اسم المستخدم</label>
                  <input {...register('username')} className={inputClass} placeholder="ahmed123" autoComplete="off" />
                  {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">كلمة المرور</label>
                  <input {...register('password')} type="password" className={inputClass} placeholder="••••••" autoComplete="new-password" />
                  {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
                </div>
              </>
            )}

            <div className="col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">الدور</label>
              <select {...register('role')} className={inputClass}>
                {ROLES.filter((r) => r.value !== 'parent').map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <p className="text-gray-400 text-xs mt-1">الدور يحدد الصلاحيات الافتراضية، ويمكنك تعديلها بالأسفل</p>
            </div>
          </div>

          {/* فاصل */}
          <div className="border-t border-gray-100" />

          {/* الصلاحيات */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">الصلاحيات</label>
            <UserPermissions value={permissions} onChange={setPermissions} />
          </div>

          {/* الأزرار */}
          <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2.5 text-sm font-semibold bg-[#0E3B2E] text-white rounded-xl hover:bg-[#1F6B4E] disabled:bg-gray-300 transition-colors"
            >
              {isPending ? 'جاري الحفظ...' : isEdit ? 'حفظ التعديلات' : 'إضافة المستخدم'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
