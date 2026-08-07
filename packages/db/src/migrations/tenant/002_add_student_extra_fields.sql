-- Migration 002: إضافة العنوان + المدرسة + وظيفة ولي الأمر لجدول الطلاب
-- Added: July 2026

ALTER TABLE students ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS school VARCHAR(255);
ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_occupation VARCHAR(255);
