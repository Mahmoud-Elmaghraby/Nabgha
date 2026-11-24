# ADR-0003: تطبيق الـ migrations على السيرفر schema بـ schema

- **الحالة:** معتمد
- **التاريخ:** 2026-11-22

## السياق
`migrate.js` بيطبّق كل الـ migrations على كل المراكز اللي في `public.tenants`. على السيرفر فيه مركز قديم اسمه `my-center` معمول من غير سجل migrations، فلو `migrate.js` اشتغل هيحاول يطبّق كل حاجة من 001 عليه، وممكن يفشل في النص ويوقف الباقي.

## القرار
على السيرفر بنطبّق كل migration جديدة بإجراء محدد ([RUNBOOK §4](../operations/DEPLOYMENT_RUNBOOK.md#4-تطبيق-migration-جديدة)):
- لكل schema ليها `schema_migrations`، والـ migration مش متسجّلة فيها.
- جوّه transaction: `SET search_path` ← الملف ← تسجيل الـ version.
الديسكتوب بيفضل يستخدم `migrate.js` مع كل تشغيل.

## النتائج
- ✅ آمن، وممكن يتكرر من غير مشاكل، وكل schema لوحدها.
- ⚠️ إجراء يدوي. لازم يتسجّل في سجل النشر.
- لاحقاً: نصلّح `migrate.js` بحيث يتخطّى أي schema مالهاش سجل، ونرجع نستخدمه.
