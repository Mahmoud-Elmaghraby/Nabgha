export type WaBulkJobStatus = 'pending' | 'running' | 'completed' | 'cancelled' | 'failed';

export class WaBulkJobEntity {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly title: string,
    public readonly body: string,
    public status: WaBulkJobStatus,
    public total: number,
    public sent: number,
    public failed: number,
    public queued: number,
    public readonly createdBy: string,
    public scheduledAt: Date | null,
    public startedAt: Date | null,
    public completedAt: Date | null,
    public cancelledAt: Date | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  get progress(): number {
    if (this.total === 0) return 0;
    return Math.round(((this.sent + this.failed) / this.total) * 100);
  }

  get isActive(): boolean {
    return this.status === 'running' || this.status === 'pending';
  }

  start(): void {
    this.status = 'running';
    this.startedAt = new Date();
    this.updatedAt = new Date();
  }

  incrementSent(): void {
    this.sent += 1;
    this.queued = Math.max(0, this.queued - 1);
    this.updatedAt = new Date();
    this.checkCompletion();
  }

  incrementFailed(): void {
    this.failed += 1;
    this.queued = Math.max(0, this.queued - 1);
    this.updatedAt = new Date();
    this.checkCompletion();
  }

  cancel(): void {
    this.status = 'cancelled';
    this.cancelledAt = new Date();
    this.updatedAt = new Date();
  }

  private checkCompletion(): void {
    if (this.sent + this.failed >= this.total) {
      this.status = 'completed';
      this.completedAt = new Date();
    }
  }
}
