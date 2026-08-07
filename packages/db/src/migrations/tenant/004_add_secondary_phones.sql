-- Migration 004: إضافة رقم هاتف إضافي (اختياري) لإعدادات المركز وللمدرس
-- Added: July 2026

ALTER TABLE center_settings ADD COLUMN IF NOT EXISTS center_phone_2 VARCHAR(20);
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS phone_2 VARCHAR(20);
