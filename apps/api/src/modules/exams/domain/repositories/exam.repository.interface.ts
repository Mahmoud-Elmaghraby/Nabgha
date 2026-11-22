import type { ExamQuestionEntity, ExamEntity, ExamItemEntity } from '../entities/exam.entity';

export const EXAM_REPOSITORY = 'EXAM_REPOSITORY';

export interface ListQuestionsParams {
  page?:       number;
  limit?:      number;
  subjectId?:  string;
  grade?:      string;
  type?:       string;
  difficulty?: string;
  search?:     string;
  tags?:       string[];
}

export interface ListExamsParams {
  page?:       number;
  limit?:      number;
  subjectId?:  string;
  grade?:      string;
  search?:     string;
  isTemplate?: boolean;
}

export interface CreateQuestionData {
  teacherId:     string;
  type:          string;
  questionText:  string;
  subjectId?:    string | null;
  grade?:        string | null;
  options?:      string[] | null;
  correctAnswer?: string | null;
  modelAnswer?:  string | null;
  imageUrl?:     string | null;
  difficulty?:   string;
  tags?:         string[];
  defaultDegree?: number;
  createdBy?:    string | null;
}

export interface CreateExamData {
  teacherId:    string;
  title:        string;
  subjectId?:   string | null;
  grade?:       string | null;
  examDate?:    Date | null;
  durationMins?: number | null;
  instructions?: string | null;
  designConfig?: Record<string, any>;
  isTemplate?:  boolean;
  createdBy?:   string | null;
}

export interface CreateExamItemData {
  examId:        string;
  questionId?:   string | null;
  questionText:  string;
  type:          string;
  options?:      string[] | null;
  correctAnswer?: string | null;
  modelAnswer?:  string | null;
  imageUrl?:     string | null;
  degree?:       number;
  sortOrder?:    number;
  sectionTitle?: string | null;
}

export interface IExamRepository {
  // ─── بنك الأسئلة ───────────────────────────────────────────
  findQuestions(tenantId: string, params: ListQuestionsParams): Promise<{ data: ExamQuestionEntity[]; total: number }>;
  findQuestionById(tenantId: string, id: string): Promise<ExamQuestionEntity | null>;
  createQuestion(tenantId: string, data: CreateQuestionData): Promise<ExamQuestionEntity>;
  saveQuestion(tenantId: string, question: ExamQuestionEntity): Promise<void>;

  // ─── الامتحانات ─────────────────────────────────────────────
  findExams(tenantId: string, params: ListExamsParams): Promise<{ data: ExamEntity[]; total: number }>;
  findExamById(tenantId: string, id: string): Promise<ExamEntity | null>;
  createExam(tenantId: string, data: CreateExamData): Promise<ExamEntity>;
  saveExam(tenantId: string, exam: ExamEntity): Promise<void>;

  // ─── بنود الامتحان ──────────────────────────────────────────
  findExamItems(tenantId: string, examId: string): Promise<ExamItemEntity[]>;
  createExamItem(tenantId: string, data: CreateExamItemData): Promise<ExamItemEntity>;
  deleteExamItems(tenantId: string, examId: string): Promise<void>;
  replaceExamItems(tenantId: string, examId: string, items: CreateExamItemData[]): Promise<ExamItemEntity[]>;

  // ─── توليد تلقائي ───────────────────────────────────────────
  findRandomQuestions(
    tenantId: string,
    params: { subjectId?: string; grade?: string; difficulty?: string; types?: string[]; count: number },
  ): Promise<ExamQuestionEntity[]>;
}
