# 🐛 ISSUES — مشاكل مشروع نابغة

> آخر تحديث: 2026-11-22
> تم الكشف عنها بالمراجعة الكاملة للكود (Code Review)

---

## 🔴 مشاكل حرجة (Critical)

---

### [AUTH-001] 🔴 تعليق صفحة اللوجين عند إدخال بيانات غلط ✅ **تم الإصلاح**

**الموديول:** `auth` — Frontend  
**الملف:** `apps/web/src/shared/lib/api/client.ts`  
**الحالة:** ✅ مُصلَح في 2026-11-14

**الوصف:**  
لما المستخدم يدخل username أو password غلط، السيرفر بيرجع `401 Unauthorized`.  
الـ Axios interceptor كان بيمسك الـ 401 ده ويحاول يعمل **token refresh** بدل ما يرجع الخطأ للمستخدم.

**نتيجة البق:**
- لو مفيش refreshToken محفوظ → `forceLogout()` بيتستدعى → redirect لصفحة اللوجين → reload (وهو عليها خلال!)
- لو في refreshToken قديم محفوظ → بيحاول يجدده → يفشل → `forceLogout()` → reload
- **النتيجة:** الصفحة بتعيد تحميل نفسها أو تتعلق بدون أي رسالة خطأ

**الإصلاح:**
```typescript
// client.ts — إضافة استثناء لـ auth endpoints
const isAuthEndpoint =
  original.url?.includes('/auth/login') ||
  original.url?.includes('/auth/refresh') ||
  original.url?.includes('/platform/auth/login');

if (isAuthEndpoint) {
  if (original.url?.includes('/auth/refresh')) forceLogout();
  return Promise.reject(error);
}
```

---

### [AUTH-002] 🔴 `AppError.unauthorized` — ترتيب المعاملات مقلوب في `teachers` ✅ **تم الإصلاح**

**الموديول:** `teachers` — Backend  
**الملف:** `apps/api/src/modules/teachers/application/use-cases/teacher.usecase.ts`  
**السطور:** 17، 27، 35

**الوصف:**  
`AppError` signature: `new AppError(code, message, statusCode)`  
لكن في `teacher.usecase.ts`:
```typescript
// غلط ❌
throw new AppError('المدرس غير موجود', 'NOT_FOUND', 404);
//                   ^ message          ^ code

// صح ✅ (زي باقي الموديولات)
throw new AppError('NOT_FOUND', 'المدرس غير موجود', 404);
```
**النتيجة:** الـ `code` في response بيطلع `"المدرس غير موجود"` والـ `message` بيطلع `"NOT_FOUND"` — العكس.

**الإصلاح:** عكس ترتيب المعاملات في السطور 17، 27، 35.

---

### [AUTH-003] 🔴 `initDesktopSetup` — Raw SQL بدون Migrations ✅ **تم الإصلاح**

**الموديول:** `auth` — Backend  
**الملف:** `apps/api/src/modules/auth/auth.service.ts` (السطور 59–103)

**الوصف:**  
الـ Desktop setup بيخلق جداول `users`, `center_settings`, `tenant_settings` بـ SQL يدوي منفصل تماماً عن نظام الـ migrations في `packages/db/src/migrations/tenant/`.  
لو أي migration جديدة أضافت عمود جديد → الـ Desktop clients الجدد مش هياخدوه.

**الإصلاح:** خلي `initDesktopSetup` يشغّل الـ migration runner الموجود بدل كتابة SQL يدوي.

---

### [AUTH-004] 🔴 `initDesktopSetup` — بدون Validation ✅ **تم الإصلاح**

**الموديول:** `auth` — Backend  
**الملف:** `apps/api/src/modules/auth/auth.service.ts` (السطر 29)

**الوصف:**
```typescript
const bcrypt = require('bcrypt');  // import مكرر + غير ضروري
// لو data.password جالت undefined:
const passwordHash = await bcrypt.hash(undefined, 10);  // ← crash أو hash غلط
```
**الإصلاح:** زود Zod schema في `auth.controller.ts` على endpoint `POST /auth/setup/init`.

---

## 🟡 مشاكل متوسطة (Medium)

---

### [AUTH-005] 🟡 Logout Server-side لا يبطل التوكن

**الموديول:** `auth` — Backend  
**الملف:** `apps/api/src/modules/auth/auth.controller.ts` (السطر 79)

