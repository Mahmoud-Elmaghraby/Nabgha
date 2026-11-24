-- Migration 024: بنك الأسئلة ومولّد الامتحانات
-- كل مدرس له بنك أسئلة خاص (teacher_id) — الأسئلة مرتبطة بمادة وصف
-- الامتحان (exam) يحتوي على أسئلة (exam_items) مع snapshot من محتوى السؤال
-- وقت الإنشاء عشان لو السؤال الأصلي اتعدّل بعدين الامتحان القديم ميتأثرش.
-- Added: Nov 2026

-- ============================================================
-- 1. EXAM_QUESTIONS — بنك الأسئلة (خاص لكل مدرس)
-- ============================================================
CREATE TABLE IF NOT EXISTS exam_questions (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id       UUID         REFERENCES users(id) ON DELETE SET NULL,

  -- تصنيف
  subject_id       UUID         REFERENCES subjects(id) ON DELETE SET NULL,
  grade            VARCHAR(100),                        -- الصف الدراسي (نفس GRADE_OPTIONS في الفرونت)

  -- نوع السؤال
  type             VARCHAR(20)  NOT NULL
                   CHECK (type IN ('mcq', 'true_false', 'fill', 'essay')),

  -- محتوى السؤال
  question_text    TEXT         NOT NULL,
  image_url        TEXT,                                -- صورة اختيارية مع السؤال (MinIO URL)

  -- الإجابات — للـ MCQ: مصفوفة ["أ) الإسكندرية", "ب) القاهرة", ...]
  --              للـ true_false: null (الإجابة في correct_answer فقط)
  options          JSONB,
  correct_answer   TEXT,                                -- الإجابة الصحيحة (للـ MCQ/true_false/fill)
  model_answer     TEXT,                                -- نموذج الإجابة للمقالي

  -- تصنيف إضافي
  difficulty       VARCHAR(10)  NOT NULL DEFAULT 'medium'
                   CHECK (difficulty IN ('easy', 'medium', 'hard')),
  tags             TEXT[]       NOT NULL DEFAULT '{}',  -- ["الوحدة الأولى", "الفصل الثاني"]
  default_degree   NUMERIC(5,2) NOT NULL DEFAULT 1,

  -- إحصائيات الاستخدام
  times_used       INTEGER      NOT NULL DEFAULT 0,

  -- تتبع
  created_by       UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_exam_questions_teacher   ON exam_questions(teacher_id)  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_exam_questions_subject   ON exam_questions(subject_id)  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_exam_questions_grade     ON exam_questions(grade)       WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_exam_questions_type      ON exam_questions(type)        WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_exam_questions_difficulty ON exam_questions(difficulty) WHERE deleted_at IS NULL;

-- ============================================================
-- 2. EXAMS — الامتحانات المحفوظة
-- ============================================================
CREATE TABLE IF NOT EXISTS exams (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id       UUID         REFERENCES users(id) ON DELETE SET NULL,

  -- بيانات الامتحان
  subject_id       UUID         REFERENCES subjects(id) ON DELETE SET NULL,
  grade            VARCHAR(100),
  title            TEXT         NOT NULL,
  exam_date        DATE,
  duration_mins    INTEGER,                             -- مدة الامتحان بالدقايق
  total_degree     NUMERIC(6,2) NOT NULL DEFAULT 0,    -- المجموع الكلي (بيتحسب تلقائياً)
  instructions     TEXT,                               -- تعليمات للطالب تظهر في الـ PDF

  -- إعدادات تصميم الـ PDF
  -- { header_color, font_family, show_logo, show_student_name,
  --   show_date, show_degree, logo_position, custom_header_text }
  design_config    JSONB        NOT NULL DEFAULT '{
    "header_color": "#0E3B2E",
    "font_family": "Cairo",
    "show_logo": true,
    "show_student_name": true,
    "show_date": true,
    "show_degree": true,
    "logo_position": "right",
    "custom_header_text": null
  }'::jsonb,

  -- حفظ كقالب لإعادة الاستخدام في امتحانات مستقبلية
  is_template      BOOLEAN      NOT NULL DEFAULT false,

  -- تتبع
  created_by       UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_exams_teacher    ON exams(teacher_id)  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_exams_subject    ON exams(subject_id)  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_exams_template   ON exams(is_template) WHERE deleted_at IS NULL AND is_template = true;
CREATE INDEX IF NOT EXISTS idx_exams_date       ON exams(exam_date)   WHERE deleted_at IS NULL;

-- ============================================================
-- 3. EXAM_ITEMS — أسئلة الامتحان (snapshot من السؤال الأصلي)
-- ============================================================
CREATE TABLE IF NOT EXISTS exam_items (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id          UUID         NOT NULL REFERENCES exams(id) ON DELETE CASCADE,

  -- مرجع للسؤال الأصلي في البنك (nullable — لو السؤال اتضاف يدوي مباشرة)
  question_id      UUID         REFERENCES exam_questions(id) ON DELETE SET NULL,

  -- snapshot كامل من محتوى السؤال وقت إنشاء الامتحان
  -- (بيفصل الامتحان عن أي تعديلات مستقبلية على السؤال الأصلي)
  question_text    TEXT         NOT NULL,
  type             VARCHAR(20)  NOT NULL
                   CHECK (type IN ('mcq', 'true_false', 'fill', 'essay')),
  options          JSONB,
  correct_answer   TEXT,
  model_answer     TEXT,
  image_url        TEXT,

  -- درجة السؤال في هذا الامتحان (ممكن تختلف عن default_degree في البنك)
  degree           NUMERIC(5,2) NOT NULL DEFAULT 1,

  -- ترتيب السؤال داخل الامتحان (قابل للسحب والإفلات)
  sort_order       INTEGER      NOT NULL DEFAULT 0,

  -- عنوان القسم (اختياري) — مثل "السؤال الأول: اختيار متعدد"
  section_title    TEXT,

  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exam_items_exam     ON exam_items(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_items_question ON exam_items(question_id);
CREATE INDEX IF NOT EXISTS idx_exam_items_order    ON exam_items(exam_id, sort_order);

-- ============================================================
-- Triggers: updated_at تلقائي
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['exam_questions', 'exams'] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_updated_at ON %I;
       CREATE TRIGGER trg_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION update_updated_at();',
      t, t
    );
  END LOOP;
END $$;

-- ============================================================
-- Function: زيادة times_used لما السؤال يتضاف لامتحان
-- ============================================================
CREATE OR REPLACE FUNCTION increment_question_times_used()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.question_id IS NOT NULL THEN
    UPDATE exam_questions
    SET times_used = times_used + 1
    WHERE id = NEW.question_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_increment_times_used ON exam_items;
CREATE TRIGGER trg_increment_times_used
  AFTER INSERT ON exam_items
  FOR EACH ROW EXECUTE FUNCTION increment_question_times_used();

-- ============================================================
-- Grants
-- ============================================================
-- DB-001 (2026-11-25): الـ GRANT بيتنفّذ بس لو الـ role اللي اسمه nabgha موجود.
-- قبل كده كان بيفشل بـ "role nabgha does not exist" على أي سيرفر بيوزر قاعدة بيانات تاني،
-- وكان بيوقف إنشاء المركز عند 023. على الديسكتوب والسيرفر الحالي (الـ role موجود)
-- السلوك زي ما هو بالظبط. استثناء موثّق من قاعدة "مابنعدّلش migration قديمة": ADR-0011.
DO $$ DECLARE t TEXT; BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nabgha') THEN
    FOREACH t IN ARRAY ARRAY['exam_questions', 'exams', 'exam_items'] LOOP
      EXECUTE format('GRANT ALL ON TABLE %I TO nabgha', t);
    END LOOP;
  END IF;
END $$;
