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
  notifyAbsenceExcused: boolean;
  notifyGradeRecorded: boolean;
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
  | 'NEW_STUDENT' | 'GROUP_ADDED' | 'GROUP_REMOVED' | 'ABSENCE_EXCUSED' | 'GRADE_RECORDED' | 'TELEGRAM_LINK';

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
  GRADE_RECORDED: 'تسجيل درجة',
  TELEGRAM_LINK: 'رابط ربط تليجرام',
};

// لازم تطابق WA_TEMPLATE_VARIABLES في الباك إند (wa-template.entity.ts) — الباك إند
// بيرفض الحفظ لو أي متغير من دول ناقص من نص القالب.
export const WA_TEMPLATE_VARIABLES: Record<WaTemplateKey, string[]> = {
  ABSENT:          ['{student_name}', '{subject}', '{date}', '{center_name}'],
  PRESENT:         ['{student_name}', '{subject}', '{time}', '{center_name}'],
  LATE:            ['{student_name}', '{subject}', '{date}', '{center_name}'],
  THREE_ABSENCES:  ['{student_name}', '{subject}', '{count}', '{center_name}'],
  PAYMENT_CONFIRM: ['{student_name}', '{amount}', '{date}', '{center_name}'],
  PAYMENT_DUE:     ['{student_name}', '{amount}', '{days}', '{center_name}'],
  PAYMENT_OVERDUE: ['{student_name}', '{amount}', '{days}', '{center_name}'],
  NEW_STUDENT:     ['{student_name}', '{center_name}'],
  GROUP_ADDED:     ['{student_name}', '{group_name}', '{days}', '{time}', '{center_name}'],
  GROUP_REMOVED:   ['{student_name}', '{group_name}', '{center_name}'],
  ABSENCE_EXCUSED: ['{student_name}', '{subject}', '{date}', '{center_name}'],
  GRADE_RECORDED:  ['{student_name}', '{subject}', '{date}', '{degree}', '{out_of}', '{center_name}'],
  TELEGRAM_LINK:   ['{student_name}', '{link}', '{center_name}'],
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

// 'students': قائمة معرفات صريحة — مستخدمة في الإرسال الفردي لطالب واحد بعينه
// (شاشة حالة ربط تليجرام) من غير ما تمر بأي فلتر مجموعة/مادة/صف/مدرس
export type AudienceType = 'all' | 'group' | 'subjectGrade' | 'grade' | 'teacher' | 'students';
export type PhoneSource = 'parent' | 'student';

export interface ResolveAudienceParams {
  type: AudienceType;
  groupId?: string;
  subjectGradeId?: string;
  grade?: string;
  teacherId?: string;
  studentIds?: string[];
}

export interface AudienceStudent {
  studentId: string;
  studentName: string;
  studentCode: string;
  parentPhone: string | null;
  studentPhone: string | null;
}
