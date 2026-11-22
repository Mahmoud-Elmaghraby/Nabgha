export class PlanEntity {
  constructor(
    public readonly id: string,
    public name: string,
    public slug: string,
    public maxStudents: number,
    public price: number,
    public features: Record<string, any>,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  update(data: Partial<Pick<PlanEntity, 'name' | 'maxStudents' | 'price' | 'features'>>): void {
    Object.assign(this, data);
    this.updatedAt = new Date();
  }
}
