-- Migration 003: إضافة UNIQUE constraint ناقص على wa_sessions.tenant_id
-- السبب: الجدول اتعمل من غير الـ constraint ده من الأساس في بعض التنانتات،
-- فكان بيمنع WaSessionRepository.upsert() (ON CONFLICT) من الشغل خالص —
-- بيمنع ربط أي جهاز واتساب جديد. بعض التنانتات القديمة عندها الـ constraint
-- أصلاً، فالـ migration دي idempotent (بتتخطى لو موجود من قبل).
-- Added: July 2026

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'wa_sessions'::regclass
    AND conname = 'wa_sessions_tenant_id_key'
  ) THEN
    ALTER TABLE wa_sessions ADD CONSTRAINT wa_sessions_tenant_id_key UNIQUE (tenant_id);
  END IF;
END $$;
