import { z } from 'zod';

export const UpdateSettingsSchema = z.object({
  waEnabled: z.boolean().optional(),
  sendHoursFrom: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  sendHoursTo: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  dailyLimit: z.number().int().min(10).max(500).optional(),
  delayMinSeconds: z.number().int().min(1).max(30).optional(),
  delayMaxSeconds: z.number().int().min(1).max(60).optional(),
  warmupEnabled: z.boolean().optional(),
  notifyAbsent: z.boolean().optional(),
  notifyPresent: z.boolean().optional(),
  notifyLate: z.boolean().optional(),
  notify3Absences: z.boolean().optional(),
  lateThresholdMin: z.number().int().min(5).max(60).optional(),
  notifyPaymentConfirm: z.boolean().optional(),
  notifyPaymentDue7d: z.boolean().optional(),
  notifyPaymentDue1d: z.boolean().optional(),
  notifyPaymentOverdue: z.boolean().optional(),
  notifyNewStudent: z.boolean().optional(),
  notifyGroupAdded: z.boolean().optional(),
  notifyGroupRemoved: z.boolean().optional(),
  notifyStudentCard: z.boolean().optional(),
}).refine((data) => {
  if (data.delayMinSeconds !== undefined && data.delayMaxSeconds !== undefined) {
    return data.delayMinSeconds <= data.delayMaxSeconds;
  }
  return true;
}, { message: 'delayMinSeconds يجب أن يكون أصغر من أو يساوي delayMaxSeconds' });

export const UpdateTemplateSchema = z.object({
  body: z.string().min(5).max(1000),
});

export const SendBulkSchema = z.object({
  title: z.string().min(1).max(255),
  body: z.string().min(1).max(1000),
  phones: z.array(z.string().min(10).max(20)).min(1).max(500),
  scheduledAt: z.string().datetime().optional(),
});

export const ResolveAudienceSchema = z.object({
  type: z.enum(['all', 'group', 'subjectGrade', 'grade', 'teacher']),
  groupId: z.string().uuid().optional(),
  subjectGradeId: z.string().uuid().optional(),
  grade: z.string().optional(),
  teacherId: z.string().uuid().optional(),
}).refine((data) => {
  if (data.type === 'group') return !!data.groupId;
  if (data.type === 'subjectGrade') return !!data.subjectGradeId;
  if (data.type === 'grade') return !!data.grade;
  if (data.type === 'teacher') return !!data.teacherId;
  return true;
}, { message: 'بيانات ناقصة حسب نوع الجمهور المختار' });

export const SendTestSchema = z.object({
  phone: z.string().min(10).max(20),
  templateKey: z.string().min(1),
});

export type UpdateSettingsDto = z.infer<typeof UpdateSettingsSchema>;
export type UpdateTemplateDto = z.infer<typeof UpdateTemplateSchema>;
export type SendBulkDto = z.infer<typeof SendBulkSchema>;
export type SendTestDto = z.infer<typeof SendTestSchema>;
export type ResolveAudienceDto = z.infer<typeof ResolveAudienceSchema>;
