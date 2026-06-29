-- ============================================================
-- 001_initial.sql — Public Schema Seed
-- ملاحظة: platform admin بيتنشأ من migrate.js مش هنا
-- ============================================================

-- Default Plans
INSERT INTO public.plans (id, name, slug, "maxStudents", price, features, created_at, updated_at) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Starter',    'starter',    100,    199, '{"whatsapp":false,"parentPortal":false,"advancedReports":false}', NOW(), NOW()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Pro',        'pro',        500,    499, '{"whatsapp":true,"parentPortal":true,"advancedReports":true}',   NOW(), NOW()),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Enterprise', 'enterprise', 999999, 0,   '{"whatsapp":true,"multiBranch":true,"parentPortal":true,"advancedReports":true}', NOW(), NOW()),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Desktop',    'desktop',    999999, 0,   '{"whatsapp":false,"parentPortal":false,"advancedReports":false}', NOW(), NOW())
ON CONFLICT (slug) DO NOTHING;
