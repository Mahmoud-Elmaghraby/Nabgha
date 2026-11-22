# 🐛 ISSUES — مشاكل مشروع نابغة

> آخر تحديث: 2026-11-14
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

### [AUTH-002] 🔴 `AppError.unauthorized` — ترتيب المعاملات مقلوب في `teachers`

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

### [AUTH-003] 🔴 `initDesktopSetup` — Raw SQL بدون Migrations

**الموديول:** `auth` — Backend  
**الملف:** `apps/api/src/modules/auth/auth.service.ts` (السطور 59–103)

**الوصف:**  
الـ Desktop setup بيخلق جداول `users`, `center_settings`, `tenant_settings` بـ SQL يدوي منفصل تماماً عن نظام الـ migrations في `packages/db/src/migrations/tenant/`.  
لو أي migration جديدة أضافت عمود جديد → الـ Desktop clients الجدد مش هياخدوه.

**الإصلاح:** خلي `initDesktopSetup` يشغّل الـ migration runner الموجود بدل كتابة SQL يدوي.

---

### [AUTH-004] 🔴 `initDesktopSetup` — بدون Validation

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

### [AUTH-006] 🟡 Refresh Token Rotation مش موجود

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

### [AUTH-008] 🟡 `tenantId: null` مع Cast غير آمن في Platform Login

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

### [GROUPS-001] 🟡 حذف مجموعة بدون التحقق من وجود طلاب

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

### [AUTH-009] 🟢 Default expiry متعارض بين `auth.module.ts` والـ `auth.service.ts`

**الموديول:** `auth` — Backend

```typescript
// auth.module.ts
signOptions: { expiresIn: '15m' }  // ← غير مستخدم فعلياً

// auth.service.ts
return this.config.get('JWT_ACCESS_EXPIRY') || '8h';  // ← الفعلي
```
**الإصلاح:** احذف `signOptions` من `auth.module.ts` أو وحّدهم.

---

### [AUTH-010] 🟢 `bcrypt` Import مكرر

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
