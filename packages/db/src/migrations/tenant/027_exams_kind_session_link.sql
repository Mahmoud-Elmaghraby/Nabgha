-- Migration 027: الامتحانات — نوع (امتحان / تسميع) + ربط الامتحان بالحصة
-- 1) exams.kind: 'exam' امتحان عادي، 'quiz' تسميع (امتحان قصير مكتوب)
-- 2) sessions.exam_id: الحصة ممكن تتربط بامتحان من البنك، ودرجتها النهائية (out_of)
--    بتتاخد من مجموع الامتحان
-- 3) sessions.out_of بقى NUMERIC عشان مجموع الامتحان ممكن يكون فيه كسور (مثلاً 7.5)
-- Added: Nov 2026

ALTER TABLE exams ADD COLUMN IF NOT EXISTS kind VARCHAR(10) NOT NULL DEFAULT 'exam';
ALTER TABLE exams DROP CONSTRAINT IF EXISTS exams_kind_check;
ALTER TABLE exams ADD CONSTRAINT exams_kind_check CHECK (kind IN ('exam', 'quiz'));
CREATE INDEX IF NOT EXISTS idx_exams_kind ON exams(kind) WHERE deleted_at IS NULL;

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS exam_id UUID REFERENCES exams(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_exam ON sessions(exam_id) WHERE exam_id IS NOT NULL;

ALTER TABLE sessions ALTER COLUMN out_of TYPE NUMERIC(7,2) USING out_of::numeric;
