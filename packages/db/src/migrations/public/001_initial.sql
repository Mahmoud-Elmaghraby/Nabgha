-- ============================================================
-- 001_initial.sql — Public Schema Initial Structure + Seed
-- ============================================================
-- ملاحظة: platform admin بيتنشأ من migrate.js مش هنا
-- هذا الملف ينشئ الجداول الأساسية أولاً (إذا لم تكن موجودة)
-- ثم يضيف بيانات الخطط الافتراضية (Plans Seed)
-- ============================================================

-- ============================================================
-- 1. PLANS — خطط الاشتراك
-- ============================================================
CREATE TABLE IF NOT EXISTS public.plans (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  "maxStudents" INTEGER NOT NULL,
  features      JSONB NOT NULL DEFAULT '{}',
  price         INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 2. TENANTS — المراكز
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tenants (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  plan_id     TEXT NOT NULL REFERENCES public.plans(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  limits      JSONB NOT NULL DEFAULT '{}',
  schema_name TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 3. PLATFORM_USERS — مستخدمو لوحة تحكم المنصة
-- ============================================================
CREATE TABLE IF NOT EXISTS public.platform_users (
  id              TEXT PRIMARY KEY,
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  name            TEXT NOT NULL,
  is_super_admin  BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Default Plans Seed
-- ============================================================
INSERT INTO public.plans (id, name, slug, "maxStudents", price, features, created_at, updated_at) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Starter',    'starter',    100,    199, '{"whatsapp":false,"parentPortal":false,"advancedReports":false}', NOW(), NOW()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Pro',        'pro',        500,    499, '{"whatsapp":true,"parentPortal":true,"advancedReports":true}',   NOW(), NOW()),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Enterprise', 'enterprise', 999999, 0,   '{"whatsapp":true,"multiBranch":true,"parentPortal":true,"advancedReports":true}', NOW(), NOW()),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Desktop',    'desktop',    999999, 0,   '{"whatsapp":false,"parentPortal":false,"advancedReports":false}', NOW(), NOW())
ON CONFLICT (slug) DO NOTHING;