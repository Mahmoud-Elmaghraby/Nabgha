import { z } from 'zod';

const ScheduleItemSchema = z.object({
  day: z.enum(['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday']),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'صيغة الوقت غير صحيحة HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'صيغة الوقت غير صحيحة HH:MM'),
}).refine(d => d.startTime < d.endTime, 'وقت البداية يجب أن يكون قبل وقت النهاية');

export const CreateGroupSchema = z.object({
  name: z.string().min(2, 'اسم المجموعة يجب أن يكون حرفين على الأقل').max(255),
  subjectGradeId: z.string().uuid('معرف الصف غير صحيح').nullable().optional(),
  teacherId: z.string().uuid('معرف المدرس غير صحيح').nullable().optional(),
  maxStudents: z.number().int().min(1).max(200).default(30),
  schedule: z.array(ScheduleItemSchema).default([]),
});

export const UpdateGroupSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  subjectGradeId: z.string().uuid().nullable().optional(),
  teacherId: z.string().uuid().nullable().optional(),
  maxStudents: z.number().int().min(1).max(200).optional(),
  schedule: z.array(ScheduleItemSchema).optional(),
  isActive: z.boolean().optional(),
});

export const ListGroupsSchema = z.object({
  search: z.string().optional(),
  teacherId: z.string().uuid().optional(),
  subjectGradeId: z.string().uuid().optional(),
  isActive: z.string().transform(v => v === 'true').optional(),
  page: z.string().transform(Number).optional(),
  limit: z.string().transform(Number).optional(),
});

export const AddStudentToGroupSchema = z.object({
  studentId: z.string().uuid('معرف الطالب غير صحيح'),
  discount: z.number().min(0, 'الخصم لا يمكن أن يكون سالباً').default(0),
});

export const UpdateStudentDiscountSchema = z.object({
  discount: z.number().min(0, 'الخصم لا يمكن أن يكون سالباً'),
});

export type CreateGroupDto = z.infer<typeof CreateGroupSchema>;
export type UpdateGroupDto = z.infer<typeof UpdateGroupSchema>;
export type ListGroupsDto = z.infer<typeof ListGroupsSchema>;
export type AddStudentToGroupDto = z.infer<typeof AddStudentToGroupSchema>;
export type UpdateStudentDiscountDto = z.infer<typeof UpdateStudentDiscountSchema>;
