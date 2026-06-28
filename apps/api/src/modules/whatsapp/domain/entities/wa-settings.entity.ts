export class WaSettingsEntity {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public waEnabled: boolean,
    public sendHoursFrom: string,
    public sendHoursTo: string,
    public dailyLimit: number,
    public delayMinSeconds: number,
    public delayMaxSeconds: number,
    public warmupEnabled: boolean,
    public notifyAbsent: boolean,
    public notifyPresent: boolean,
    public notifyLate: boolean,
    public notify3Absences: boolean,
    public lateThresholdMin: number,
    public notifyPaymentConfirm: boolean,
    public notifyPaymentDue7d: boolean,
    public notifyPaymentDue1d: boolean,
    public notifyPaymentOverdue: boolean,
    public notifyNewStudent: boolean,
    public notifyGroupAdded: boolean,
    public notifyGroupRemoved: boolean,
    public notifyStudentCard: boolean,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  get effectiveDailyLimit(): number {
    return this.dailyLimit;
  }

  isWithinSendHours(): boolean {
    const now = new Date();
    const egyptTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Cairo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);
    return egyptTime >= this.sendHoursFrom && egyptTime < this.sendHoursTo;
  }

  update(data: Partial<Omit<WaSettingsEntity, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>>): void {
    Object.assign(this, data);
    this.updatedAt = new Date();
  }
}
