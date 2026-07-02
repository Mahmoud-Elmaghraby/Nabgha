import { z } from 'zod';

export const CreateStudentSchema = z.object({
  fullName: z.string().trim().min(2, 'الاسم يجب أن يكون حرفين على الأقل').max(255),
  parentPhone: z.string().trim().min(7, 'رقم هاتف ولي الأمر غير صحيح').max(20),
  studentPhone: z.string().trim().min(7, 'رقم هاتف الطالب غير صحيح').max(20),
  dateOfBirth: z.string().optional().nullable(),
  grade: z.string().min(1, 'المرحلة الدراسية مطلوبة').max(100),
  address: z.string().trim().max(1000).optional().nullable(),
  school: z.string().trim().max(255).optional().nullable(),
  parentOccupation: z.string().trim().max(255).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const UpdateStudentSchema = z.object({
  fullName: z.string().trim().min(2).max(255).optional(),
  parentPhone: z.string().trim().min(7).max(20).optional(),
  studentPhone: z.string().trim().min(7).max(20).optional(),
  dateOfBirth: z.string().optional().nullable(),
  grade: z.string().min(1).max(100).optional(),
  address: z.string().trim().max(1000).optional().nullable(),
  school: z.string().trim().max(255).optional().nullable(),
  parentOccupation: z.string().trim().max(255).optional().nullable(),
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
