# اختبارات السيناريوهات (Scenario Tests)

اختبارات بتشغّل كود الـ API الحقيقي (use cases + repositories) على **PostgreSQL حقيقي**،
من غير ما نشغّل NestJS كله. اتكتبت أثناء مراجعات نوفمبر 2026، وكل باج اتصلح ليه هنا اختبار بيمنع رجوعه.

| الملف | بيغطي | العدد |
|---|---|---|
| `wa.check.ts` | توحيد أرقام التليفون، طابور الإرسال والفاصل الزمني، الحد اليومي بعد التسخين | 14 |
| `auth.check.ts` | الـ refresh token منفصل، التجديد بيراجع المستخدم والمركز والصلاحيات، توحيد كود المركز | 11 |
| `exam-pdf-html.check.ts` | الـ escaping في PDF الامتحان، منع حقن CSS، نموذج الإجابة، تضمين الصور | 15 |
| `scan.check.ts` | تصليح كود السكانر (كيبورد عربي، QR قديم JSON، أرقام عربي) + البحث في قاعدة البيانات | 16 |
| `backup.check.ts` | النسخ الاحتياطي: مقفول برّا الديسكتوب، مفعّل افتراضياً، اللحاق بعد ما الجهاز يتقفل، فحص الملف (بايظ / مقطوع)، تسجيل الفشل، نسختين في نفس الوقت، التنضيف. محتاج `pg_dump` و`pg_restore` على الـ PATH | 38 |
| `credits.scenarios.ts` | رصيد التعويض (الحضور البديل): الترتيب، التراجعات، الإلغاء، السباقات، الجمعة | 23 |
| `exams.scenarios.ts` | البنك المشترك، المولّد بالمواصفات، النماذج أ–د، الربط بالحصة، الاستيراد | 52 |

## التشغيل

```bash
# 1) Postgres محلي (أي إصدار 14+) — جهّز database فيها schema اسمها tenant_t بكل الـ migrations
TEST_PG_HOST=localhost TEST_PG_PORT=5432 TEST_PG_USER=postgres TEST_PG_PASSWORD=... \
  bash apps/api/test/scenarios/setup-db.sh

# 2) شغّل كل الاختبارات (من apps/api)
cd apps/api
TEST_PG_HOST=localhost TEST_PG_PORT=5432 TEST_PG_USER=postgres TEST_PG_PASSWORD=... pnpm test:scenarios
```

- متغيرات الاتصال: `TEST_PG_HOST` (افتراضي `/tmp`)، `TEST_PG_PORT` (`5544`)، `TEST_PG_USER` (`postgres`)، `TEST_PG_PASSWORD`، `TEST_PG_DB` (`nabtest`).
- ⚠️ الاختبارات بتعمل `TRUNCATE` لجداول الـ schema `tenant_t` — **ماتشغّلهاش أبداً على قاعدة بيانات فيها بيانات حقيقية.**
- `support/alias.js` بيبدّل `bcrypt` بـ `bcryptjs` و`@prisma/client` بـ stub **لو مش متبنيين** على الجهاز بس.

## قواعد عند إضافة اختبار

1. أي اتصال بيعمل `SET search_path` لازم يعمل `RESET search_path` قبل ما يرجع للـ pool.
   (باج EX-011 اتخبّى شهور عشان الاتصالات كانت بتفضل على schema المركز، والسيرفر الحقيقي شغال على `public`.)
2. استخدم `testPool()` من `support/db.ts` — مافيش بيانات اتصال ثابتة في الكود.
3. اسم الاختبار يوصف السلوك المتوقع بالعربي، والرقم في الآخر `X passed, Y failed` والـ exit code ≠ 0 لو فيه فشل.

## الخطوة الجاية
ربطها بـ CI (GitHub Actions بخدمة Postgres) — راجع `docs/ROADMAP.md` (الجودة).
