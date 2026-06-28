export class StudentEntity {
  constructor(
    public readonly id: string,
    public fullName: string,
    public parentPhone: string,
    public studentPhone: string | null,
    public dateOfBirth: Date | null,
    public grade: string | null,
    public notes: string | null,
    public readonly qrCode: string,
    public readonly studentCode: string | null,
    public isActive: boolean,
    public readonly createdAt: Date,
    public updatedAt: Date,
    public deletedAt: Date | null,
  ) {}

  update(data: Partial<Pick<StudentEntity,
    'fullName' | 'parentPhone' | 'studentPhone' |
    'dateOfBirth' | 'grade' | 'notes' | 'isActive'
  >>): void {
    Object.assign(this, data);
    this.updatedAt = new Date();
  }

  softDelete(): void {
    this.deletedAt = new Date();
    this.isActive = false;
    this.updatedAt = new Date();
  }
}
