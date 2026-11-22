export class TenantEntity {
  constructor(
    public readonly id: string,
    public name: string,
    public slug: string,
    public planId: string,
    public isActive: boolean,
    public schemaName: string,
    public limits: Record<string, any>,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  update(data: Partial<Pick<TenantEntity, 'name' | 'planId' | 'isActive' | 'limits'>>): void {
    Object.assign(this, data);
    this.updatedAt = new Date();
  }

  deactivate(): void {
    this.isActive = false;
    this.updatedAt = new Date();
  }

  activate(): void {
    this.isActive = true;
    this.updatedAt = new Date();
  }
}
