export class CenterSettingsEntity {
  constructor(
    public readonly id: string,
    public centerName: string,
    public centerLogoUrl: string | null,
    public centerPhone: string | null,
    public centerAddress: string | null,
    public currency: string,
    public currencySymbol: string,
    public academicYear: string | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  update(data: Partial<Omit<CenterSettingsEntity, 'id' | 'createdAt' | 'updatedAt'>>): void {
    Object.assign(this, data);
    this.updatedAt = new Date();
  }
}
