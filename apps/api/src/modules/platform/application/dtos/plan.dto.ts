import { z } from 'zod';

export const CreatePlanSchema = z.object({
  name: z.string().min(2, 'اسم الخطة مطلوب'),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'الـ slug يقبل حروف إنجليزية صغيرة وأرقام وشرطة فقط'),
  maxStudents: z.number().int().min(1, 'عدد الطلاب مطلوب'),
  price: z.number().min(0).default(0),
  features: z.record(z.any()).default({}),
});

export const UpdatePlanSchema = z.object({
  name: z.string().min(2).optional(),
  maxStudents: z.number().int().min(1).optional(),
  price: z.number().min(0).optional(),
  features: z.record(z.any()).optional(),
});

export type CreatePlanDto = z.infer<typeof CreatePlanSchema>;
export type UpdatePlanDto = z.infer<typeof UpdatePlanSchema>;