**الوصف:**
```typescript
async logout() {
  return { success: true };  // ← مافيش حاجة بتحصل على السيرفر
}
```
بعد الـ logout، الـ Access Token لسه صالح لـ 8 ساعات.

**الإصلاح:** Redis Blocklist — احفظ الـ token ID (`jti`) في Redis حتى وقت انتهائه.

---

### [AUTH-006] 🟡 Refresh Token Rotation مش موجود ✅ **تم الإصلاح**

**الموديول:** `auth` — Backend  
**الملف:** `apps/api/src/modules/auth/auth.service.ts` (السطر 158–176)

**الوصف:**  
`refreshToken` endpoint بيرجع `accessToken` جديد بس.  
الـ `refreshToken` القديم بيفضل صالح لـ 30 يوم.

**الإصلاح:** ارجع `refreshToken` جديد وابطل القديم (Rotation).

---

### [AUTH-007] 🟡 Tokens في `localStorage` — عرضة لـ XSS

**الموديول:** `auth` — Frontend  
**الملف:** `apps/web/src/shared/stores/auth.store.ts`

**الوصف:**
```typescript
localStorage.setItem('accessToken', accessToken);
localStorage.setItem('refreshToken', refreshToken);
```
**ملاحظة:** في Desktop mode (Electron) الخطر محدود — لكن لو النظام شغال على web server عام ده نقطة ضعف.

**الإصلاح:** `accessToken` في memory + `refreshToken` في HttpOnly Cookie.

---

### [AUTH-008] 🟡 `tenantId: null` مع Cast غير آمن في Platform Login ✅ **تم الإصلاح**

**الموديول:** `auth` — Backend  
**الملف:** `apps/api/src/modules/auth/auth.service.ts` (السطر 151)

**الوصف:**
```typescript
const payload = { tenantId: null as unknown as string, ... };
```
أي guard يافرض `user.tenantId` من غير تحقق ممكن يتعطل.

---

### [FINANCE-001] 🟡 DB Corruption — `invalid page in block`

**الموديول:** `finance` — Infrastructure  
**الملف:** `apps/api/src/modules/finance/application/use-cases/finance.usecase.ts` (السطر 543)

**الوصف:**  
الرسالة `فشل تحصيل الفاتورة رقم 1 من 1: invalid page in block 42...` ظهرت عند مدرس.  
المشكلة **مش في الكود** — الكود سليم. المشكلة في تلف (Corruption) في ملفات PostgreSQL على الديسك.

**السبب المحتمل:** انقطاع كهرباء مفاجئ أو مشكلة في الهارد.

**الحل:** على مسؤول IT — `REINDEX TABLE` / `VACUUM FULL` أو استرجاع Backup.

---

### [SESSIONS-001] 🟡 `pendingAttendanceNotifications` Map — Memory Leak محتمل

**الموديول:** `sessions` — Backend  
**الملف:** `apps/api/src/modules/sessions/application/use-cases/session.usecase.ts` (السطر 702)

**الوصف:**
```typescript
private readonly pendingAttendanceNotifications = new Map<string, NodeJS.Timeout>();
```
الـ Map بتكبر مع كل حصة وطالب. لو السيرفر شغال لفترة طويلة مع عدد كبير من الطلاب والحصص، ممكن يراكم timers كتير في الميموري.

**ملاحظة:** `timer.unref()` موجود، لكن المفاتيح (keys) نفسها بتفضل في الـ Map.

**الإصلاح:** تأكد إن الـ key بيتمسح من الـ Map حتى لو حصل استثناء — الكود الحالي بيمسحه في بداية الـ callback بس.

---

### [GROUPS-001] 🟡 حذف مجموعة بدون التحقق من وجود طلاب ✅ **تم الإصلاح**

**الموديول:** `groups` — Backend  
**الملف:** `apps/api/src/modules/groups/application/use-cases/group.usecase.ts` (السطر 51)

**الوصف:**
```typescript
async delete(tenantId: string, id: string): Promise<void> {
  const group = await this.repo.findById(tenantId, id);
  if (!group) throw new AppError('NOT_FOUND', 'المجموعة غير موجودة', 404);
  group.softDelete();
  await this.repo.save(tenantId, group);
  // ← مفيش تحقق من وجود طلاب مسجلين أو حصص مرتبطة!
}
```
بالمقارنة، `students.delete` بيتحقق من المجموعات والمدفوعات والحضور قبل الحذف.

