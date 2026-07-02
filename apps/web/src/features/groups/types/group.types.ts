export type DayOfWeek = 'saturday' | 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday';

export interface ScheduleItem {
  day: DayOfWeek;
  startTime: string;
  endTime: string;
}

export interface GroupDto {
  id: string;
  name: string;
  subjectGradeId: string | null;
  teacherId: string | null;
  maxStudents: number;
  schedule: ScheduleItem[];
  isActive: boolean;
  studentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface GroupStudentDto {
  id: string;
  groupId: string;
  studentId: string;
  discount: number;
  joinedAt: string;
  leftAt: string | null;
  fullName: string;
  parentPhone: string;
  studentPhone: string | null;
  grade: string | null;
  isActive: boolean;
}

export interface CreateGroupPayload {
  name: string;
  subjectGradeId: string;
  teacherId: string;
  maxStudents: number;
  schedule: ScheduleItem[];
}

export interface UpdateGroupPayload {
  name?: string;
  subjectGradeId?: string;
  teacherId?: string;
  maxStudents?: number;
  schedule?: ScheduleItem[];
  isActive?: boolean;
}

export interface AddStudentPayload {
  studentId: string;
  discount: number;
}

export interface PaginatedGroups {
  data: GroupDto[];
  total: number;
  page: number;
  limit: number;
}

export interface ListGroupsParams {
  search?: string;
  teacherId?: string;
  subjectGradeId?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export const DAY_LABELS: Record<DayOfWeek, string> = {
  saturday: 'السبت',
  sunday: 'الأحد',
  monday: 'الاثنين',
  tuesday: 'الثلاثاء',
  wednesday: 'الأربعاء',
  thursday: 'الخميس',
  friday: 'الجمعة',
};

export const DAY_ORDER: DayOfWeek[] = [
  'saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday',
];
