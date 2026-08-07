import { z } from 'zod';

export const UpdateCenterSettingsSchema = z.object({
  centerName: z.string().min(1).max(255).optional(),
  centerLogoUrl: z.string().nullable().optional(),
  centerPhone: z.string().max(20).nullable().optional(),
  centerPhone2: z.string().max(20).nullable().optional(),
  centerAddress: z.string().max(500).nullable().optional(),
  currency: z.string().max(10).optional(),
  currencySymbol: z.string().max(5).optional(),
  academicYear: z.string().max(20).nullable().optional(),
});

export type UpdateCenterSettingsDto = z.infer<typeof UpdateCenterSettingsSchema>;
