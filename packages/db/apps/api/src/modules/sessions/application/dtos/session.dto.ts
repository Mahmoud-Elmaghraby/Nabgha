import { z } from 'zod';

export const CreateSessionSchema = z.object({
  type: z.enum(['lesson', 'lesson_revision', 'lesson_exam', 'exam', 'grade_exam']),
  title: z.string().min(1, 'العنوان مطلوب'),
  groupId: z.string().uuid().optional(),
  grade: z.string().optional(),
  subjectId: z.string().uuid().optional(),
  outOf: z.number().int().positive().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'تاريخ غير صحيح'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  notes: z.string().optional(),
}).refine(data => {
  if (data.type === 'grade_exam') return !!data.grade && !!data.subjectId && !!data.endDate;
  return !!data.groupId;
}, { message: 'بيانات ناقصة حسب نوع الحصة' });

export const UpdateSessionSchema = z.object({
  title: z.string().min(1).optional(),
  outOf: z.number().int().positive().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  notes: z.string().optional(),
});

export const UpdateAttendanceSchema = z.object({
  status: z.enum(['present', 'absent', 'late']),
  degree: z.number().min(0).optional(),
  notes: z.string().optional(),
});

export const BulkUpdateAttendanceSchema = z.object({
  updates: z.array(z.object({
    studentId: z.string().uuid(),
    status: z.enum(['present', 'absent', 'late']),
    degree: z.number().min(0).optional(),
    notes: z.string().optional(),
  })),
});

export const ScanQrSchema = z.object({
  qrCode: z.string().min(1, 'QR code مطلوب'),
});

export const ListSessionsSchema = z.object({
  type: z.enum(['lesson', 'lesson_revision', 'lesson_exam', 'exam', 'grade_exam']).optional(),
  groupId: z.string().uuid().optional(),
  grade: z.string().optional(),
  status: z.enum(['scheduled', 'ongoing', 'completed', 'cancelled']).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateSessionDto = z.infer<typeof CreateSessionSchema>;
export type UpdateSessionDto = z.infer<typeof UpdateSessionSchema>;
export type UpdateAttendanceDto = z.infer<typeof UpdateAttendanceSchema>;
export type BulkUpdateAttendanceDto = z.infer<typeof BulkUpdateAttendanceSchema>;
export type ScanQrDto = z.infer<typeof ScanQrSchema>;
export type ListSessionsDto = z.infer<typeof ListSessionsSchema>;
