// مرآة لـ WaInboundMessageEntity — فرق مهم: entityId هنا بيتملى فورًا وقت
// الاستقبال (مش null) لأن الربط بـ telegram_links عن طريق chat_id دقيق
// ومباشر، عكس مطابقة رقم تليفون الواتساب اللي محتاجة مطابقة يدوية لاحقة.

export class TelegramInboundMessageEntity {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly chatId: string,
    public readonly body: string,
    public readonly entityType: string | null,
    public readonly entityId: string | null,
    public isRead: boolean,
    public readonly receivedAt: Date,
    public readonly createdAt: Date,
  ) {}

  markRead(): void {
    this.isRead = true;
  }
}
