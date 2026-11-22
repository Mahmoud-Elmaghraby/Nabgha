// مرآة لـ WaSettingsEntity (whatsapp/domain/entities/wa-settings.entity.ts)
// بس من غير حقول الحماية من الحظر (daily_limit/delay/warmup) — بوت تليجرام
// الرسمي (Bot API) مالوش مخاطر حظر زي واتساب Baileys غير الرسمي، فمحتاجناش
// أي من التعقيد ده. send_hours_from/to هنا "ساعات هدوء" اختيارية بس (UX)، مش حماية.

export class TelegramSettingsEntity {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public telegramEnabled: boolean,
    public sendHoursFrom: string,
    public sendHoursTo: string,
    public notifyAbsent: boolean,
    public notifyPresent: boolean,
    public notifyLate: boolean,
    public notify3Absences: boolean,
    public notifyPaymentConfirm: boolean,
    public notifyPaymentDue7d: boolean,
    public notifyPaymentDue1d: boolean,
    public notifyPaymentOverdue: boolean,
    public notifyNewStudent: boolean,
    public notifyGroupAdded: boolean,
    public notifyGroupRemoved: boolean,
    public notifyAbsenceExcused: boolean,
    public notifyGradeRecorded: boolean,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  isWithinSendHours(): boolean {
    const now = new Date();
    const egyptTimeStr = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Cairo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);

    const toMinutes = (t: string): number => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    const currentMin = toMinutes(egyptTimeStr);
    const fromMin = toMinutes(this.sendHoursFrom);
    const toMin = toMinutes(this.sendHoursTo);

    if (fromMin <= toMin) {
      return currentMin >= fromMin && currentMin < toMin;
    } else {
      return currentMin >= fromMin || currentMin < toMin;
    }
  }

  update(data: Partial<Omit<TelegramSettingsEntity, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>>): void {
    Object.assign(this, data);
    this.updatedAt = new Date();
  }
}
