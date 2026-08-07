export interface ScheduleItem {
  day: 'saturday' | 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday';
  startTime: string;
  endTime: string;
}

export class GroupEntity {
  constructor(
    public readonly id: string,
    public name: string,
    public subjectGradeId: string | null,
    public teacherId: string | null,
    public maxStudents: number,
    public schedule: ScheduleItem[],
    public isActive: boolean,
    public readonly createdAt: Date,
    public updatedAt: Date,
    public deletedAt: Date | null,
    public studentCount: number = 0,
    public subjectGradeLabel: string | null = null,
  ) {}

  update(data: {
    name?: string;
    subjectGradeId?: string | null;
    teacherId?: string | null;
    maxStudents?: number;
    schedule?: ScheduleItem[];
    isActive?: boolean;
  }): void {
    if (data.name !== undefined) this.name = data.name;
    if (data.subjectGradeId !== undefined) this.subjectGradeId = data.subjectGradeId;
    if (data.teacherId !== undefined) this.teacherId = data.teacherId;
    if (data.maxStudents !== undefined) this.maxStudents = data.maxStudents;
    if (data.schedule !== undefined) this.schedule = data.schedule;
    if (data.isActive !== undefined) this.isActive = data.isActive;
    this.updatedAt = new Date();
  }

  softDelete(): void {
    this.deletedAt = new Date();
    this.isActive = false;
    this.updatedAt = new Date();
  }

  get isFull(): boolean {
    return this.studentCount >= this.maxStudents;
  }
}

export class GroupStudentEntity {
  constructor(
    public readonly id: string,
    public readonly groupId: string,
    public readonly studentId: string,
    public discount: number,
    public readonly joinedAt: Date,
    public leftAt: Date | null,
  ) {}

  leave(): void {
    this.leftAt = new Date();
  }

  updateDiscount(discount: number): void {
    this.discount = discount;
  }
}
