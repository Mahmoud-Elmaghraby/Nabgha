import { z } from 'zod';

export const CreateStudentSchema = z.object({
  fullName: z.string().min(2, 'الاسم يجب أن يكون حرفين على الأقل').max(255),
  parentPhone: z.string().min(7, 'رقم الهاتف غير صحيح').max(20),
  studentPhone: z.string().max(20).optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  grade: z.string().max(100).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const UpdateStudentSchema = z.object({
  fullName: z.string().min(2).max(255).optional(),
  parentPhone: z.string().min(7).max(20).optional(),
  studentPhone: z.string().max(20).optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  grade: z.string().max(100).optional().nullable(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const ListStudentsSchema = z.object({
  search: z.string().optional(),
  grade: z.string().optional(),
  isActive: z.string().transform((v) => v === 'true').optional(),
  page: z.string().transform(Number).optional(),
  limit: z.string().transform(Number).optional(),
});

export type CreateStudentDto = z.infer<typeof CreateStudentSchema>;
export type UpdateStudentDto = z.infer<typeof UpdateStudentSchema>;
export type ListStudentsDto = z.infer<typeof ListStudentsSchema>;
