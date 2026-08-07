export type SessionType = 'lesson' | 'lesson_revision' | 'lesson_exam' | 'exam' | 'grade_exam';
export type SessionStatus = 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  lesson:           'حصة عادية',
  lesson_revision:  'حصة + تسميع',
  lesson_exam:      'حصة + امتحان',
  exam:             'امتحان',
  grade_exam:       'امتحان مرحلة',
};

export const SESSION_STATUS_LABELS: Record<SessionStatus, { label: string; class: string }> = {
  scheduled:  { label: 'مجدولة',  class: 'bg-blue-50 text-blue-700 border-blue-200' },
  ongoing:    { label: 'جارية',   class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  completed:  { label: 'منتهية',  class: 'bg-gray-50 text-gray-600 border-gray-200' },
  cancelled:  { label: 'ملغاة',   class: 'bg-red-50 text-red-600 border-red-200' },
};

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, { label: string; class: string }> = {
  present: { label: 'حاضر',   class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  absent:  { label: 'غايب',   class: 'bg-red-50 text-red-600 border-red-200' },
  late:    { label: 'متأخر',  class: 'bg-amber-50 text-amber-700 border-amber-200' },
  excused: { label: 'معذور',  class: 'bg-purple-50 text-purple-700 border-purple-200' },
};

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  degree: number | null;
  scannedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  studentName: string;
  studentCode: string;
  studentPhone: string | null;
  parentPhone: string;
}

export interface Session {
  id: string;
  type: SessionType;
  groupId: string | null;
  grade: string | null;
  subjectId: string | null;
  title: string;
  outOf: number | null;
  startDate: string;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  status: SessionStatus;
  imageUrl: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  groupName?: string;
  subjectName?: string;
  teacherName?: string;
  attendanceCount?: {
    present: number;
    absent: number;
    late: number;
    total: number;
  };
}

export interface CreateSessionPayload {
  type: SessionType;
  title: string;
  groupId?: string;
  grade?: string;
  subjectId?: string;
  outOf?: number;
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
}

export interface UpdateAttendancePayload {
  status: AttendanceStatus;
  degree?: number;
  notes?: string;
}

export interface BulkUpdateAttendancePayload {
  updates: {
    studentId: string;
    status: AttendanceStatus;
    degree?: number;
    notes?: string;
  }[];
}

export interface AddExternalAttendanceIdentifier {
  studentId?: string;
  studentCode?: string;
}

export interface AddExternalAttendanceResult {
  attendance: AttendanceRecord;
  excusedAbsence: boolean;
  creditCreated: boolean;
}

export interface ListSessionsParams {
  type?: SessionType;
  groupId?: string;
  grade?: string;
  status?: SessionStatus;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface AbsenceReportRow {
  studentId: string;
  studentName: string;
  studentCode: string;
  parentPhone: string | null;
  absentCount: number;
  totalSessions: number;
}

// ─── Helper functions ─────────────────────────────────────
export function sessionHasGrades(type: SessionType): boolean {
  return ['lesson_revision', 'lesson_exam', 'exam', 'grade_exam'].includes(type);
}

export function sessionHasImage(type: SessionType): boolean {
  return ['lesson_revision', 'lesson_exam', 'exam', 'grade_exam'].includes(type);
}

export function sessionIsOpen(status: SessionStatus): boolean {
  return ['scheduled', 'ongoing'].includes(status);
}
