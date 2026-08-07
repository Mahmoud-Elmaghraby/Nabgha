import { z } from 'zod';

export const CreateTeacherSchema = z.object({
  name: z.string().min(2, 'الاسم يجب أن يكون حرفين على الأقل').max(255),
  phone: z.string().max(20).optional().nullable(),
  phone2: z.string().max(20).optional().nullable(),
  email: z.string().email('البريد الإلكتروني غير صحيح').optional().nullable(),
  subjectIds: z.array(z.string().uuid()).default([]),
  notes: z.string().optional().nullable(),
});

export const UpdateTeacherSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  phone: z.string().max(20).optional().nullable(),
  phone2: z.string().max(20).optional().nullable(),
  email: z.string().email().optional().nullable(),
  subjectIds: z.array(z.string().uuid()).optional(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export type CreateTeacherDto = z.infer<typeof CreateTeacherSchema>;
export type UpdateTeacherDto = z.infer<typeof UpdateTeacherSchema>;
