export class WaInboundMessageEntity {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly phone: string,
    public readonly body: string,
    public studentId: string | null,
    public isRead: boolean,
    public readonly receivedAt: Date,
    public readonly createdAt: Date,
  ) {}

  markRead(): void {
    this.isRead = true;
  }

  linkStudent(studentId: string): void {
    this.studentId = studentId;
  }

  get intentType(): 'confirm' | 'excuse' | 'question' | 'other' {
    const text = this.body.trim().toLowerCase();
    if (['تأكيد', 'اوك', 'ok', 'okay', 'نعم', 'ايوه', 'موافق'].some(w => text.includes(w))) return 'confirm';
    if (['عذر', 'مريض', 'غياب', 'مش هيجي', 'مش جاي'].some(w => text.includes(w))) return 'excuse';
    if (['؟', '?', 'كام', 'امتى', 'ازاي', 'فين'].some(w => text.includes(w))) return 'question';
    return 'other';
  }
}
