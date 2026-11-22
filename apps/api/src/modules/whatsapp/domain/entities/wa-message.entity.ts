export type WaMessageStatus = 'pending' | 'sent' | 'delivered' | 'failed';

export class WaMessageEntity {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly phone: string,
    public readonly templateKey: string | null,
    public readonly body: string,
    public status: WaMessageStatus,
    public errorMessage: string | null,
    public sentAt: Date | null,
    public deliveredAt: Date | null,
    public readonly bulkJobId: string | null,
    public readonly createdAt: Date,
    public retryCount: number = 0,
  ) {}

  markSent(): void {
    this.status = 'sent';
    this.sentAt = new Date();
  }

  markDelivered(): void {
    this.status = 'delivered';
    this.deliveredAt = new Date();
  }

  markFailed(error: string): void {
    this.status = 'failed';
    this.errorMessage = error;
  }
}

