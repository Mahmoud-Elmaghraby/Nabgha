export class TeacherEntity {
  constructor(
    public readonly id: string,
    public name: string,
    public phone: string | null,
    public phone2: string | null,
    public email: string | null,
    public subjectIds: string[],
    public notes: string | null,
    public isActive: boolean,
    public readonly createdAt: Date,
    public updatedAt: Date,
    public deletedAt: Date | null,
  ) {}

  update(data: Partial<Pick<TeacherEntity, 'name' | 'phone' | 'phone2' | 'email' | 'subjectIds' | 'notes' | 'isActive'>>): void {
    Object.assign(this, data);
    this.updatedAt = new Date();
  }

  softDelete(): void {
    this.deletedAt = new Date();
    this.isActive = false;
    this.updatedAt = new Date();
  }
}
