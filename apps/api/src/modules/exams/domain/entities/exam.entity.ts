// ============================================================
// Exam Module — Domain Entities
// ============================================================

export type ExamQuestionType = 'mcq' | 'true_false' | 'fill' | 'essay';
export type ExamDifficulty   = 'easy' | 'medium' | 'hard';

export interface ExamDesignConfig {
  header_color?:      string;
  font_family?:       string;
  show_logo?:         boolean;
  show_student_name?: boolean;
  show_date?:         boolean;
  show_degree?:       boolean;
  logo_position?:     'left' | 'right' | 'center';
  custom_header_text?: string;
}

// ─────────────────────────────────────────────────────────────
// ExamQuestionEntity — سؤال في بنك الأسئلة (ملكية كل مدرس خاصة)
// ─────────────────────────────────────────────────────────────
export class ExamQuestionEntity {
  id:            string;
  teacherId:     string;
  subjectId:     string | null;
  grade:         string | null;
  type:          ExamQuestionType;
  questionText:  string;
  imageUrl:      string | null;
  options:       string[] | null;
  correctAnswer: string | null;
  modelAnswer:   string | null;
  difficulty:    ExamDifficulty;
  tags:          string[];
  defaultDegree: number;
  timesUsed:     number;
  createdBy:     string | null;
  createdAt:     Date;
  updatedAt:     Date;
  deletedAt:     Date | null;

  constructor(data: Partial<ExamQuestionEntity>) {
    Object.assign(this, data);
  }

  update(data: Partial<Omit<ExamQuestionEntity, 'id' | 'teacherId' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'timesUsed'>>): void {
    Object.assign(this, data);
    this.updatedAt = new Date();
  }

  softDelete(): void {
    this.deletedAt = new Date();
    this.updatedAt = new Date();
  }
}

// ─────────────────────────────────────────────────────────────
// ExamEntity — الامتحان (رأس الامتحان بدون الأسئلة)
// ─────────────────────────────────────────────────────────────
export class ExamEntity {
  id:           string;
  teacherId:    string;
  subjectId:    string | null;
  grade:        string | null;
  title:        string;
  examDate:     Date | null;
  durationMins: number | null;
  totalDegree:  number;
  instructions: string | null;
  designConfig: ExamDesignConfig;
  isTemplate:   boolean;
  createdBy:    string | null;
  createdAt:    Date;
  updatedAt:    Date;
  deletedAt:    Date | null;

  constructor(data: Partial<ExamEntity>) {
    Object.assign(this, data);
  }

  update(data: Partial<Omit<ExamEntity, 'id' | 'teacherId' | 'createdAt' | 'updatedAt' | 'deletedAt'>>): void {
    Object.assign(this, data);
    this.updatedAt = new Date();
  }

  softDelete(): void {
    this.deletedAt = new Date();
    this.updatedAt = new Date();
  }

  /** إعادة حساب المجموع الكلي من بنود الامتحان */
  recalculateTotalDegree(items: ExamItemEntity[]): void {
    this.totalDegree = items.reduce((sum, item) => sum + (item.degree ?? 0), 0);
    this.updatedAt   = new Date();
  }
}

// ─────────────────────────────────────────────────────────────
// ExamItemEntity — سؤال داخل امتحان معين (نسخة snapshot)
// ─────────────────────────────────────────────────────────────
export class ExamItemEntity {
  id:           string;
  examId:       string;
  questionId:   string | null;
  questionText: string;
  type:         ExamQuestionType;
  options:      string[] | null;
  correctAnswer: string | null;
  modelAnswer:  string | null;
  imageUrl:     string | null;
  degree:       number;
  sortOrder:    number;
  sectionTitle: string | null;
  createdAt:    Date;

  constructor(data: Partial<ExamItemEntity>) {
    Object.assign(this, data);
  }
}
