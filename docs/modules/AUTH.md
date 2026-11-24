# الدخول والجلسات والصلاحيات

> **المسارات:** `apps/api/src/modules/auth` · `apps/api/src/shared/infrastructure/auth/jwt.strategy.ts` · `apps/web/src/shared/lib/api/{client,platform-client}.ts` · **آخر تحديث:** 2026-11-22 (commit `6884ad2`)

## 1. أنواع الدخول

| النوع | Endpoint | التوكن | السر |
|---|---|---|---|
| مستخدم مركز | `POST /auth/login` `{slug, username, password}` | `type: 'tenant'` | `JWT_SECRET` |
| أدمن المنصة | `POST /auth/platform/login` `{email, password}` | `type: 'platform'` | `PLATFORM_JWT_SECRET` |
| تجديد | `POST /auth/refresh` | بيرجّع **access + refresh جداد** | حسب نوع التوكن |

## 2. القواعد
1. **الـ refresh token** فيه `tokenUse: 'refresh'`، والـ strategies بترفضه لو اتستخدم كـ access token (AUTH-012).
2. **التجديد بيراجع قاعدة البيانات** كل مرة: المستخدم لسه نشط، والمركز لسه شغال، والصلاحيات بتتقري من جديد (AUTH-013).
3. **Rotation:** كل تجديد بيرجّع refresh token جديد، والواجهة بتحفظه (AUTH-006).
4. **كل نوع توكن بيتجدد بالسر بتاعه.** أدمن المنصة مابقاش بيطلع برة كل 8 ساعات (AUTH-014).
5. **كود المركز بيتوحّد:** `trim + lowercase` في السيرفر والواجهة، فـ `Tcronix ` زي `tcronix`. وإيميل دخول المنصة كمان (AUTH-015).
6. **وقت الرد ثابت:** مقارنة bcrypt بتحصل دايماً، وبـ hash وهمي لو المستخدم مش موجود، عشان سرعة الرد ماتكشفش إن الاسم موجود (AUTH-017).
7. **الـ interceptor في الواجهة** مايعملش refresh على أخطاء `/auth/login` و`/auth/platform/login` و`/auth/refresh`. الخطأ لازم يتعرض للمستخدم (AUTH-001، AUTH-016).
8. **الرسائل بالعربي:** ترتيب معاملات `AppError` اتصلح في كل الأماكن (AUTH-002، AUTH-011).

## 3. إعداد الديسكتوب لأول مرة
- `POST /auth/setup/init` عليه zod validation وthrottle، وبيرجّع 409 لو فيه مركز موجود بالفعل (AUTH-004).
- إنشاء الـ schema بيستخدم نفس `tenant-provisioner.ts` اللي بتستخدمه لوحة المنصة، يعني نفس الـ migrations (AUTH-003).
- الأسرار الثابتة في `apps/desktop/src/main.ts`: **قرار مقصود من المالك** ([ADR-0002](../adr/0002-fixed-desktop-secrets.md)).

## 4. المفتوح
- **AUTH-005:** الخروج مش بيبطّل التوكن على السيرفر. الحل المقترح blocklist في Redis بالـ `jti`.
- **AUTH-007:** التوكنات متخزنة في localStorage. الحل المقترح: الـ access في الذاكرة، والـ refresh في HttpOnly cookie. الخطر أقل في الديسكتوب.

## 5. ملاحظة نشر
بعد أي تغيير في شكل التوكن، المستخدمين المسجلين قبل التحديث هيحتاجوا يسجّلوا دخول مرة واحدة.

## 6. الاختبارات
`auth.check.ts` (11).
