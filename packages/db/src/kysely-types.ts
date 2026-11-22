import type { Generated, Insertable, Selectable, Updateable } from 'kysely';

export interface UsersTable {
  id: Generated<string>;
  email: string | null;
  username: string;
  password_hash: string;
  name: string;
  role: 'tenant_admin' | 'teacher' | 'secretary' | 'parent';
  permissions: string[];
  is_active: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface SubjectsTable {
  id: Generated<string>;
  name: string;
  color: Generated<string>;
  is_active: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface SubjectGradesTable {
  id: Generated<string>;
  subject_id: string;
  grade: string;
  fee: number;
  payment_type: 'monthly' | 'per_session' | 'termly';
  session_duration: Generated<number>;
  is_active: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface TeachersTable {
  id: Generated<string>;
  name: string;
  phone: string | null;
  phone_2: string | null;
  email: string | null;
  subject_ids: string;
  notes: string | null;
  is_active: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface StudentsTable {
  id: Generated<string>;
  full_name: string;
  parent_phone: string;
  student_phone: string | null;
  date_of_birth: Date | null;
  grade: string | null;
  notes: string | null;
  qr_code: string;
  student_code: string | null;
  telegram_chat_id: string | null;
  is_active: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface GroupsTable {
  id: Generated<string>;
  subject_grade_id: string | null;
  teacher_id: string | null;
  name: string;
  max_students: Generated<number>;
  schedule: string;
  is_active: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface GroupStudentsTable {
  id: Generated<string>;
  group_id: string;
  student_id: string;
  discount: Generated<number>;
  joined_at: Generated<Date>;
  left_at: Date | null;
}

export interface SessionsTable {
  id: Generated<string>;
  type: Generated<'lesson' | 'lesson_revision' | 'lesson_exam' | 'exam' | 'grade_exam'>;
  group_id: string | null;
  grade: string | null;
  subject_id: string | null;
  title: string;
  out_of: number | null;
  start_date: Date;
  end_date: Date | null;
  start_time: string | null;
  end_time: string | null;
  status: Generated<'scheduled' | 'ongoing' | 'completed' | 'cancelled'>;
  image_url: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface AttendanceTable {
  id: Generated<string>;
  session_id: string;
  student_id: string;
  status: Generated<'present' | 'absent' | 'late' | 'excused'>;
  degree: number | null;
  scanned_at: Date | null;
  notes: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  grade_notified_at: Date | null;
  telegram_grade_notified_at: Date | null;
}

export interface AttendanceCreditsTable {
  id: Generated<string>;
  student_id: string;
  subject_grade_id: string;
  source_session_id: string;
  source_attendance_id: string;
  week_start: Date;
  week_end: Date;
  status: Generated<'available' | 'consumed' | 'revoked' | 'expired'>;
  consumed_attendance_id: string | null;
  consumed_at: Date | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface NotificationsTable {
  id: Generated<string>;
  type: string;
  recipient_phone: string;
  message: string;
  status: Generated<'pending' | 'sent' | 'failed'>;
  sent_at: Date | null;
  created_at: Generated<Date>;
}

export interface TenantSettingsTable {
  id: Generated<string>;
  key: string;
  value: string;
  updated_at: Generated<Date>;
}

export interface CenterSettingsTable {
  id: Generated<string>;
  center_name: string;
  center_logo_url: string | null;
  center_phone: string | null;
  center_phone_2: string | null;
  center_address: string | null;
  currency: Generated<string>;
  currency_symbol: Generated<string>;
  academic_year: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface WaSessionsTable {
  id: Generated<string>;
  tenant_id: string;
  phone: string | null;
  status: string;
  qr_code: string | null;
  qr_expires_at: Date | null;
  connected_at: Date | null;
  warmup_started_at: Date | null;
  warmup_day: Generated<number>;
  is_banned: Generated<boolean>;
  banned_until: Date | null;
  last_health_check: Date | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface WaSettingsTable {
  id: Generated<string>;
  tenant_id: string;
  wa_enabled: Generated<boolean>;
  send_hours_from: Generated<string>;
  send_hours_to: Generated<string>;
  daily_limit: Generated<number>;
  delay_min_seconds: Generated<number>;
  delay_max_seconds: Generated<number>;
  warmup_enabled: Generated<boolean>;
  notify_absent: Generated<boolean>;
  notify_present: Generated<boolean>;
  notify_late: Generated<boolean>;
  notify_3_absences: Generated<boolean>;
  late_threshold_min: Generated<number>;
  notify_payment_confirm: Generated<boolean>;
  notify_payment_due_7d: Generated<boolean>;
  notify_payment_due_1d: Generated<boolean>;
  notify_payment_overdue: Generated<boolean>;
  notify_new_student: Generated<boolean>;
  notify_group_added: Generated<boolean>;
  notify_group_removed: Generated<boolean>;
  notify_student_card: Generated<boolean>;
  notify_absence_excused: Generated<boolean>;
  notify_grade_recorded: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface WaTemplatesTable {
  id: Generated<string>;
  tenant_id: string;
  key: string;
  body: string;
  is_default: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface WaMessagesLogTable {
  id: Generated<string>;
  tenant_id: string;
  phone: string;
  template_key: string | null;
  body: string;
  status: string;
  error_message: string | null;
  retry_count: Generated<number>;
  sent_at: Date | null;
  delivered_at: Date | null;
  bulk_job_id: string | null;
  created_at: Generated<Date>;
}

export interface WaBulkJobsTable {
  id: Generated<string>;
  tenant_id: string;
  title: string;
  body: string;
  status: string;
  total: Generated<number>;
  sent: Generated<number>;
  failed: Generated<number>;
  queued: Generated<number>;
  created_by: string;
  scheduled_at: Date | null;
  started_at: Date | null;
  completed_at: Date | null;
  cancelled_at: Date | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface WaInboundMessagesTable {
  id: Generated<string>;
  tenant_id: string;
  phone: string;
  body: string;
  student_id: string | null;
  is_read: Generated<boolean>;
  received_at: Generated<Date>;
  created_at: Generated<Date>;
}

// ─── Finance Types ────────────────────────────────────────
export interface TreasuriesTable {
  id: Generated<string>;
  name: string;
  type: string;
  balance: number;
  is_active: Generated<boolean>;
  notes: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface MonthlyDuesTable {
  id: Generated<string>;
  student_id: string;
  subject_grade_id: string;
  month: string;
  due_amount: number;
  discount_applied: Generated<number>;
  paid_amount: Generated<number>;
  status: Generated<string>;
  notes: string | null;
  created_by: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface PaymentsTable {
  id: Generated<string>;
  student_id: string;
  monthly_due_id: string;
  treasury_id: string;
  amount: number;
  payment_method: string;
  receipt_number: Generated<number>;
  status: Generated<string>;
  cancel_reason: string | null;
  refund_amount: number | null;
  notes: string | null;
  created_by: string | null;
  paid_at: Generated<Date>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface PaymentTransactionsTable {
  id: Generated<string>;
  payment_id: string | null;
  treasury_id: string;
  type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  notes: string | null;
  created_by: string | null;
  related_treasury_id: string | null;
  created_at: Generated<Date>;
}

export interface ExpensesTable {
  id: Generated<string>;
  treasury_id: string;
  category: string;
  title: string;
  amount: number;
  expense_date: Date;
  notes: string | null;
  created_by: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

// ─── TenantDatabase ───────────────────────────────────────
export interface ParentOtpCodesTable {
  id: Generated<string>;
  phone: string;
  code_hash: string;
  attempts: Generated<number>;
  consumed_at: Date | null;
  expires_at: Date;
  created_at: Generated<Date>;
}

// entity_type: 'student' حاليًا، قابل للتوسع مستقبلاً (مثلاً 'teacher') من غير
// أي تعديل في هذا الجدول أو في طبقة النقل (Polling) نفسها.
export interface TelegramLinksTable {
  id: Generated<string>;
  entity_type: string;
  entity_id: string;
  chat_id: string;
  linked_at: Generated<Date>;
}

export interface TelegramSettingsTable {
  id: Generated<string>;
  tenant_id: string;
  telegram_enabled: Generated<boolean>;
  send_hours_from: Generated<string>;
  send_hours_to: Generated<string>;
  notify_absent: Generated<boolean>;
  notify_present: Generated<boolean>;
  notify_late: Generated<boolean>;
  notify_3_absences: Generated<boolean>;
  notify_payment_confirm: Generated<boolean>;
  notify_payment_due_7d: Generated<boolean>;
  notify_payment_due_1d: Generated<boolean>;
  notify_payment_overdue: Generated<boolean>;
  notify_new_student: Generated<boolean>;
  notify_group_added: Generated<boolean>;
  notify_group_removed: Generated<boolean>;
  notify_absence_excused: Generated<boolean>;
  notify_grade_recorded: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface TelegramTemplatesTable {
  id: Generated<string>;
  tenant_id: string;
  key: string;
  body: string;
  is_default: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface TelegramMessagesTable {
  id: Generated<string>;
  tenant_id: string;
  chat_id: string;
  entity_type: string;
  entity_id: string;
  template_key: string | null;
  body: string;
  status: string;
  error_message: string | null;
  sent_at: Date | null;
  created_at: Generated<Date>;
}

export interface TelegramInboundMessagesTable {
  id: Generated<string>;
  tenant_id: string;
  chat_id: string;
  body: string;
  entity_type: string | null;
  entity_id: string | null;
  is_read: Generated<boolean>;
  received_at: Generated<Date>;
  created_at: Generated<Date>;
}

export interface TenantDatabase {
  users: UsersTable;
  subjects: SubjectsTable;
  subject_grades: SubjectGradesTable;
  teachers: TeachersTable;
  students: StudentsTable;
  groups: GroupsTable;
  group_students: GroupStudentsTable;
  sessions: SessionsTable;
  attendance: AttendanceTable;
  attendance_credits: AttendanceCreditsTable;
  notifications: NotificationsTable;
  tenant_settings: TenantSettingsTable;
  center_settings: CenterSettingsTable;
  wa_sessions: WaSessionsTable;
  wa_settings: WaSettingsTable;
  wa_templates: WaTemplatesTable;
  wa_messages_log: WaMessagesLogTable;
  wa_bulk_jobs: WaBulkJobsTable;
  wa_inbound_messages: WaInboundMessagesTable;
  treasuries: TreasuriesTable;
  monthly_dues: MonthlyDuesTable;
  payments: PaymentsTable;
  payment_transactions: PaymentTransactionsTable;
  expenses: ExpensesTable;
  parent_otp_codes: ParentOtpCodesTable;
  telegram_links: TelegramLinksTable;
  telegram_settings: TelegramSettingsTable;
  telegram_templates: TelegramTemplatesTable;
  telegram_messages: TelegramMessagesTable;
  telegram_inbound_messages: TelegramInboundMessagesTable;
  // ─── Question Bank ────────────────────────────────────────
  exam_questions: ExamQuestionsTable;
  exams: ExamsTable;
  exam_items: ExamItemsTable;
}

// ============================================================
// Question Bank Types
// ============================================================
export type ExamQuestionType = 'mcq' | 'true_false' | 'fill' | 'essay';
export type ExamDifficulty   = 'easy' | 'medium' | 'hard';

export interface ExamQuestionsTable {
  id:               Generated<string>;
  teacher_id:       string | null;
  subject_id:       string | null;
  grade:            string | null;
  type:             ExamQuestionType;
  question_text:    string;
  image_url:        string | null;
  options:          string[] | null;        // JSON array — للـ MCQ
  correct_answer:   string | null;
  model_answer:     string | null;
  difficulty:       Generated<ExamDifficulty>;
  tags:             Generated<string[]>;
  default_degree:   Generated<number>;
  times_used:       Generated<number>;
  created_by:       string | null;
  created_at:       Generated<Date>;
  updated_at:       Generated<Date>;
  deleted_at:       Date | null;
}

export interface ExamDesignConfig {
  header_color:       string;
  font_family:        string;
  show_logo:          boolean;
  show_student_name:  boolean;
  show_date:          boolean;
  show_degree:        boolean;
  logo_position:      'right' | 'left' | 'center';
  custom_header_text: string | null;
}

export interface ExamsTable {
  id:              Generated<string>;
  teacher_id:      string | null;
  subject_id:      string | null;
  grade:           string | null;
  title:           string;
  exam_date:       Date | null;
  duration_mins:   number | null;
  total_degree:    Generated<number>;
  instructions:    string | null;
  design_config:   Generated<ExamDesignConfig>;
  is_template:     Generated<boolean>;
  created_by:      string | null;
  created_at:      Generated<Date>;
  updated_at:      Generated<Date>;
  deleted_at:      Date | null;
}

export interface ExamItemsTable {
  id:              Generated<string>;
  exam_id:         string;
  question_id:     string | null;
  question_text:   string;
  type:            ExamQuestionType;
  options:         string[] | null;
  correct_answer:  string | null;
  model_answer:    string | null;
  image_url:       string | null;
  degree:          Generated<number>;
  sort_order:      Generated<number>;
  section_title:   string | null;
  created_at:      Generated<Date>;
}

export type User = Selectable<UsersTable>;
export type Subject = Selectable<SubjectsTable>;
export type SubjectGrade = Selectable<SubjectGradesTable>;
export type Teacher = Selectable<TeachersTable>;
export type Student = Selectable<StudentsTable>;
export type Group = Selectable<GroupsTable>;
export type GroupStudent = Selectable<GroupStudentsTable>;
export type Session = Selectable<SessionsTable>;
export type Attendance = Selectable<AttendanceTable>;
export type AttendanceCredit = Selectable<AttendanceCreditsTable>;
export type Payment = Selectable<PaymentsTable>;

export type NewSubject = Insertable<SubjectsTable>;
export type NewSubjectGrade = Insertable<SubjectGradesTable>;
export type NewGroup = Insertable<GroupsTable>;
export type NewGroupStudent = Insertable<GroupStudentsTable>;
export type NewPayment = Insertable<PaymentsTable>;

export type UpdateSubject = Updateable<SubjectsTable>;
export type UpdateSubjectGrade = Updateable<SubjectGradesTable>;
export type UpdateGroup = Updateable<GroupsTable>;
export type UpdatePayment = Updateable<PaymentsTable>;

// Question Bank
export type ExamQuestion    = Selectable<ExamQuestionsTable>;
export type Exam            = Selectable<ExamsTable>;
export type ExamItem        = Selectable<ExamItemsTable>;
export type NewExamQuestion = Insertable<ExamQuestionsTable>;
export type NewExam         = Insertable<ExamsTable>;
export type NewExamItem     = Insertable<ExamItemsTable>;
export type UpdateExamQuestion = Updateable<ExamQuestionsTable>;
export type UpdateExam         = Updateable<ExamsTable>;
