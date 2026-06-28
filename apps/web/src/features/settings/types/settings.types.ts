export interface CenterSettingsDto {
  id: string;
  centerName: string;
  centerLogoUrl: string | null;
  centerPhone: string | null;
  centerAddress: string | null;
  currency: string;
  currencySymbol: string;
  academicYear: string | null;
}

export type UpdateCenterSettingsPayload = Partial<Omit<CenterSettingsDto, 'id'>>;
