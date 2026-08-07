export type PaymentType = 'monthly' | 'per_session' | 'termly';

export class SubjectGradeEntity {
  constructor(
    public readonly id: string,
    public readonly subjectId: string,
    public grade: string,
    public fee: number,
    public paymentType: PaymentType,
    public sessionDuration: number,
    public isActive: boolean,
    public readonly createdAt: Date,
    public updatedAt: Date,
    public deletedAt: Date | null,
  ) {}

  update(data: {
    fee?: number;
    paymentType?: PaymentType;
    sessionDuration?: number;
    isActive?: boolean;
  }): void {
    if (data.fee !== undefined) this.fee = data.fee;
    if (data.paymentType !== undefined) this.paymentType = data.paymentType;
    if (data.sessionDuration !== undefined) this.sessionDuration = data.sessionDuration;
    if (data.isActive !== undefined) this.isActive = data.isActive;
    this.updatedAt = new Date();
  }

  softDelete(): void {
    this.deletedAt = new Date();
    this.isActive = false;
    this.updatedAt = new Date();
  }

  get effectiveFee(): number {
    return this.fee;
  }
}
