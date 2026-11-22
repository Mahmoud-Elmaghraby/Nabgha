-- Migration 014: add notify_absence_excused toggle to wa_settings.
-- Controls whether the ABSENCE_EXCUSED WhatsApp notification is sent
-- when a student's absence is excused via a makeup/compensation session.

ALTER TABLE wa_settings
  ADD COLUMN IF NOT EXISTS notify_absence_excused BOOLEAN NOT NULL DEFAULT true;
