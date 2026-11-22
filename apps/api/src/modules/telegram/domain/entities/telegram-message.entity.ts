// مرآة مبسّطة لـ WaMessageEntity — سجل الرسايل الصادرة عبر تليجرام (للتتبع
// والتاريخ)، من غير حقول retry/delivered الخاصة بتعقيد الواتساب.

export type TelegramMessageStatus = 'pending' | 'sent' | 'failed';

export class TelegramMessageEntity {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly chatId: string,
    public readonly entityType: string,
    public readonly entityId: string,
    public readonly templateKey: string | null,
    public readonly body: string,
    public status: TelegramMessageStatus,
    public errorMessage: string | null,
    public sentAt: Date | null,
    public readonly createdAt: Date,
  ) {}

  markSent(): void {
    this.status = 'sent';
    this.sentAt = new Date();
  }

  markFailed(error: string): void {
    this.status = 'failed';
    this.errorMessage = error;
  }
}
