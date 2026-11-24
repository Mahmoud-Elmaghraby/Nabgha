# قواعد الهندسة (Engineering Conventions)

> **الحالة:** معتمد · **آخر تحديث:** 2026-11-25
> كل قاعدة هنا وراها باج حقيقي حصل. رقمه مكتوب جنبها عشان تعرف السبب.

## 1. الـ Backend (NestJS)

| القاعدة | السبب |
|---|---|
| ترتيب `AppError` **دايماً** `new AppError(code, message, status)`. والـ helpers زي `AppError.unauthorized(code, message)`: الكود الأول. | AUTH-002، AUTH-011: الكود الإنجليزي كان بيظهر للمستخدم بدل الرسالة. |
| رسائل الأخطاء للمستخدم بالعربي وواضحة. والـ `code` إنجليزي ثابت (`NOT_FOUND`، `DEGREE_CONFLICT`…). | الواجهة بتعرض `error.message`، وبتعتمد على `error.code` في المنطق. |
| أي endpoint لازم يكون عليه `@RequirePermission(...)`، وإلا الـ `PermissionGuard` مش بيحميه. | عزل الصلاحيات. |
| الـ validation بـ zod في الـ controller (`safeParse`) وبيرجّع `VALIDATION_ERROR` 400. | — |
| `teacherId = req.user.sub` معناه **المستخدم اللي عامل الطلب**، مش "صاحب البيانات". ماتفلترش بيه بيانات المفروض تبقى مشتركة. | EX-001: المساعد مكانش بيشوف بنك المدرس. |
| أي إرسال جماعي أو شغل طويل يتعمل **fire-and-forget job** مع حالة في قاعدة البيانات، مش جوّه الـ request. | — |
| أي مهمة دورية تبقى idempotent وتستحمل إن الجهاز يكون مقفول وقت موعدها. | FIN-003، FIN-004. |
| الفلوس تتقرّب بـ `roundMoney` في أي عملية. | FIN-008. |

## 2. قاعدة البيانات

### 2.1 الـ tenant schema — أهم قاعدة في المشروع
الاتصال بقاعدة البيانات شغال على `search_path = public`.
`getTenantDb(tenantId)` بيضيف اسم الـ schema **لأي جدول في الـ query builder بس**.

| الحالة | الصح | الغلط |
|---|---|---|
| query عادي | `db.selectFrom('students')…` | — |
| subquery | `eb.exists(eb.selectFrom('exam_items as ei')…)` | `sql\`EXISTS (SELECT 1 FROM exam_items …)\`` ← ATT-011 |
| SQL خام لازم | `SET LOCAL search_path` بقيمة `kysely.getTenantSchema(tenantId)` جوّه transaction | جدول من غير schema |
| أعمدة في `sql\`\`` | `sql\`q.tags && ${tags}::text[]\`` (الأعمدة مفيهاش مشكلة) | — |
| **دوال plpgsql / triggers** | `EXECUTE format('UPDATE %I.exam_questions …', TG_TABLE_SCHEMA)` | `UPDATE exam_questions …` ← **EX-011** |

### 2.2 أنواع البيانات مع `pg`

| الحالة | القاعدة | السبب |
|---|---|---|
| عمود **JSONB** وقيمته array | `JSON.stringify(value)` (الـ helper `toJsonb` في `exam.repository.ts`) | الـ driver بيحوّل الـ array لـ `{"a","b"}` وده JSON غلط ← **EX-009** |
| عمود **text[]** في شرط | ابعت array JS عادي: `${tags}::text[]` | `JSON.stringify` بيطلع `'["x"]'` وده مش array literal ← EX-010 |
| UUID | `sql<string>\`${id}::uuid\`` | — |
| فلوس/درجات بكسور | `NUMERIC`، وتتقري بـ `Number(row.x)` | `out_of` اتحوّل لـ NUMERIC في 027 |
| صفر | `row.x !== null && row.x !== undefined ? Number(row.x) : null` | ATT-012: الدرجة صفر كانت بتتقري "مش متسجلة" |

