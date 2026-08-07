import type { UserRole } from './permissions';

export interface ApiResponse<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    path: string;
    timestamp: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// ===== Auth =====
export interface LoginRequest {
  slug: string;
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string; name: string; username: string; role: UserRole; };
}

export interface PlatformLoginRequest {
  email: string;
  password: string;
}

// ===== Users =====
export interface UserDto {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

// ===== Subjects =====
export interface SubjectDto {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
  grades: SubjectGradeDto[];
  createdAt: string;
}

export interface SubjectGradeDto {
  id: string;
  subjectId: string;
  grade: string;
  fee: number;
  paymentType: 'monthly' | 'per_session' | 'termly';
  sessionDuration: number;
  isActive: boolean;
}

export interface CreateSubjectRequest {
  name: string;
  color?: string;
}

export interface UpdateSubjectRequest {
  name?: string;
  color?: string;
  isActive?: boolean;
}

export interface CreateSubjectGradeRequest {
  grade: string;
  fee: number;
  paymentType: 'monthly' | 'per_session' | 'termly';
  sessionDuration: number;
}

export interface UpdateSubjectGradeRequest {
  fee?: number;
  paymentType?: 'monthly' | 'per_session' | 'termly';
  sessionDuration?: number;
  isActive?: boolean;
}

// ===== Teachers =====
export interface TeacherDto {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  subjectIds: string[];
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CreateTeacherRequest {
  name: string;
  phone?: string;
  email?: string;
  subjectIds?: string[];
  notes?: string;
}

// ===== Students =====
export interface StudentDto {
  id: string;
  fullName: string;
  parentPhone: string;
  studentPhone: string | null;
  dateOfBirth: string | null;
  grade: string | null;
  notes: string | null;
  qrCode: string;
  isActive: boolean;
  createdAt: string;
}

export interface CreateStudentRequest {
  fullName: string;
  parentPhone: string;
  studentPhone?: string;
  dateOfBirth?: string;
  grade?: string;
  notes?: string;
}

// ===== Groups =====
export interface ScheduleItem {
  day: 'saturday' | 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday';
  startTime: string;
  endTime: string;
}

export interface GroupDto {
  id: string;
  subjectGradeId: string | null;
  teacherId: string | null;
  name: string;
  maxStudents: number;
  schedule: ScheduleItem[];
  isActive: boolean;
  studentCount: number;
  createdAt: string;
}

export interface GroupStudentDto {
  enrollmentId: string;
  studentId: string;
  fullName: string;
  parentPhone: string;
  studentPhone: string | null;
  grade: string | null;
  isActive: boolean;
  discount: number;
  joinedAt: string;
}

export interface CreateGroupRequest {
  subjectGradeId: string;
  teacherId?: string;
  name: string;
  maxStudents: number;
  schedule: ScheduleItem[];
}

export interface UpdateGroupRequest {
  subjectGradeId?: string;
  teacherId?: string;
  name?: string;
  maxStudents?: number;
  schedule?: ScheduleItem[];
  isActive?: boolean;
}

export interface AddStudentToGroupRequest {
  studentId: string;
  discount?: number;
}

// ===== Sessions =====
export type SessionStatus = 'scheduled' | 'completed' | 'cancelled';

export interface SessionDto {
  id: string;
  groupId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: SessionStatus;
  notes: string | null;
  createdAt: string;
}

// ===== Attendance =====
export type AttendanceStatus = 'present' | 'absent' | 'late';

export interface AttendanceDto {
  id: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  status: AttendanceStatus;
  notes: string | null;
}

// ===== Payments =====
export type PaymentMethod = 'cash' | 'transfer' | 'other';
export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'cancelled';
export type PaymentType = 'monthly' | 'per_session' | 'termly';

export interface PaymentDto {
  id: string;
  studentId: string;
  groupId: string;
  subjectGradeId: string | null;
  month: string;
  dueAmount: number;
  discountApplied: number;
  paidAmount: number;
  status: PaymentStatus;
  paymentType: PaymentType;
  paymentMethod: PaymentMethod;
  receiptNumber: number;
  notes: string | null;
  createdBy: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface CreatePaymentRequest {
  studentId: string;
  groupId: string;
  month: string;
  paidAmount: number;
  paymentMethod: PaymentMethod;
  notes?: string;
}

export * from './permissions';

// ===== Grades =====
export const GRADE_OPTIONS = [
  'الصف الأول الابتدائي', 'الصف الثاني الابتدائي', 'الصف الثالث الابتدائي',
  'الصف الرابع الابتدائي', 'الصف الخامس الابتدائي', 'الصف السادس الابتدائي',
  'الصف الأول الإعدادي', 'الصف الثاني الإعدادي', 'الصف الثالث الإعدادي',
  'الصف الأول الثانوي', 'الصف الثاني الثانوي', 'الصف الثالث الثانوي',
] as const;

export type Grade = typeof GRADE_OPTIONS[number];
