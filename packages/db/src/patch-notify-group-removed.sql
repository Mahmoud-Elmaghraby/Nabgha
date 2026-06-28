-- ============================================================
-- سكريبت إصلاح عمود notify_group_removed المفقود
-- شغّله على كل tenant schema
-- ============================================================

-- استبدل YOUR_TENANT_UUID بـ UUID الـ tenant الفعلي
-- أو شغّله على كل الـ schemas بالحلقة في أسفل الملف

-- ======= تشغيل على tenant معين =======
-- SET search_path = tenant_<UUID_WITH_UNDERSCORES>;
-- ALTER TABLE wa_settings ADD COLUMN IF NOT EXISTS notify_group_removed BOOLEAN NOT NULL DEFAULT false;

-- ======= تشغيل على كل الـ tenants =======
DO $$
DECLARE
  tenant_rec RECORD;
  schema_name TEXT;
BEGIN
  FOR tenant_rec IN SELECT id FROM public.tenants LOOP
    schema_name := 'tenant_' || replace(tenant_rec.id::text, '-', '_');
    EXECUTE format(
      'ALTER TABLE %I.wa_settings ADD COLUMN IF NOT EXISTS notify_group_removed BOOLEAN NOT NULL DEFAULT false',
      schema_name
    );
    RAISE NOTICE 'Patched schema: %', schema_name;
  END LOOP;
END $$;

-- ======= تحقق من القيم الحالية =======
-- (شغّل بعد تعيين search_path)
-- SELECT tenant_id, wa_enabled, notify_new_student, notify_group_removed FROM wa_settings;

-- ======= تفعيل واتس آب إذا كان معطلاً =======
-- UPDATE wa_settings SET wa_enabled = true WHERE wa_enabled = false;
