// ─────────────────────────────────────────────────────────────
// أنواع بنك الأسئلة والامتحانات
// ─────────────────────────────────────────────────────────────

export type QuestionType = 'mcq' | 'true_false' | 'fill' | 'essay';
export type Difficulty   = 'easy' | 'medium' | 'hard';

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  mcq:        'اختيار من متعدد',
  true_false: 'صح أو خطأ',
  fill:       'أكمل الفراغ',
  essay:      'مقالي',
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy:   'سهل',
  medium: 'متوسط',
  hard:   'صعب',
};

export const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy:   'bg-green-50 text-green-700 border-green-200',
  medium: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  hard:   'bg-red-50 text-red-700 border-red-200',
};

// ─── بنك الأسئلة ──────────────────────────────────────────────
export interface QuestionDto {
  id:            string;
  teacherId:     string;
  subjectId:     string | null;
  grade:         string | null;
  type:          QuestionType;
  questionText:  string;
  imageUrl:      string | null;
  options:       string[] | null;
  correctAnswer: string | null;
  modelAnswer:   string | null;
  difficulty:    Difficulty;
  tags:          string[];
  defaultDegree: number;
  timesUsed:     number;
  createdAt:     string;
  updatedAt:     string;
}

export interface CreateQuestionPayload {
  type:          QuestionType;
  questionText:  string;
  subjectId?:    string | null;
  grade?:        string | null;
  options?:      string[] | null;
  correctAnswer?: string | null;
  modelAnswer?:  string | null;
  imageUrl?:     string | null;
  difficulty:    Difficulty;
  tags:          string[];
  defaultDegree: number;
}

export interface UpdateQuestionPayload extends Partial<CreateQuestionPayload> {}

export interface ListQuestionsParams {
  page?:       number;
  limit?:      number;
  subjectId?:  string;
  grade?:      string;
  type?:       QuestionType;
  difficulty?: Difficulty;
  search?:     string;
  tags?:       string;
}

export interface PaginatedQuestions {
  data:  QuestionDto[];
  total: number;
  page:  number;
  limit: number;
}

// ─── الامتحانات ───────────────────────────────────────────────
export interface ExamDesignConfig {
  header_color?:       string;
  font_family?:        string;
  show_logo?:          boolean;
  show_student_name?:  boolean;
  show_date?:          boolean;
  show_degree?:        boolean;
  logo_position?:      'left' | 'right' | 'center';
  custom_header_text?: string;
}

export interface ExamDto {
  id:           string;
  teacherId:    string;
  subjectId:    string | null;
  grade:        string | null;
  title:        string;
  examDate:     string | null;
  durationMins: number | null;
  totalDegree:  number;
  instructions: string | null;
  designConfig: ExamDesignConfig;
  isTemplate:   boolean;
  createdAt:    string;
  updatedAt:    string;
}

export interface ExamItemDto {
  id:           string;
  examId:       string;
  questionId:   string | null;
  questionText: string;
  type:         QuestionType;
  options:      string[] | null;
  correctAnswer: string | null;
  modelAnswer:  string | null;
  imageUrl:     string | null;
  degree:       number;
  sortOrder:    number;
  sectionTitle: string | null;
}

export interface ExamWithItems {
  exam:  ExamDto;
  items: ExamItemDto[];
}

export interface CreateExamPayload {
  title:        string;
  subjectId?:   string | null;
  grade?:       string | null;
  examDate?:    string | null;
  durationMins?: number | null;
  instructions?: string | null;
  designConfig?: ExamDesignConfig;
  isTemplate?:  boolean;
}

export interface UpdateExamPayload extends Partial<CreateExamPayload> {}

export interface ListExamsParams {
  page?:       number;
  limit?:      number;
  subjectId?:  string;
  grade?:      string;
  search?:     string;
  isTemplate?: boolean;
}

export interface PaginatedExams {
  data:  ExamDto[];
  total: number;
  page:  number;
  limit: number;
}

export interface SaveExamItemPayload {
  questionId?:   string | null;
  questionText:  string;
  type:          QuestionType;
  options?:      string[] | null;
  correctAnswer?: string | null;
  modelAnswer?:  string | null;
  imageUrl?:     string | null;
  degree:        number;
  sortOrder:     number;
  sectionTitle?: string | null;
}

export interface GenerateExamPayload {
  title:             string;
  subjectId?:        string | null;
  grade?:            string | null;
  count:             number;
  difficulty?:       Difficulty;
  questionTypes?:    QuestionType[];
  degreePerQuestion?: number;
}