**الإصلاح:** زود تحقق من وجود طلاب نشطين أو حصص غير منتهية قبل الـ soft delete.

---

## 🟢 ملاحظات بسيطة (Low)

---

### [AUTH-009] 🟢 Default expiry متعارض بين `auth.module.ts` والـ `auth.service.ts` ✅ **تم الإصلاح**

**الموديول:** `auth` — Backend

```typescript
// auth.module.ts
signOptions: { expiresIn: '15m' }  // ← غير مستخدم فعلياً

// auth.service.ts
return this.config.get('JWT_ACCESS_EXPIRY') || '8h';  // ← الفعلي
```
**الإصلاح:** احذف `signOptions` من `auth.module.ts` أو وحّدهم.

---

### [AUTH-010] 🟢 `bcrypt` Import مكرر ✅ **تم الإصلاح**

**الموديول:** `auth` — Backend  
**الملف:** `apps/api/src/modules/auth/auth.service.ts`

```typescript
import * as bcrypt from 'bcrypt';        // السطر 7 — import عادي
const bcrypt = require('bcrypt');         // السطر 29 — داخل function! مش محتاجه
```
**الإصلاح:** احذف `require('bcrypt')` من جوّا `initDesktopSetup`.

---

### [STUDENTS-001] 🟢 `getAttendance` بترجع كل السجلات بدون Pagination

**الموديول:** `students` — Backend  
**الملف:** `apps/api/src/modules/students/application/use-cases/student.usecase.ts` (السطر 107)

**الوصف:**  
لو الطالب عنده سجل حضور كبير (سنتين+ من الحصص) → response كبير جداً.

**الإصلاح:** زود `limit`/`offset` أو حدد آخر N حصة.

---

### [SESSIONS-002] 🟢 `autoTransitionSessions` كود معطّل محفوظ

**الموديول:** `sessions` — Backend  
**الملف:** `apps/api/src/modules/sessions/application/use-cases/session.usecase.ts` (السطر 98)

```typescript
// @Cron(CronExpression.EVERY_MINUTE)  ← معطّل
async autoTransitionSessions()
```
الكود الميت موجود بشكل واضح ومُعلّق عليه، لكن الـ function نفسها محتفظ بيها.  
**اقتراح:** لو مش هنستخدمها → احذفها لتنظيف الكود.

---

## 🔍 مراجعة Finance (2026-11-22) — اتصلحت كلها

| الـ ID | الأولوية | المشكلة | الإصلاح |
|---|---|---|---|
| FIN-002 | 🔴 | تعديل مبلغ مصروف أو حذفه مكانش بيرجّع/يخصم الفرق من الخزينة — رصيد الخزينة بيفضل غلط من غير أي حركة تفسّره | transaction + قيد جديد `expense_reversal` (migration 025) + ملخص الخزينة بيحسب المصروفات الصافية |
| FIN-003 | 🔴 | توليد فواتير الشهر بيشتغل الساعة 12 بالليل يوم 1 بس — لو الجهاز مقفول ساعتها (الطبيعي) الفواتير مابتتولدش | فحص كل ساعة + بعد التشغيل بدقيقة، مرة واحدة لكل شهر لكل مركز (`finance_auto_dues_last_month`) |
| FIN-004 | 🟡 | تذكيرات الدفع بتتبعت الساعة 10 الصبح بس — لو الجهاز مقفول ماتتبعتش | كل ساعة من 10 لـ 8 بالليل، والتكرار ممنوع بـ `alreadyNotified` |
| FIN-005 | 🟡 | التوليد المتزامن (يدوي + تلقائي) ممكن يوقع في النص بخطأ unique | `INSERT ... ON CONFLICT DO NOTHING` واستعلام واحد بدل اتنين لكل طالب |
| FIN-006 | 🟡 | تعديل فاتورة ممكن يخلي المطلوب أقل من المدفوع (فلوس زيادة مش متسجلة)، أو خصم أكبر من المبلغ، أو تعديل فاتورة معفاة/ملغاة | validation في `updateAmount` + منع تعديل المعفاة والملغاة + نفس الحماية في مزامنة خصم المجموعة |
| FIN-007 | 🟡 | إحصائيات الشهر: "المتبقي" = المستحق − المحصّل، فالمدفوع على فاتورة معفاة كان بيقلل المتبقي غلط، و"غير المدفوع" كان بيعد المعفاة | حساب المتبقي والأعداد من حالة كل فاتورة مباشرة |
| FIN-008 | 🟢 | كسور عشرية في الأرصدة (0.1 + 0.2) | `roundMoney` في كل عمليات الخزينة والفواتير |
| FIN-009 | 🟢 | `debit()` بيرمي Error عادي → المستخدم يشوف "Internal server error" | AppError برسالة واضحة |
| FIN-010 | 🟢 | `/finance/stats` من غير شهر بيوقع السيرفر | الشهر الحالي افتراضيًا |
| FIN-011 | 🟢 | الملف المالي للطالب بيحسب الفواتير المعفاة في إجمالي المستحق | استبعادها زي إحصائيات المالية |
| CORE-001 | 🟡 | أي UUID غلط في الرابط أو تكرار أو بيانات مرتبطة → "Internal server error" | `GlobalExceptionFilter` بيترجم أخطاء PostgreSQL لرسائل عربي واضحة (400/409)، وتلف قاعدة البيانات (XX001) برسالة "اتصل بالدعم" |

