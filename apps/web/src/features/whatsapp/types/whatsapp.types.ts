export type WaSessionStatus = 'disconnected' | 'connecting' | 'connected' | 'banned';

export interface WaStatusDto {
  status: WaSessionStatus;
  phone?: string;
  qrCode?: string;
  warmupDay?: number;
  dailyLimit?: number;
}

export interface WaHealthDto {
  status: WaSessionStatus;
  phone?: string;
  warmupDay: number;
  dailyLimit: number;
  lastHealthCheck?: string;
  isBanned: boolean;
}

export interface WaSettingsDto {
  id: string;
  tenantId: string;
  waEnabled: boolean;
  sendHoursFrom: string;
  sendHoursTo: string;
  dailyLimit: number;
  delayMinSeconds: number;
  delayMaxSeconds: number;
  warmupEnabled: boolean;
  notifyAbsent: boolean;
  notifyPresent: boolean;
  notifyLate: boolean;
  notify3Absences: boolean;
  lateThresholdMin: number;
  notifyPaymentConfirm: boolean;
  notifyPaymentDue7d: boolean;
  notifyPaymentDue1d: boolean;
  notifyPaymentOverdue: boolean;
  notifyNewStudent: boolean;
  notifyGroupAdded: boolean;
  notifyGroupRemoved: boolean;
  notifyStudentCard: boolean;
}

export type UpdateSettingsPayload = Partial<Omit<WaSettingsDto, 'id' | 'tenantId'>>;

export interface WaTemplateDto {
  id: string;
  tenantId: string;
  key: string;
  body: string;
  isDefault: boolean;
}

export type WaTemplateKey =
  | 'ABSENT' | 'PRESENT' | 'LATE' | 'THREE_ABSENCES'
  | 'PAYMENT_CONFIRM' | 'PAYMENT_DUE' | 'PAYMENT_OVERDUE'
  | 'NEW_STUDENT' | 'GROUP_ADDED' | 'GROUP_REMOVED' | 'ABSENCE_EXCUSED';

export const WA_TEMPLATE_LABELS: Record<WaTemplateKey, string> = {
  ABSENT: 'إشعار الغياب',
  PRESENT: 'إشعار الحضور',
  LATE: 'إشعار التأخير',
  THREE_ABSENCES: 'تنبيه 3 غيابات متتالية',
  PAYMENT_CONFIRM: 'تأكيد الدفع',
  PAYMENT_DUE: 'تذكير موعد الدفع',
  PAYMENT_OVERDUE: 'تنبيه تأخر السداد',
  NEW_STUDENT: 'ترحيب بالطالب الجديد',
  GROUP_ADDED: 'إضافة لمجموعة',
  GROUP_REMOVED: 'إزالة من مجموعة',
  ABSENCE_EXCUSED: 'إعفاء غياب (حضور بديل)',
};

export const WA_TEMPLATE_VARIABLES: Record<WaTemplateKey, string[]> = {
  ABSENT:          ['{student_name}', '{subject}', '{date}'],
  PRESENT:         ['{student_name}', '{subject}', '{time}'],
  LATE:            ['{student_name}', '{subject}', '{date}'],
  THREE_ABSENCES:  ['{student_name}', '{subject}', '{count}'],
  PAYMENT_CONFIRM: ['{student_name}', '{amount}', '{date}', '{center_name}'],
  PAYMENT_DUE:     ['{student_name}', '{amount}', '{days}', '{center_name}'],
  PAYMENT_OVERDUE: ['{student_name}', '{amount}', '{days}'],
  NEW_STUDENT:     ['{student_name}', '{center_name}'],
  GROUP_ADDED:     ['{student_name}', '{group_name}', '{days}', '{time}'],
  GROUP_REMOVED:   ['{student_name}', '{group_name}', '{center_name}'],
  ABSENCE_EXCUSED: ['{student_name}', '{subject}', '{date}'],
};

export interface WaBulkProgressDto {
  jobId: string;
  total: number;
  sent: number;
  failed: number;
  queued: number;
  progress: number;
  status: string;
}

export interface WaInboundMessageDto {
  id: string;
  phone: string;
  body: string;
  studentId?: string;
  isRead: boolean;
  receivedAt: string;
}

export interface SendBulkPayload {
  title: string;
  body: string;
  phones: string[];
  scheduledAt?: string;
}

export type AudienceType = 'all' | 'group' | 'subjectGrade' | 'grade' | 'teacher';
export type PhoneSource = 'parent' | 'student';

export interface ResolveAudienceParams {
  type: AudienceType;
  groupId?: string;
  subjectGradeId?: string;
  grade?: string;
  teacherId?: string;
}

export interface AudienceStudent {
  studentId: string;
  studentName: string;
  parentPhone: string | null;
  studentPhone: string | null;
}
