export interface StudentProps {
  id: string;
  fullName: string;
  parentPhone: string;
  studentPhone: string | null;
  dateOfBirth: Date | null;
  grade: string | null;
  address: string | null;
  school: string | null;
  parentOccupation: string | null;
  notes: string | null;
  qrCode: string;
  studentCode: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export class StudentEntity {
  readonly id: string;
  fullName: string;
  parentPhone: string;
  studentPhone: string | null;
  dateOfBirth: Date | null;
  grade: string | null;
  address: string | null;
  school: string | null;
  parentOccupation: string | null;
  notes: string | null;
  readonly qrCode: string;
  readonly studentCode: string | null;
  isActive: boolean;
  readonly createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;

  constructor(props: StudentProps) {
    this.id = props.id;
    this.fullName = props.fullName;
    this.parentPhone = props.parentPhone;
    this.studentPhone = props.studentPhone;
    this.dateOfBirth = props.dateOfBirth;
    this.grade = props.grade;
    this.address = props.address;
    this.school = props.school;
    this.parentOccupation = props.parentOccupation;
    this.notes = props.notes;
    this.qrCode = props.qrCode;
    this.studentCode = props.studentCode;
    this.isActive = props.isActive;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.deletedAt = props.deletedAt;
  }

  update(data: Partial<Pick<StudentEntity,
    'fullName' | 'parentPhone' | 'studentPhone' |
    'dateOfBirth' | 'grade' | 'address' | 'school' |
    'parentOccupation' | 'notes' | 'isActive'
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