## 🔍 مراجعة الحصص والحضور + رصيد التعويض (2026-11-22)

نظام رصيد التعويض اتعاد بناؤه (`AttendanceCreditService` + migration 026) واتجرب على PostgreSQL حقيقي بـ 15 سيناريو (23 فحص كلهم نجحوا).

| الـ ID | الأولوية | المشكلة | الإصلاح |
|---|---|---|---|
| ATT-001 | 🔴 | حضور بديل قبل حصة الطالب كان بيعذر غياب "افتراضي" في حصة لسه ماحصلتش | الغياب بيتعذر بس في حصة حصلت فعلاً (منتهية، أو يومها عدّى واتاخد فيها حضور) |
| ATT-002 | 🔴 | غياب معذور اتعدّل لحاضر → الرصيد بيضيع | الرصيد بيرجع متاح ويدوّر على غياب تاني |
| ATT-003 | 🔴 | طالب بديل اتسجل غايب (مسح بالغلط) → كان بيتعذر برصيده هو نفسه، والغياب الأصلي يفضل معذور | البديل بيتشال من الحصة، رصيده يتلغي، والغياب يرجع (إلا لو فيه رصيد تاني) |
| ATT-004 | 🟡 | إلغاء/مسح حصة مكانش بيأثر على الأرصدة المرتبطة بيها | الأرصدة بتترتب من جديد تلقائي |
| ATT-005 | 🟡 | لو المدرّس مابيدوسش "إنهاء"، الرصيد اللي اتعمل قبل الغياب عمره ما بيتصرف | مطابقة يومية (مرة في اليوم) |
| ATT-006 | 🟡 | حصص يوم الجمعة برة حساب الأسبوع | الأسبوع من السبت للجمعة |
| ATT-007 | 🟡 | التسجيل الجماعي ومسح الـ QR مابيطبقوش قواعد الرصيد خالص | كل تغيير حالة بيعدّي من `changeStatus` واحدة |
| ATT-008 | 🟡 | سباق: حصتين بيتقفلوا في نفس اللحظة ممكن يصرفوا نفس الرصيد مرتين | صرف ذرّي (`FOR UPDATE SKIP LOCKED`) في transaction |
| ATT-009 | 🟡 | رسالة "غياب معذور" كانت بتتبعت بتاريخ ومادة حصة البديل مش حصة الغياب | بتتبعت ببيانات حصة الغياب |
| ATT-010 | 🟢 | الطالب البديل مابيوصلش لولي أمره رسالة "حضر" | بتتبعت زي أي حضور |
| ATT-011 | 🔴 | رسالة "3 غيابات متتالية" عمرها ما اتبعتت: الاستعلام كان SQL خام من غير schema المركز فبيفشل | subquery من الـ query builder + `getTenantSchema()` لأي SQL خام |
| ATT-012 | 🟡 | الدرجة صفر كانت بتتقري "مارتصدتش" (مابتظهرش ومابتتبعتش) | قراية صحيحة للصفر |
| DB-001 | 🟡 | migration 024 (بنك الأسئلة) بتعمل GRANT لـ role اسمه `nabgha` ثابت — بتفشل على أي سيرفر باسم مستخدم مختلف (LAN/SaaS) | **لسه مفتوحة** — محتاجة تتعدل قبل أي نشر LAN/SaaS |

---

## 🔍 مراجعة تسجيل الدخول والجلسات (2026-11-22)

