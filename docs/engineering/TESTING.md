# استراتيجية الاختبار

> **الحالة:** معتمد · **آخر تحديث:** 2026-11-25

## 1. الوضع الحالي

| المستوى | الموجود | الأداة |
|---|---|---|
| Type-check للـ API | لازم يعدّي من غير أخطاء جديدة | `pnpm --filter api check-types` |
| Type-check للواجهة | فيه حوالي 84 خطأ قديم (WEB-TS-001)، وممنوع نزوّد عليهم | `npx tsc --noEmit -p apps/web/tsconfig.app.json` |
| Build للواجهة | لازم يعدّي | `pnpm --filter web build` |
| **اختبارات سيناريوهات** على Postgres حقيقي | 8 ملفات، 221 فحص | [`apps/api/test/scenarios`](../../apps/api/test/scenarios/README.md) |
| Unit tests بـ Jest | مفيش فعلياً | — |
| E2E | مفيش | — |
| CI | مفيش | — |

## 2. اختبارات السيناريوهات
الاختبارات دي بتشغّل الـ use cases والـ repositories الحقيقية على schema اسمها `tenant_t`، من غير ما نشغّل NestJS. اتختارت لأن أخطر الباجات اللي لقيناها كانت في الحتة اللي بين الكود وقاعدة البيانات، وده مكان ما الـ mocks بتخبّي المشاكل.

التشغيل:
```bash
bash apps/api/test/scenarios/setup-db.sh   # مرة واحدة، أو بعد أي migration جديدة
cd apps/api && pnpm test:scenarios
```
التفاصيل ومتغيرات الاتصال في [`apps/api/test/scenarios/README.md`](../../apps/api/test/scenarios/README.md).

## 3. متى نختبر إيه (Definition of Done)
أي تعديل مش بيتسلّم قبل:
1. **Type-check** نضيف للـ API، ومفيش أخطاء جديدة في الواجهة.
2. **Build** للواجهة بينجح.
3. لو التعديل فيه **منطق أعمال أو قاعدة بيانات**: سيناريو جديد أو متعدّل في `test/scenarios`، وكل الاختبارات تعدّي.
4. لو فيه **migration**: تتجرّب على schema نضيفة (`setup-db.sh`). ولو بتعدّل بيانات موجودة: تتجرّب كمان على نسخة من بيانات حقيقية.
5. لو التعديل في **الشكل**: screenshot للصفحة على ديسكتوب وموبايل.
6. لو باج: نكتب الاختبار اللي بيفشل **قبل** الإصلاح، وبعدين نصلّح.

## 4. الدروس اللي اتعلمناها
- **الـ connection pool بيخبّي مشاكل الـ schema.** أي helper بيعمل `SET search_path` لازم يعمل `RESET` قبل ما يرجّع الاتصال للـ pool. الـ trigger بتاع EX-011 كان بايظ على السيرفر، والاختبارات كانت ناجحة بسبب كده.
- **الـ PDF والصور:** بنتأكد بعينينا من screenshot (Playwright) قبل ما نقول إن الشكل تمام.
- **الباركود:** أي شكل ليبل جديد لازم يتقري بقارئ فعلي ([zxing](https://github.com/zxing-js/library)) مش بالعين بس. ده اتعمل لكل الأشكال في BAR (QR فوق ويمين وشمال، وCode128).
- **السكانر والكيبورد العربي:** بنحاكي الكتابة بكيبورد عربي (101) بالـ Shift في `scan.check.ts`.

## 5. الخطة (من ROADMAP — الجودة)
1. GitHub Actions: lint + type-check + build + `test:scenarios` بخدمة Postgres، مع كل push.
2. تصفير أخطاء WEB-TS-001 تدريجياً، وبعدين نشغّل type-check في CI للواجهة.
3. Unit tests للحسابات المالية والحاجات الـ pure (التحليل، التطبيع، النماذج).
4. E2E خفيف (Playwright) للمسارات الحرجة: الدخول، الحضور بالسكانر، التحصيل.
