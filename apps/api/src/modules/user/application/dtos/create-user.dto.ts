import { z } from 'zod';
import { ROLE_VALUES } from '@nabgha/types';

export const CreateUserSchema = z.object({
  name: z.string().min(2, 'الاسم يجب أن يكون حرفين على الأقل'),
  email: z.string().email('البريد الإلكتروني غير صحيح').optional().nullable(),
  username: z.string()
    .min(3, 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل')
    .max(50, 'اسم المستخدم يجب أن لا يتجاوز 50 حرف')
    .regex(/^[a-zA-Z0-9_]+$/, 'اسم المستخدم يجب أن يحتوي على أحرف وأرقام فقط'),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
  role: z.enum(ROLE_VALUES as [string, ...string[]]),
  permissions: z.array(z.string()).default([]),
});

export type CreateUserDto = z.infer<typeof CreateUserSchema>;
