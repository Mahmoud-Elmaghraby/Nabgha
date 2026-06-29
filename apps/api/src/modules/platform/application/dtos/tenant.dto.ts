import { z } from 'zod';

export const CreateTenantSchema = z.object({
  name: z.string().min(2, 'اسم المركز مطلوب'),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'الـ slug يقبل حروف إنجليزية صغيرة وأرقام وشرطة فقط'),
  planId: z.string().uuid('خطة غير صحيحة'),
  adminUsername: z.string().min(3, 'اسم المستخدم مطلوب'),
  adminPassword: z.string().min(6, 'كلمة المرور 6 أحرف على الأقل'),
  adminName: z.string().min(2, 'الاسم مطلوب'),
});

export const UpdateTenantSchema = z.object({
  name: z.string().min(2).optional(),
  planId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
  limits: z.record(z.any()).optional(),
});

export type CreateTenantDto = z.infer<typeof CreateTenantSchema>;
export type UpdateTenantDto = z.infer<typeof UpdateTenantSchema>;