### 2.3 الـ Migrations
- ملف جديد بالرقم اللي بعده: `packages/db/src/migrations/tenant/NNN_snake_case.sql`. **مابنعدّلش migration قديمة أبداً.**
- أول الملف: تعليق بالعربي بيقول بيعمل إيه وليه، والتاريخ.
- لازم تبقى idempotent: `IF NOT EXISTS`، و`DROP CONSTRAINT IF EXISTS` قبل `ADD CONSTRAINT`، و`ON CONFLICT DO NOTHING`.
- ممنوع `GRANT` لاسم role ثابت (DB-001).
- ممنوع حذف عمود مباشرة. الخطوات: نبطّل استخدامه، وبعد إصدار أو اتنين نحذفه في migration لوحدها.
- حدّث `packages/db/src/kysely-types.ts` في نفس الـ commit.
- اختبرها على schema نضيفة (`setup-db.sh`) **وعلى نسخة من بيانات حقيقية** قبل النشر.
- النشر على السيرفر بالإجراء اللي في [RUNBOOK §4](../operations/DEPLOYMENT_RUNBOOK.md#4-تطبيق-migration-جديدة).

## 3. الـ Frontend
- الـ server state كله بـ React Query، وأي mutation بتعمل invalidate للـ keys المتأثرة.
- كل الأرقام والتواريخ اللي بتظهر للمستخدم بالعربي، وعرض الكود (`STU-00012`) بـ `dir="ltr"` و`font-mono`.
- **إدخال السكانر:** أي input بيستقبل كود لازم يعدّي على `normaliseScannerInput`، والسيرفر كمان بيعمل `normalizeScannedCode` (BAR-001).
- **روابط الصور** اللي راجعة من السيرفر (`/storage/...`) بتتعرض بـ `getFullMediaUrl()`.
- **localStorage** للتفضيلات على مستوى الجهاز بس (مقاس الليبل، شكل الطباعة…)، ودايماً جوّه `try/catch`.
- ماتزوّدش أخطاء TypeScript جديدة. الأساس الحالي حوالي 84 خطأ (WEB-TS-001).

## 4. الأمان
- أي نص جاي من المستخدم وداخل في HTML بيتولّد على السيرفر (PDF مثلاً) يعدّي على `esc()`، والألوان تتقبل hex بس (EX-002).
- Puppeteer مايفتحش أي رابط خارجي: `renderHtml()` بتمنع أي طلب غير `data:`.
- أي ملف بيترفع: نتحقق من النوع والـ magic bytes والحجم (`validateAndUploadImage`).
- مفيش أسرار في git. مكانها `docs/CREDENTIALS.local.md` على الجهاز بس.
- **المركز التجريبي أرقامه وهمية، وممنوع نوصّل عليه واتساب حقيقي.**
- **السيرفر عليه مشاريع تانية** (منها العيادة اللي فيها ملفات مرضى). أي أمر بيلمس `nabgha` بس، وممنوع نغيّر nginx العام أو Docker العام أو حاجة تخص مشروع تاني.

## 5. Git
- **الفروع:** `main` مستقر، والشغل الحالي على `fix/phase1-stability`. أي مرحلة كبيرة ليها branch.
- **رسالة الـ commit:** بصيغة Conventional Commits بالإنجليزي:
  - `type(scope): وصف قصير`. الـ types: `feat`، `fix`، `perf`، `docs`، `chore`، `refactor`، `test`.
  - بعدها bullets بالتفاصيل لو محتاج.
  - مثال: `fix(barcode): Arabic-layout scanners, keep late status, unified QR`
- **commit واحد لكل إصلاح منطقي**، ومعاه تحديث `ISSUES.md` و`CHANGELOG.md`.
- line endings: LF في الريبو (`.gitattributes`). تحذيرات CRLF على ويندوز عادية.
- **build مرة واحدة في آخر كل مرحلة**، مش بعد كل تعديل (طلب المالك).

## 6. اللغة والنصوص
- الواجهة كلها عربي مصري واضح، وأي رسالة للمستخدم بتقوله إيه اللي حصل وإيه المفروض يعمل.
- التعليقات في الكود بالعربي، وبتشرح **ليه** مش **إيه**، وخصوصاً لما يكون فيه فخ اتعلمناه (اكتب رقم المشكلة).
