export { GRADE_OPTIONS, type Grade } from '@nabgha/types';

export interface StudentDto {
  id: string;
  fullName: string;
  parentPhone: string;
  studentPhone: string | null;
  dateOfBirth: string | null;
  grade: string | null;
  notes: string | null;
  qrCode: string;
  studentCode: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStudentPayload {
  fullName: string;
  parentPhone: string;
  studentPhone?: string | null;
  dateOfBirth?: string | null;
  grade?: string | null;
  notes?: string | null;
}

export interface UpdateStudentPayload {
  fullName?: string;
  parentPhone?: string;
  studentPhone?: string | null;
  dateOfBirth?: string | null;
  grade?: string | null;
  notes?: string | null;
  isActive?: boolean;
}

export interface PaginatedStudents {
  data: StudentDto[];
  total: number;
  page: number;
  limit: number;
}

export interface ListStudentsParams {
  search?: string;
  grade?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface StudentGroupDto {
  enrollmentId: string;
  discount: number;
  joinedAt: string;
  groupId: string;
  groupName: string;
  subjectGradeId: string | null;
  teacherId: string | null;
  maxStudents: number;
  schedule: Array<{
    day: string;
    startTime: string;
    endTime: string;
  }>;
  isActive: boolean;
}
