import { z } from 'zod';

// ─────────────────────────────────────────────────────────────
// أنواع مشتركة
// ─────────────────────────────────────────────────────────────
export const QuestionTypeEnum = z.enum(['mcq', 'true_false', 'fill', 'essay']);
export const DifficultyEnum   = z.enum(['easy', 'medium', 'hard']);

// صور الأسئلة بترجع من /upload/image كرابط نسبي (/storage/...) — z.url() كان بيرفضها
export const ImageUrlSchema = z.string().max(1000).refine(
  (v) => v.startsWith('/storage/') || /^https?:\/\//i.test(v),
  { message: 'رابط الصورة غير صالح' },
);

// ─────────────────────────────────────────────────────────────
// بنك الأسئلة
// ─────────────────────────────────────────────────────────────
export const ListQuestionsSchema = z.object({
  page:       z.coerce.number().int().positive().default(1),
  limit:      z.coerce.number().int().positive().max(100).default(20),
  subjectId:  z.string().uuid().optional(),
  grade:      z.string().optional(),
  type:       QuestionTypeEnum.optional(),
  difficulty: DifficultyEnum.optional(),
  search:     z.string().optional(),
  tags:       z.union([z.string(), z.array(z.string())]).transform(v =>
    typeof v === 'string' ? v.split(',').filter(Boolean) : v
  ).optional(),
});

export const QuestionBaseSchema = z.object({
  type:          QuestionTypeEnum,
  questionText:  z.string().min(3, 'نص السؤال مطلوب'),
  subjectId:     z.string().uuid().optional().nullable(),
  grade:         z.string().optional().nullable(),
  options:       z.array(z.string()).optional().nullable(),
  correctAnswer: z.string().optional().nullable(),
  modelAnswer:   z.string().optional().nullable(),
  imageUrl:      ImageUrlSchema.optional().nullable(),
  difficulty:    DifficultyEnum.default('medium'),
  tags:          z.array(z.string()).default([]),
  defaultDegree: z.coerce.number().positive().default(1),
});

export const CreateQuestionSchema = QuestionBaseSchema.refine(data => {
  // MCQ يجب أن يكون له خيارات وإجابة صحيحة
  if (data.type === 'mcq') {
    return Array.isArray(data.options) && data.options.length >= 2 && !!data.correctAnswer;
  }
  return true;
}, { message: 'الأسئلة الاختيارية تحتاج خيارات وإجابة صحيحة' });

export const UpdateQuestionSchema = QuestionBaseSchema.partial();

// ─────────────────────────────────────────────────────────────
// الامتحانات
// ─────────────────────────────────────────────────────────────
export const ExamDesignConfigSchema = z.object({
  header_color:      z.string().optional(),
  font_family:       z.string().optional(),
  show_logo:         z.boolean().optional(),
  show_student_name: z.boolean().optional(),
  show_date:         z.boolean().optional(),
  show_degree:       z.boolean().optional(),
  logo_position:     z.enum(['left', 'right', 'center']).optional(),
  custom_header_text: z.string().optional(),
}).default({});

export const ListExamsSchema = z.object({
  page:       z.coerce.number().int().positive().default(1),
  limit:      z.coerce.number().int().positive().max(100).default(20),
  subjectId:  z.string().uuid().optional(),
  grade:      z.string().optional(),
  search:     z.string().optional(),
  isTemplate: z.coerce.boolean().optional(),
});

export const CreateExamSchema = z.object({
  title:        z.string().min(2, 'عنوان الامتحان مطلوب'),
  subjectId:    z.string().uuid().optional().nullable(),
  grade:        z.string().optional().nullable(),
  examDate:     z.coerce.date().optional().nullable(),
  durationMins: z.coerce.number().int().positive().optional().nullable(),
  instructions: z.string().optional().nullable(),
  designConfig: ExamDesignConfigSchema.optional(),
  isTemplate:   z.coerce.boolean().default(false),
});

export const UpdateExamSchema = CreateExamSchema.partial();

// ─────────────────────────────────────────────────────────────
// بنود الامتحان
// ─────────────────────────────────────────────────────────────
export const SaveExamItemSchema = z.object({
  questionId:    z.string().uuid().optional().nullable(),
  questionText:  z.string().min(1, 'نص السؤال مطلوب'),
  type:          QuestionTypeEnum,
  options:       z.array(z.string()).optional().nullable(),
  correctAnswer: z.string().optional().nullable(),
  modelAnswer:   z.string().optional().nullable(),
  imageUrl:      ImageUrlSchema.optional().nullable(),
  degree:        z.coerce.number().nonnegative().default(1),
  sortOrder:     z.coerce.number().int().nonnegative().default(0),
  sectionTitle:  z.string().optional().nullable(),
});

export const SaveExamItemsSchema = z.object({
  items: z.array(SaveExamItemSchema).min(1, 'يجب أن يحتوي الامتحان على سؤال واحد على الأقل'),
});

// ─────────────────────────────────────────────────────────────
// توليد تلقائي
// ─────────────────────────────────────────────────────────────
export const GenerateExamSchema = z.object({
  title:         z.string().min(2, 'عنوان الامتحان مطلوب'),
  subjectId:     z.string().uuid().optional().nullable(),
  grade:         z.string().optional().nullable(),
  count:         z.coerce.number().int().positive().max(100).default(10),
  difficulty:    DifficultyEnum.optional(),
  questionTypes: z.array(QuestionTypeEnum).optional(),
  // اختياري: لو مش محدد كل سؤال بياخد درجته الافتراضية من البنك
  degreePerQuestion: z.coerce.number().positive().optional(),
});

// ─────────────────────────────────────────────────────────────
// تصدير الأنواع
// ─────────────────────────────────────────────────────────────
export type ListQuestionsDto  = z.infer<typeof ListQuestionsSchema>;
export type CreateQuestionDto = z.infer<typeof CreateQuestionSchema>;
export type UpdateQuestionDto = z.infer<typeof UpdateQuestionSchema>;
export type ListExamsDto      = z.infer<typeof ListExamsSchema>;
export type CreateExamDto     = z.infer<typeof CreateExamSchema>;
export type UpdateExamDto     = z.infer<typeof UpdateExamSchema>;
export type SaveExamItemsDto  = z.infer<typeof SaveExamItemsSchema>;
export type GenerateExamDto   = z.infer<typeof GenerateExamSchema>;
