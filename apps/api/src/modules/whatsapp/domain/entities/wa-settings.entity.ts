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
    public notifyAbsenceExcused: boolean,
    public notifyGradeRecorded: boolean,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  get effectiveDailyLimit(): number {
    return this.dailyLimit;
  }

  isWithinSendHours(): boolean {
    const now = new Date();
    const egyptTimeStr = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Cairo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);

    // تحويل "HH:MM" لعدد دقائق من منتصف الليل لمقارنة دقيقة
    const toMinutes = (t: string): number => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    const currentMin = toMinutes(egyptTimeStr);
    const fromMin = toMinutes(this.sendHoursFrom);
    const toMin = toMinutes(this.sendHoursTo);

    if (fromMin <= toMin) {
      // نطاق عادي: مثلاً 08:00 → 22:00
      return currentMin >= fromMin && currentMin < toMin;
    } else {
      // نطاق يمتد لفجر اليوم التالي: مثلاً 22:00 → 02:00
      return currentMin >= fromMin || currentMin < toMin;
    }
  }

  update(data: Partial<Omit<WaSettingsEntity, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>>): void {
    Object.assign(this, data);
    this.updatedAt = new Date();
  }
}
