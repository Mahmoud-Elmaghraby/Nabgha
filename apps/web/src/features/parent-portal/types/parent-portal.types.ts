export interface ParentUpcomingSession {
  id: string;
  title: string;
  type: string;
  startDate: string;
  startTime: string | null;
  endTime: string | null;
  status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
  groupName: string | null;
  subjectName: string | null;
}

export interface ParentAttendanceRecord {
  id: string;
  sessionId: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  degree: number | null;
  outOf: number | null;
  scannedAt: string | null;
  sessionTitle: string;
  sessionType: string;
  startDate: string;
  groupName: string | null;
  subjectName: string | null;
}

export interface ParentDue {
  id: string;
  month: string;
  subjectName: string | null;
  gradeName: string | null;
  dueAmount: number;
  discountApplied: number;
  paidAmount: number;
  netDue: number;
  remaining: number;
  status: 'unpaid' | 'partial' | 'paid' | 'waived' | 'cancelled';
}

export interface ParentPayment {
  id: string;
  amount: number;
  paymentMethod: string;
  receiptNumber: number;
  status: string;
  paidAt: string;
  month: string | null;
  subjectName: string | null;
}

export interface ParentStudentDetail {
  student: { id: string; fullName: string; grade: string | null; studentCode: string | null };
  upcomingSessions: ParentUpcomingSession[];
  attendance: ParentAttendanceRecord[];
  finance: { dues: ParentDue[]; payments: ParentPayment[]; totalRemaining: number };
}
