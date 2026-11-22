import { z } from 'zod';

export const CreateSubjectSchema = z.object({
  name: z.string().min(1, 'اسم المادة مطلوب').max(255),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'لون غير صحيح').optional(),
});

export const UpdateSubjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  isActive: z.boolean().optional(),
});

export const CreateSubjectGradeSchema = z.object({
  grade: z.string().min(1, 'الصف مطلوب').max(100),
  fee: z.number().min(0, 'السعر لا يمكن أن يكون سالباً'),
  paymentType: z.enum(['monthly', 'per_session', 'termly']),
  sessionDuration: z.number().min(15, 'أقل مدة 15 دقيقة').max(480, 'أقصى مدة 8 ساعات'),
});

export const UpdateSubjectGradeSchema = z.object({
  fee: z.number().min(0).optional(),
  paymentType: z.enum(['monthly', 'per_session', 'termly']).optional(),
  sessionDuration: z.number().min(15).max(480).optional(),
  isActive: z.boolean().optional(),
});

export type CreateSubjectDto = z.infer<typeof CreateSubjectSchema>;
export type UpdateSubjectDto = z.infer<typeof UpdateSubjectSchema>;
export type CreateSubjectGradeDto = z.infer<typeof CreateSubjectGradeSchema>;
export type UpdateSubjectGradeDto = z.infer<typeof UpdateSubjectGradeSchema>;
