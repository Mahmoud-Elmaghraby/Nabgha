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

export const ExamKindEnum = z.enum(['exam', 'quiz']);

export const ListExamsSchema = z.object({
  page:       z.coerce.number().int().positive().default(1),
  limit:      z.coerce.number().int().positive().max(100).default(20),
  subjectId:  z.string().uuid().optional(),
  grade:      z.string().optional(),
  search:     z.string().optional(),
  isTemplate: z.coerce.boolean().optional(),
  kind:       ExamKindEnum.optional(),
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
  kind:         ExamKindEnum.default('exam'),
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
  items: z.array(SaveExamItemSchema).max(200).min(1, 'يجب أن يحتوي الامتحان على سؤال واحد على الأقل'),
});

// ─────────────────────────────────────────────────────────────
// توليد تلقائي
// ─────────────────────────────────────────────────────────────
/** صف من مواصفات الامتحان: النوع + المستوى + العدد + (اختياري) الدرجة والوحدة وعنوان القسم */
export const BlueprintRowSchema = z.object({
  type:         QuestionTypeEnum.optional().nullable(),
  difficulty:   DifficultyEnum.optional().nullable(),
  count:        z.coerce.number().int().positive().max(100),
  degree:       z.coerce.number().positive().optional().nullable(),
  tags:         z.array(z.string().max(100)).max(30).optional(),
  sectionTitle: z.string().max(200).optional().nullable(),
});

export const GenerateExamSchema = z.object({
  title:         z.string().min(2, 'عنوان الامتحان مطلوب'),
  kind:          ExamKindEnum.default('exam'),
  subjectId:     z.string().uuid().optional().nullable(),
  grade:         z.string().optional().nullable(),
  examDate:      z.coerce.date().optional().nullable(),
  durationMins:  z.coerce.number().int().positive().max(600).optional().nullable(),
  instructions:  z.string().max(2000).optional().nullable(),
  /** وحدات/تاجات عامة على كل الصفوف (صف ممكن يحدد تاجات خاصة بيه) */
  tags:          z.array(z.string().max(100)).max(30).optional(),
  /** أخّر الأسئلة اللي اتحطت في امتحانات آخر N يوم (0 = من غير) */
  avoidRecentDays: z.coerce.number().int().min(0).max(365).default(30),
  blueprint:     z.array(BlueprintRowSchema).min(1).max(20).optional(),
  // ── الوضع القديم (صف واحد) — لسه مدعوم ──
  count:         z.coerce.number().int().positive().max(100).default(10),
  difficulty:    DifficultyEnum.optional(),
  questionTypes: z.array(QuestionTypeEnum).optional(),
  // اختياري: لو مش محدد كل سؤال بياخد درجته الافتراضية من البنك
  degreePerQuestion: z.coerce.number().positive().optional(),
});

// ─────────────────────────────────────────────────────────────
// استيراد أسئلة (Excel / نص ملصوق) — إعدادات افتراضية لكل الأسئلة المستوردة
// ─────────────────────────────────────────────────────────────
const boolish = z.preprocess((v) => v === true || v === 'true' || v === '1' || v === 1, z.boolean());

export const ImportOptionsSchema = z.object({
  subjectId:     z.preprocess((v) => (v === '' ? null : v), z.string().uuid().optional().nullable()),
  grade:         z.preprocess((v) => (v === '' ? null : v), z.string().max(100).optional().nullable()),
  difficulty:    z.preprocess((v) => (v === '' ? undefined : v), DifficultyEnum.default('medium')),
  defaultDegree: z.preprocess((v) => (v === '' ? undefined : v), z.coerce.number().positive().max(1000).default(1)),
  tags:          z.union([z.string(), z.array(z.string())]).optional().transform((v) =>
    (typeof v === 'string' ? v.split(/[،,]/) : v ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 20),
  ),
  /** true = معاينة بس من غير حفظ */
  dryRun:        boolish.default(false),
});

export const ImportTextSchema = ImportOptionsSchema.extend({
  text: z.string().min(3, 'الصق الأسئلة الأول').max(200_000, 'النص كبير جداً — قسّمه على مرتين'),
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
export type BlueprintRowDto   = z.infer<typeof BlueprintRowSchema>;
export type ImportOptionsDto  = z.infer<typeof ImportOptionsSchema>;
