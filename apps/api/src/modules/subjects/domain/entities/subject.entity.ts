export class SubjectEntity {
  constructor(
    public readonly id: string,
    public name: string,
    public color: string,
    public isActive: boolean,
    public readonly createdAt: Date,
    public updatedAt: Date,
    public deletedAt: Date | null,
  ) {}

  update(data: { name?: string; color?: string; isActive?: boolean }): void {
    if (data.name !== undefined) this.name = data.name;
    if (data.color !== undefined) this.color = data.color;
    if (data.isActive !== undefined) this.isActive = data.isActive;
    this.updatedAt = new Date();
  }

  softDelete(): void {
    this.deletedAt = new Date();
    this.isActive = false;
    this.updatedAt = new Date();
  }
}
