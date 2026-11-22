export type SessionType = 'lesson' | 'lesson_revision' | 'lesson_exam' | 'exam' | 'grade_exam';
export type SessionStatus = 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
export type AttendanceStatus = 'present' | 'absent' | 'late';

export class AttendanceEntity {
  constructor(
    public readonly id: string,
    public readonly sessionId: string,
    public readonly studentId: string,
    public status: AttendanceStatus,
    public degree: number | null,
    public scannedAt: Date | null,
    public notes: string | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
    // joined fields
    public readonly studentName?: string,
    public readonly studentCode?: string,
    public readonly studentPhone?: string,
    public readonly parentPhone?: string,
  ) {}

  markPresent(scannedAt?: Date): void {
    this.status = 'present';
    this.scannedAt = scannedAt ?? new Date();
    this.updatedAt = new Date();
  }

  markAbsent(): void {
    this.status = 'absent';
    this.updatedAt = new Date();
  }

  markLate(): void {
    this.status = 'late';
    this.updatedAt = new Date();
  }

  setDegree(degree: number): void {
    this.degree = degree;
    this.updatedAt = new Date();
  }
}

export class SessionEntity {
  constructor(
    public readonly id: string,
    public type: SessionType,
    public groupId: string | null,
    public grade: string | null,
    public subjectId: string | null,
    public title: string,
    public outOf: number | null,
    public startDate: Date,
    public endDate: Date | null,
    public startTime: string | null,
    public endTime: string | null,
    public status: SessionStatus,
    public imageUrl: string | null,
    public notes: string | null,
    public readonly createdBy: string | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
    public deletedAt: Date | null,
    // joined fields
    public readonly groupName?: string,
    public readonly subjectName?: string,
    public readonly teacherName?: string,
    public attendanceCount?: { present: number; absent: number; late: number; total: number },
  ) {}

  get isGradeExam(): boolean { return this.type === 'grade_exam'; }
  get hasGrades(): boolean { return ['lesson_revision', 'lesson_exam', 'exam', 'grade_exam'].includes(this.type); }
  get hasImage(): boolean { return ['lesson_revision', 'lesson_exam', 'exam', 'grade_exam'].includes(this.type); }
  get isActive(): boolean { return this.status === 'ongoing'; }
  get isOpen(): boolean { return ['scheduled', 'ongoing'].includes(this.status); }

  start(): void {
    this.status = 'ongoing';
    this.updatedAt = new Date();
  }

  complete(): void {
    this.status = 'completed';
    this.updatedAt = new Date();
  }

  cancel(): void {
    this.status = 'cancelled';
    this.updatedAt = new Date();
  }

  update(data: Partial<{
    title: string;
    outOf: number;
    startDate: Date;
    endDate: Date;
    startTime: string;
    endTime: string;
    notes: string;
    imageUrl: string;
  }>): void {
    Object.assign(this, data);
    this.updatedAt = new Date();
  }

  softDelete(): void {
    this.deletedAt = new Date();
    this.updatedAt = new Date();
  }
}