| الـ ID | الأولوية | المشكلة | الإصلاح |
|---|---|---|---|
| AUTH-011 | 🔴 | رسائل الدخول كانت بتظهر كود إنجليزي (`TENANT_NOT_FOUND`) بدل الرسالة العربي — ترتيب معاملات `AppError.unauthorized` مقلوب في 6 أماكن | اتصلح الترتيب + رسائل أوضح |
| AUTH-012 | 🔴 | الـ refresh token (30 يوم) كان نفس شكل الـ access token، فينفع يتستخدم مباشرة للدخول على الـ API | `tokenUse: 'refresh'` والـ strategies بترفضه |
| AUTH-013 | 🔴 | التجديد مابيراجعش قاعدة البيانات: مستخدم اتوقف أو مركز اتقفل بيفضل شغال 30 يوم، وتعديل الصلاحيات مابيتطبقش غير بعد خروج ودخول | التجديد بيقرا المستخدم والمركز والصلاحيات من جديد كل مرة |
| AUTH-014 | 🟡 | تجديد جلسة لوحة المنصة كان بيستخدم سر المراكز، فأدمن المنصة بيطلع برة كل 8 ساعات | كل نوع توكن بيتجدد بالسر بتاعه |
| AUTH-015 | 🟡 | كود المركز بحروف كابيتال أو مسافة (Tcronix) بيترفض | توحيد الكود (trim + lowercase) في السيرفر والواجهة، والإيميل في دخول المنصة |
| AUTH-016 | 🟡 | صفحة دخول المنصة: باسورد غلط كان بيحاول refresh ويطلّع المستخدم بدل ما يوريه الرسالة | استثناء `/auth/platform/login` في الـ interceptor |
| AUTH-017 | 🟢 | سرعة الرد بتكشف إذا كان اسم المستخدم موجود | مقارنة bcrypt دايمًا (hash وهمي لما المستخدم مش موجود) |
| AUTH-006 | 🟡 | (موجودة قبل كده) مفيش rotation | التجديد بيرجع refresh token جديد والواجهة بتحفظه |

⚠️ بعد النشر: أي حد مسجّل دخول قبل التحديث هيحتاج يسجّل دخول مرة واحدة لما توكن الدخول بتاعه يخلص (الـ refresh tokens القديمة مالهاش العلامة الجديدة).
ℹ️ AUTH-005 (الخروج مابيبطّلش التوكن على السيرفر) و AUTH-007 (التوكنات في localStorage) لسه مفتوحين.

---

## 🧹 جودة — اتكشفت أثناء المراجعة

- **WEB-TS-001:** الواجهة فيها 92 خطأ TypeScript قديم (الـ build بيعدّي لإن Vite مش بيعمل type-check). أمثلة: `useWhatsapp.ts` بيقرا `.data` من أنواع مش فيها `.data`، و`import.meta.env` من غير `vite-env.d.ts`. محتاجين يتصلحوا قبل ما نشغّل type-check في CI.

---

## 📊 ملخص

| الأولوية | العدد | الموديولات المتأثرة |
|----------|-------|---------------------|
| 🔴 حرجة | 4 | auth، teachers |
| 🟡 متوسطة | 6 | auth، finance، sessions، groups |
| 🟢 بسيطة | 4 | auth، students، sessions |
| **المجموع** | **14** | |

---

## ✅ تم إصلاحه

| الـ ID | الوصف | التاريخ |
|--------|-------|---------|
| AUTH-001 | تعليق صفحة اللوجين عند بيانات غلط | 2026-11-14 |
| AUTH-002 | ترتيب معاملات `AppError` مقلوب — اتصلح في teachers و platform (20 مكان) | 2026-11-22 |
| AUTH-003 | إعداد Desktop بقى يستخدم نفس الـ migrations عبر `tenant-provisioner.ts` المشترك مع لوحة المنصة | 2026-11-22 |
| AUTH-004 | Zod validation على `/auth/setup/init` + منع تكرار الإعداد لو فيه مركز موجود (409) + throttle | 2026-11-22 |
| AUTH-010 | شيل `require('bcrypt')` و`require('uuid')` و`require('pg')` من `initDesktopSetup` | 2026-11-22 |
| GROUPS-001 | منع حذف مجموعة فيها طلاب نشطين أو حصص مفتوحة + رسالة خطأ ظاهرة في الواجهة | 2026-11-22 |
