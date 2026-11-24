# ADR-0010: اختبارات سيناريوهات على PostgreSQL حقيقي

- **الحالة:** معتمد
- **التاريخ:** 2026-11-25

## السياق
مفيش اختبارات في المشروع. وأخطر الباجات كانت في الحتة اللي بين الكود وقاعدة البيانات (الـ schemas، وJSONB، وtext[]، والـ triggers، والسباقات)، ودي حاجات الـ mocks مش بتكشفها.

## القرار
- اختبارات في `apps/api/test/scenarios` بتشغّل الـ use cases والـ repositories الحقيقية على schema اسمها `tenant_t` فيها كل الـ migrations.
- بتتشغّل بـ `pnpm test:scenarios`.
- أي اتصال بيعمل `SET search_path` لازم يعمل `RESET` قبل ما يرجع للـ pool.

## النتائج
- ✅ بتكشف باجات حقيقية. لما رجّعنا الـ trigger القديم، `exams.scenarios` وقعت بـ EX-011.
- ⚠️ محتاجة Postgres محلي، ولسه مش في CI (ROADMAP — الجودة).
