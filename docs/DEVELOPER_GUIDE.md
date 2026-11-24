# نبغة — Developer Guide
> ⚠️ **مرجع قديم (Legacy):** الملف ده بيتحفظ عشان التفاصيل التاريخية. **المرجع الرسمي الحالي:** [`docs/README.md`](README.md) ← القواعد: [`engineering/CONVENTIONS.md`](engineering/CONVENTIONS.md) · النشر: [`operations/DEPLOYMENT_RUNBOOK.md`](operations/DEPLOYMENT_RUNBOOK.md).
> لو فيه اختلاف بين الملف ده والتوثيق الجديد أو الكود، **الجديد والكود هما الصح**.

> **الإصدار:** 4.2 — August 24, 2026 (دمج اكتشافات Session #030: Parent Portal + إصلاحات أمنية حرجة + دليل تشخيص الشبكة)
> **الجمهور:** Developer جديد + Reference سريع + AI Tools

---

## 📖 فهرس المحتويات

1. [ما هو نبغة؟](#1-ما-هو-نبغة)
2. [البيئة والمتطلبات](#2-البيئة-والمتطلبات)
3. [تشغيل المشروع](#3-تشغيل-المشروع)
4. [المعمارية العامة](#4-المعمارية-العامة)
5. [قواعد الكود — Backend](#5-قواعد-الكود--backend)
6. [قواعد الكود — Frontend](#6-قواعد-الكود--frontend)
7. [Database Schema](#7-database-schema)
8. [Migration System](#8-migration-system)
9. [Platform Admin Module](#9-platform-admin-module)
10. [WhatsApp Module](#10-whatsapp-module)
11. [Telegram Module](#11-telegram-module)
12. [Upload Module](#12-upload-module)
13. [Auth & RBAC](#13-auth--rbac)
14. [Desktop Mode (Electron)](#14-desktop-mode-electron)
15. [Windows Installer](#15-windows-installer)
16. [الـ Modules الموجودة](#16-الـ-modules-الموجودة)
17. [أوامر مهمة](#17-أوامر-مهمة)
18. [بيانات التجربة](#18-بيانات-التجربة)
19. [مشاكل شائعة وحلولها](#19-مشاكل-شائعة-وحلولها)
20. [قرارات معمارية مهمة](#20-قرارات-معمارية-مهمة)

---

## 1. ما هو نبغة؟

نبغة هو **نظام إدارة مراكز التعليم الخصوصي**. يساعد المراكز على إدارة:
- الطلاب والمجموعات والحصص
- الحضور والغياب
- المدفوعات والإيصالات
- إشعارات الواتساب والتليجرام لأولياء الأمور
- طباعة الباركود والكروت الشخصية للطلاب
- متابعة ولي الأمر لبيانات ابنه مباشرة (Parent Portal — LAN/SaaS فقط، راجع قسم 11)

**أوضاع النشر:**
- **LAN Mode:** خادم Linux في المركز + nginx + Docker
- **Desktop Mode:** Windows + Electron + **PostgreSQL محلي حقيقي** (مش SQLite — راجع قسم 14، Multi-tenant مفعل بنفس آلية Schema per Tenant). Parent Portal معطّلة بالكامل في هذا الوضع.

---

## 2. البيئة والمتطلبات

### Linux (بيئة التطوير)
```
Node.js     v20+
pnpm        v10+
Docker      (PostgreSQL + Redis + MinIO)
mkcert      (HTTPS على LAN)
nginx       (reverse proxy)
```

### Windows (بيئة العميل)
```
Node.js     v20+ (مثبت بأي طريقة — installer رسمي أو nvm4w)
PostgreSQL  v16+ (port 5432)
NSIS        v3.x (للـ installer فقط — من Admin cmd)
```

### الـ Ports (Linux)
| Service | Port | ملاحظة |
|---------|------|--------|
| nginx HTTPS | **443** | entry point |
| Backend (NestJS) | 3001 | nginx proxy |
| PostgreSQL | **5433** | تعارض مع lexos |
| Redis | **6380** | |
| MinIO API | 9002 | nginx proxy |

### الـ Ports (Windows Desktop)
| Service | Port |
|---------|------|
| NestJS | 3001 |
| PostgreSQL | 5432 |

---

## 3. تشغيل المشروع

### Linux — الطريقة السريعة (يومية)
```bash
bash ~/Downloads/nabgha/start.sh
```

### Linux — التشغيل يدوياً
```bash
docker compose -f infra/docker/docker-compose.yml up -d
cd packages/db && node src/migrate.js
cd apps/api && npx nest build
nohup node dist/main.js > /tmp/nabgha-api.log 2>&1 &
pnpm --filter web build
sudo systemctl restart nginx
```

### Windows — تشغيل dev
```cmd
cd M:\Projects\Nabgha\apps\api
set STATIC_PATH=M:\Projects\Nabgha\apps\web\dist&& set DEPLOY_MODE=desktop&& set DATABASE_URL=postgresql://nabgha:nabgha123@localhost:5432/nabgha&& set JWT_SECRET=<JWT_SECRET>&& set PLATFORM_JWT_SECRET=<PLATFORM_JWT_SECRET>&& set MULTI_TENANT=true&& set ALLOW_NETWORK=true&& node dist/main.js

cd M:\Projects\Nabgha\apps\desktop && npm run dev
```
> ⚠️ استخدم `npm run dev` (بيعمل `tsc && electron dist/main.js` بنسخة Electron الخاصة بالمشروع نفسه) **مش** `npx electron dist/main.js` مباشرة — الأخيرة بتتجاهل `node_modules` المحلي وممكن تحاول تنزّل نسخة Electron تانية غير متعلقة بالمشروع خالص.

### ⚠️ قواعد تشغيل مهمة
- **لا تستخدم** `pnpm start:dev` — استخدم `npx nest build && node dist/main.js`
- الـ Frontend static build على nginx — مش Vite dev server
- Windows: `set VAR=VALUE&&` بدون space قبل `&&`
- Windows cmd: `cd` من جهة لمسار على درايف تاني **لا يبدّل الدرايف الفعلي** — استخدم `cd /d <path>` دايماً لو المسار على درايف مختلف عن الحالي (مثلاً من `C:\...` لـ `M:\...`)

---

## 4. المعمارية العامة

```
Browser / Mobile
    ↓ HTTPS :443
nginx
    ├── /api/    → Backend NestJS :3001
    ├── /storage/ → MinIO :9002
    └── /*       → React Static Build
         ↓
NestJS
    ├── PostgreSQL (Prisma: public, Kysely: tenant schemas)
    ├── Redis (cache + session) — mock في desktop mode
    └── Storage (MinIO أو Local FileSystem)
```

### Multi-tenancy
- كل مركز (tenant) له **PostgreSQL schema منفصل**: `tenant_{uuid_with_underscores}`
- Public schema (Prisma): `plans, tenants, platform_users`
- Tenant schemas (Kysely): كل الجداول الأخرى
- مطبّق في **كل** أوضاع النشر بما فيها Desktop Mode — مفيش وضع فيه multi-tenancy معطل

### ORM Strategy
```
Public Schema  →  Prisma
Tenant Schemas →  Kysely (getTenantDb مش async!)
```

---

## 5. قواعد الكود — Backend

### بنية الـ Module (Clean Architecture)
```
modules/{name}/
├── domain/entities/{name}.entity.ts
├── application/
│   ├── dtos/{name}.dto.ts
│   └── use-cases/{name}.usecase.ts
├── infrastructure/{name}.repository.ts
├── presentation/{name}.controller.ts
└── {name}.module.ts
```

### قواعد إلزامية

#### 1. AppError
```typescript
// ✅ الترتيب الصح: code, message, statusCode
throw new AppError('NOT_FOUND', 'الطالب غير موجود', 404);
```

#### 2. getTenantDb — مش async أبداً
```typescript
const db = this.kysely.getTenantDb(tenantId);   // ✅
const db = await this.kysely.getTenantDb(tenantId); // ❌
```

#### 3. UUID في Kysely — إلزامي
```typescript
.where('id', '=', sql<string>`${id}::uuid`)
```

#### 4. Soft Delete — إلزامي في كل query
```typescript
.where('deleted_at', 'is', null)
```

#### 5. WhatsApp/Telegram — Fire and Forget، وقناتين مستقلتين
```typescript
this.sendNotification(tenantId, studentId, text)
  .catch(err => this.logger.error('Failed: ' + err.message));

// تليجرام نداء إضافي منفصل بعده — بدون لمس نداء الواتساب أعلاه خالص
this.telegramNotify.execute({ tenantId, entityType: 'student', entityId: studentId, templateKey: '...', vars: {...} })
  .catch(err => this.logger.error('Telegram notify failed: ' + err.message));
```

#### 6. مسارات الملفات في Desktop Mode — environment-aware
```typescript
// ✅ الطريقة الصحيحة — يستخدم env var من main.ts
const migrationsDir = process.env.DB_MIGRATIONS_PATH
  ? path.join(process.env.DB_MIGRATIONS_PATH, 'tenant')
  : path.join(__dirname, '..', '..', '..', '..', '..', '..', 'packages', 'db', 'src', 'migrations', 'tenant');

// ❌ لا تستخدم مسار hardcoded بـ __dirname في كود يعمل في الإنتاج
// السبب: __dirname مختلف بين dev وpackaged Electron app
```

#### 7. صلاحيات التقارير — حسب فئة التقرير الفعلية، مش صلاحية واحدة ثابتة (Session #030)
```typescript
// ❌ باج حرج كان موجود: فحص students.view بس بغض النظر عن فئة التقرير
// ده كان بيسرّب تقارير مالية لأي حد عنده students.view بس

// ✅ الطريقة الصح: خريطة صلاحيات حسب المفتاح أو الفئة
// REPORT_KEY_PERMISSIONS (استثناءات، مثل student-statement → finance.view)
// + CATEGORY_PERMISSIONS (finance→finance.view, students→students.view,
//                          sessions→sessions.view, exams→sessions.view)
// أي provider تقرير جديد لازم يتأكد إن فئته (category) متسجلة صح في CATEGORY_PERMISSIONS
```

#### 8. أي JwtStrategy جديدة — تحقق صريح من نوع التوكن (Session #030)
```typescript
// ❌ باج أمني حرج كان موجود: JwtStrategy.validate() العامة (tenant)
// كانت مش بتتحقق من payload.type — أي توكن نوع تاني كان يعدّي كـ tenant token

// ✅ كل استراتيجية JWT (tenant/platform/parent) لازم تتحقق صراحة:
validate(payload: JwtPayload) {
  if (payload.type !== 'tenant') throw new UnauthorizedException();
  return payload;
}
```

---

## 6. قواعد الكود — Frontend

### بنية الـ Feature
```
features/{name}/
├── api/{name}.api.ts
├── types/{name}.types.ts
├── hooks/use{Name}.ts
├── components/
└── pages/{Name}Page.tsx
```

### قواعد إلزامية

#### 1. API URL — relative دايماً (Tenant)
```typescript
await apiClient.get('/students');  // ✅
await apiClient.get('http://localhost:3001/api/v1/students');  // ❌
```

#### 2. Platform API — platformClient منفصل
```typescript
import { platformClient } from '@/features/platform/api/platform-client';
```

#### 3. Auth Stores — منفصلة (3 أنواع: tenant / platform / parent)
```typescript
import { useAuthStore } from '@/shared/stores/auth.store';
// localStorage: accessToken, refreshToken, user

import { usePlatformAuthStore } from '@/features/platform/stores/platform-auth.store';
// localStorage: platform_accessToken, platform_refreshToken, platform_user

// Parent Portal (جديد Aug 2026) — store/axios client منفصلين تمامًا، بادئة parent_*
// localStorage: parent_accessToken, parent_refreshToken, parent_user
```

#### 4. GRADE_OPTIONS — من @nabgha/types حصراً
```typescript
import { GRADE_OPTIONS } from '@nabgha/types';
```

#### 5. shadcn — المثبتة فقط
```
✅ المثبتة: dialog, button, input, select, label, badge, alert-dialog, avatar, dropdown-menu, table
❌ غير مثبتة: card, switch, textarea, checkbox → استخدم HTML/Tailwind
```

#### 6. RTL إلزامي
```tsx
<DialogContent dir="rtl">
```

#### 7. تصدير ملف حقيقي (PDF/Excel قابل للحفظ) — عبر Reports Module حصراً (Aug 2026)
```typescript
// ✅ الطريقة الصح — نفس نمط AttendanceSheet.tsx وDegreesSheet.tsx بالظبط
const blob = await reportsApi.generate('session-grades', { sessionId }, format); // format: 'pdf' | 'xlsx'
downloadBlob(blob, `filename.${format}`);

// ❌ ممنوع لأي تصدير مقصود منه ملف يتحفظ:
window.print();               // ده لتقارير القراءة السريعة/الطباعة المباشرة بس (زي AbsenceReportModal)
new jsPDF(); doc.save(...);   // مكتبة PDF من جوه المتصفح — بطيئة، تجربة "زي Ctrl+P"، ومحتاجة صيانة منفصلة عن الباك إند
```
كل تقرير جديد لازم يكون provider مستقل جوه `modules/reports/providers/` (راجع قسم Reports في MASTER_DOC.md قسم 10.5) — مش export logic في الفرونت إند.

---

## 7. Database Schema

### Public Schema (Prisma)
```sql
plans          ← خطط الاشتراك (id, name, slug, maxStudents, features, price)
tenants        ← المراكز (id, name, slug, plan_id, is_active, schema_name)
platform_users ← أدمن المنصة (id, email, password_hash, name, is_super_admin)
```

### Tenant Schema (30+ جدول)
```sql
users, center_settings, tenant_settings,
subjects, subject_grades, teachers, students,
groups, group_students, sessions, attendance,
treasuries, monthly_dues, payments, payment_transactions, expenses,
notifications,
wa_sessions, wa_settings, wa_templates, wa_messages_log, wa_bulk_jobs, wa_inbound_messages,
telegram_links, telegram_settings, telegram_templates, telegram_messages, telegram_inbound_messages,
parent_otp_codes,
schema_migrations
```

### أهم العلاقات
```
subjects → subject_grades → groups → group_students → students
                                          ↓
                                   monthly_dues → payments → payment_transactions
sessions → attendance
treasuries → payments + expenses
students → telegram_links (chat_id) — مستقل عن wa_* بالكامل
students → parent_otp_codes (عبر parent_phone) — مصادقة Parent Portal
```

---

## 8. Migration System

### الملفات
```
packages/db/src/
├── migrations/
│   ├── public/001_initial.sql   ← CREATE TABLE IF NOT EXISTS (plans, tenants, platform_users) + seed
│   └── tenant/001_initial.sql   ← الجداول الأساسية، + migrations رقمية تباعاً حتى 028 حاليًا
└── migrate.js                   ← runner ذكي
```

### قائمة migrations الرقمية الحالية (tenant)
```
002_add_student_extra_fields.sql       ← address, school, parent_occupation
003_fix_wa_sessions_unique.sql          ← باج UNIQUE constraint ناقص
004_add_secondary_phones.sql            ← phone2 للمدرسين والمركز
005_attendance_credits.sql              ← رصيد التعويض
006_absence_excused_template.sql        ← قالب واتساب ABSENCE_EXCUSED
007_attendance_excused_status.sql       ← دعم excused في CHECK constraint
008_fix_grade_format.sql
009_treasury_transfers.sql
010_grade_notification_tracking.sql     ← attendance.grade_notified_at
011_monthly_dues_cancelled_status.sql   ← حالة cancelled
012_parent_portal_otp.sql               ← parent_otp_codes (Parent Portal، Session #030)
013_monthly_dues_active_unique_index.sql
014_notify_absence_excused.sql          ← توگل إشعار الإعفاء
015_notify_grade_recorded.sql           ← توگل إشعار الدرجة (Session #030)
016-021_telegram_*.sql                  ← موديول تليجرام المستقل بالكامل (راجع قسم 11)
022_attendance_telegram_grade_notified.sql
023_fix_absence_excused_branding.sql
024_question_bank.sql                   ← بنك الأسئلة والامتحانات (⚠️ DB-001: GRANT لـ nabgha)
025_expense_reversal_transaction.sql    ← قيد عكس المصروف (FIN-002)
026_attendance_credits_v2.sql           ← رصيد التعويض v2
027_exams_kind_session_link.sql         ← التسميعات + ربط الامتحان بالحصة + out_of NUMERIC
028_fix_times_used_trigger_schema.sql   ← إصلاح trigger الـ times_used (EX-011)
```

> ⚠️ **على السيرفر مابنشغّلش `migrate.js`.** الإجراء في [`operations/DEPLOYMENT_RUNBOOK.md §4`](operations/DEPLOYMENT_RUNBOOK.md#4-تطبيق-migration-جديدة).
> ⚠️ أي دالة plpgsql أو trigger لازم يكتب اسم الـ schema (شوف [`engineering/CONVENTIONS.md §2.1`](engineering/CONVENTIONS.md)).

### الاستخدام
```bash
# Linux
cd packages/db && node src/migrate.js

# Windows
cd packages\db && node src\migrate.js

# pnpm
pnpm --filter @nabgha/db db:migrate
```

### إضافة Migration جديدة
```bash
# tenant schema
packages/db/src/migrations/tenant/002_add_national_id.sql
# الـ runner بيشوف إن 001 اتعمل قبل كده ويشغّل 002 بس

# public schema
packages/db/src/migrations/public/002_add_new_field.sql
```

### ⚠️ قواعد Migration
- **دايماً** استخدم `IF NOT EXISTS` أو `ON CONFLICT DO NOTHING`
- **لا تحذف** مباشرة — أعد التسمية أولاً ثم احذف في migration منفصلة لاحقة
- **لا تعدل** ملفات migration قديمة — أضف ملف جديد دايماً

---

## 9. Platform Admin Module

### Backend Endpoints
```
GET    /platform/stats
GET    /platform/tenants
POST   /platform/tenants         ← إنشاء مركز + provisioning تلقائي
GET    /platform/tenants/:id
PATCH  /platform/tenants/:id
PATCH  /platform/tenants/:id/toggle-active
GET    /platform/plans
POST   /platform/plans
PATCH  /platform/plans/:id
DELETE /platform/plans/:id
```

### Auth Isolation
- `platform_accessToken` / `platform_refreshToken` / `platform_user` — localStorage keys منفصلة
- `PlatformRoute` guard يمسح tenant auth store وبالعكس

---

## 10. WhatsApp Module

### Templates
`ABSENT, PRESENT, LATE, THREE_ABSENCES, PAYMENT_CONFIRM, PAYMENT_DUE, PAYMENT_OVERDUE, NEW_STUDENT, GROUP_ADDED, GROUP_REMOVED, ABSENCE_EXCUSED, GRADE_RECORDED, TELEGRAM_LINK`

> ⚠️ كل قالب لازم يبدأ بـ `{center_name}` (متغيّر)، **مش** باسم "نبغة" ثابت — القوالب دي بتوصل للعميل النهائي (ولي أمر الطالب)، فاسم المنتج التقني ملوش داعي يظهر فيها.

### Anti-Ban (`BaileysProvider`) — تفاصيل كاملة
| الآلية | الوصف |
|---|---|
| **Circuit Breaker** | بعد 5 فشل متتالي (`CIRCUIT_FAILURE_THRESHOLD`)، إيقاف الإرسال ساعة كاملة (`CIRCUIT_COOLDOWN_MS`) — يتصفّر عند أول إرسال/اتصال ناجح |
| **Typing Simulation** | `presenceSubscribe` + `composing` presence قبل كل رسالة، انتظار متناسب مع طول النص (1.5-4 ثانية + jitter)، ثم `paused` — best-effort، فشلها لا يوقف الإرسال |
| **Text Variation** | حرف Unicode غير مرئي عشوائي **جوه** النص (مش في آخره) — كل رسالة فريدة تقنياً. ⚠️ كان في باج حرج: الحرف كان بيتحط في آخر الرسالة دايمًا فكان بيخرّب أي رابط بيكون آخر سطر (زي رابط `TELEGRAM_LINK`) — اتصلح (Aug 2026) بتقييد الموضع لـ `[1, length-1]` فقط |
| **Daily Limit** | `countTodayByTenantId()` — لازم يتنادى من قاعدة البيانات **قبل كل رسالة** في أي إرسال جماعي طويل (`SendBulkUseCase`)، مش عداد ذاكرة محلي بيتزوّد بس — عداد الذاكرة مبيشوفش إرسال متزامن من مكان تاني في البرنامج، فممكن يتخطى الحد الفعلي (باج اتصلح Aug 2026) |

### إرسال جماعي — لازم Fire-and-Forget (Aug 2026)
أي إرسال لأكتر من رسالة (bulk، تقارير شهرية، رسايل درجات) **لازم** يستخدم `WA_BULK_JOB_REPOSITORY` (job بيتتبّع فيه `sent`/`failed`/`progress`)، والـ endpoint يرجّع `jobId` فوراً بدل ما ينتظر كل الرسايل تتبعت داخل نفس الطلب. لو الإرسال اتعمل synchronous (زي ما حصل بالغلط بدري)، أي تأخير أمني (anti-ban delay) بين الرسائل بيتراكم ويجمّد الواجهة لدقايق طويلة. **حماية double-submit** اتضافت لبعض المسارات (Session #030).

### مراجعة شاملة إضافية (Session #030) — نتائج بارزة
- 🔴 **فقدان إشعارات صامت:** حالات فشل معينة كانت بتتبلع بدون تسجيل أو رصد — اتصلح.
- **تجمد Warmup عند منتصف الليل:** حساب انتهاء يوم الـ warmup كان عرضة للتجمد عند عبور منتصف الليل — اتصلح.
- **حالة سباق في نموذج الإعدادات:** إعادة جلب خلفية كانت ممكن تكتب فوق تعديلات المستخدم الحالية في الفورم — اتصلحت.
- فلتر نطاق تاريخ جديد لسجل رسائل الواتساب. تفاصيل كاملة في `PROGRESS_TRACKER_updated.md`.

---

## 11. Telegram Module — قناة إشعارات مستقلة + Long Polling (أُعيد بناؤه بالكامل — Aug 2026)

> ⚠️ **تصحيح مهم:** الوصف القديم في هذا الملف كان يقول إن تليجرام بيستخدم Webhook. **ده غير صحيح للكود الفعلي الحالي خالص** — تليجرام بيستخدم **Long Polling**، ومفيش أي endpoint اسمه `webhook` في الكود.

### ليه Long Polling؟
عملاء وضع Desktop (الأغلبية) مالهومش IP عام ولا بورت مفتوح لاستقبال Webhook. البديل: `TelegramService.getUpdates()` بينادي دوريًا `GET https://api.telegram.org/bot<token>/getUpdates` (`offset`, `timeout: 30`) — `TelegramPollingService` بيدير حلقة polling مستقلة لكل تنانت (بتتشغّل تلقائيًا عند بداية التطبيق وفورًا عند حفظ توكن جديد)، وبيفرض "توكن واحد = poller واحد" على مستوى النظام كله.

### الـ Flow (محدّث)
```
توكن في الإعدادات → verify (getMe) → TelegramPollingService.startPollingForTenant()
     ↓
StudentProfilePage / إرسال جماعي → رابط دعوة t.me/bot?start=STU-00001
     ↓  (الرابط ده بيتبعت عبر الواتساب — TELEGRAM_LINK template — لأن ولي الأمر لسه مش مربوط تليجرام)
ولي الأمر يضغط Start → TelegramCommandRegistry يمسك /start ويحفظ صف في telegram_links
     ↓
إشعارات تلقائية عبر TelegramNotifyUseCase (قناة مستقلة تمامًا عن الواتساب — إعدادات/قوالب/سجل منفصلين)
     ↓
أي رد نصي عادي (مش أمر) من ولي الأمر → HandleTelegramInboundUseCase → صندوق وارد داخل النظام (محادثة ثنائية)
```

### القناة مستقلة عن الواتساب بالكامل (additive-only)
- جداول منفصلة: `telegram_settings`, `telegram_templates`, `telegram_messages`, `telegram_inbound_messages`, `telegram_links` — صفر تشارك مع `wa_*`.
- تفعيل/تعطيل نوع إشعار في تليجرام (`notify_absent` مثلاً) **لا يمس** إعداد الواتساب المقابل خالص.
- في finance/groups/sessions/students: نداء `telegramNotify.execute(...)` مستقل، ملفوف في `.catch()` خاص، بعد نداء الواتساب الموجود بدون تعديله — فشل قناة لا يوقف التانية.

### محادثة ثنائية (جديدة)
أي رسالة نصية عادية من ولي الأمر (مش أمر زي `/start`) بتتحفظ في `telegram_inbound_messages` مع `entity_id` معبّى فورًا (الربط بـ `chat_id` دقيق، عكس مطابقة رقم تليفون في الواتساب) — تظهر في `TelegramInbox.tsx` مربوطة تلقائيًا باسم الطالب الصح.

### Endpoints (محدّثة — لا يوجد webhook)
```
GET/PUT /telegram/settings           ← توكن البوت
GET/PUT /telegram/notify-settings    ← تفعيل كل نوع إشعار (مستقل عن الواتساب)
GET     /telegram/templates
PUT     /telegram/templates/:key
POST    /telegram/templates/:key/reset
GET     /telegram/inbound
PUT     /telegram/inbound/:id/read
GET     /telegram/bot-info
GET     /telegram/deep-link/:studentCode
```

### الفرونت إند
`TelegramNotifySettingsCard.tsx`, `TelegramTemplatesCard.tsx`, `TelegramInbox.tsx`, `TelegramBulkSend.tsx`, `TelegramMessagesLog.tsx` — كلها جوه `TelegramSettingsForm.tsx` / `TelegramPage.tsx`.

### ⬜ لسه مؤجل
- اختبار end-to-end شامل لكل نوع إشعار في بيئة حقيقية (الأسلاك اتأكدت بالكود، التجربة الفعلية الكاملة لسه معلقة)
- `SendTelegramLinksUseCase` من غير آلية إلغاء (عكس `SendBulkUseCase` بتاع الواتساب)

---

## 12. Upload Module

### Endpoints
```
POST /upload/image  ← max 5MB
POST /upload/logo   ← max 2MB
POST /upload/card   ← max 5MB
```

### Storage Modes
- **LAN Mode:** MinIO → URL: `/storage/nabgha/tenants/{id}/...`
- **Desktop Mode:** Local FileSystem → URL: `/storage/{relativePath}`

---

## 13. Auth & RBAC

### Guards Pipeline (Tenant)
```
JwtAuthGuard → TenantGuard → RolesGuard → PermissionGuard
```

### Guards Pipeline (Platform)
```
PlatformJwtAuthGuard (فقط)
```

### Guards Pipeline (Parent Portal — جديد Aug 2026)
```
ParentPortalAvailabilityGuard (يحجب الموديول بالكامل لو DEPLOY_MODE=desktop)
  → ParentJwtAuthGuard (يستخدم PARENT_JWT_SECRET، مستقل عن JWT_SECRET/PLATFORM_JWT_SECRET)
```

### Roles
| Role | الوصف |
|------|-------|
| `tenant_admin` | كل الصلاحيات (bypass تلقائي) |
| `teacher` | عرض + تسجيل حضور |
| `secretary` | إدارة الطلاب والمدفوعات |
| `super_admin` | platform admin |

### 🔴 باج أمني حرج اتصلح (Session #030)
`JwtStrategy.validate()` العامة (المستخدمة لكل توكنات tenant) كانت **مش بتتحقق من `payload.type !== 'tenant'`** — ثغرة نظرية تسمح لتوكن نوع تاني (لو اتسرب) يعدّي كـ tenant token صحيح. اتكشفت أثناء بناء `ParentJwtStrategy` المنفصلة، واتصلحت بالتوازي. **الدرس العام:** أي استراتيجية JWT جديدة أو موجودة لازم تتحقق صراحة من `payload.type` المتوقع (راجع قسم 5، قاعدة #8).

### باجات إضافية اتصلحت (Session #030)
- `expiresIn` بتاع `jwt.sign()` كان مش بيقرا env vars الصحيحة في بعض المسارات — اتصلح.
- فك تشفير base64url بـ `atob()` عادي (بدل decode مخصص لـ base64url) كان بيفشل في منطق تجديد التوكن الاستباقي — اتصلح.
- تسجيل الدخول من الموبايل كان بيفشل لو الحقول فيها مسافات زيادة (نسخ/لصق) — `.trim()` اتضاف.
- `/settings/capabilities` كان بيخفي فلاتر المادة/المدرس حتى مع الصلاحية الصحيحة — اتصلح.

---

## 14. Desktop Mode (Electron)

### الـ Flow
```
نبغة.exe
    ↓ runMigrations() — child process
    ↓ startAPI() — child process (NestJS)
    ↓ waitForAPI() — health check (60 retries × 1s)
    ↓ BrowserWindow → localhost:3001
    ↓ System Tray (LAN IP + menu)
```

### قاعدة البيانات — PostgreSQL محلي حقيقي (تصحيح مهم)
Desktop Mode **مش SQLite** — بيستخدم نسخة PostgreSQL حقيقية مثبتة كخدمة Windows (`postgresql-x64-16`)، بنفس آلية schema-per-tenant المستخدمة في LAN/SaaS Mode بالظبط. الفرق الوحيد إن السيرفر محلي على جهاز العميل نفسه (`127.0.0.1:5432`) بدل خادم مشترك على الشبكة.

**تشخيص شائع — التطبيق بيفتح ويقفل بعد ثواني/دقايق عند عميل:**
```cmd
:: تأكد إن خدمة PostgreSQL شغالة
sc query postgresql-x64-16
:: لو STATE: STOPPED
net start postgresql-x64-16
:: تأكد إنها هتشتغل تلقائيًا بعد أي إعادة تشغيل للجهاز
sc qc postgresql-x64-16
:: لازم START_TYPE: AUTO_START
```
لو الخدمة واقفة، أي محاولة اتصال بترمي `ECONNREFUSED 127.0.0.1:5432` وقت الـ migrations، والتطبيق بيقفل نفسه بصمت.

### اختيار IP لكود QR (Session #030 — راجع قسم 19 لدليل تشخيص شبكة كامل)
`getLanIP()` في `main.ts` بتستبعد كروت شبكة افتراضية معروفة (VPN/VMware/Docker/WSL/Hyper-V) وتفضّل Wi-Fi/Ethernet — نفس المنطق المطبّق في `health.controller.ts` بالباك إند.

### Node Path Detection
```typescript
const cmd = process.platform === 'win32' ? 'where node' : 'which node';
nodePath = execSync(cmd).toString().trim().split('\n')[0].trim();
```

### SPA Fallback (Express 5)
```typescript
expressApp.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/storage') || req.path.includes('.'))
    return next();
  res.sendFile(indexPath);
});
```

### Env Vars المهمة
```
DEPLOY_MODE=desktop
DB_MIGRATIONS_PATH={resources}/db/src/migrations   ← محسوب من IS_PACKAGED
DATABASE_URL=postgresql://nabgha:nabgha123@127.0.0.1:5432/nabgha
```

### ⚠️ System Tray — إغلاق صحيح
الضغط على X يخفي النافذة فقط (مش إغلاق حقيقي). الإغلاق الفعلي من الـ Tray → "إغلاق نبغة".

---

## 15. Windows Installer

### بناء الـ Installer
```cmd
:: من Admin cmd
M:\Projects\Nabgha\build-installer.bat
```
بيعمل: api build → web build → tsc → electron-builder → makensis

### الـ node_modules_real
```
apps/api/node_modules_real/     ← npm install منفصل (Windows binaries)
packages/db/node_modules_real/  ← npm install منفصل (pg, bcrypt, dotenv)
```
**قاعدة مهمة:** لا تلمس `node_modules_real` على Linux.

### Fresh Install vs Update
```
نبغة.exe موجودة في $INSTDIR؟
  لأ → Fresh Install (Node.js + PostgreSQL + DB creation + migrations)
  أيوه → Update Mode (backup pg_dump + نسخ ملفات + migrations جديدة بس)
```

### استعادة نسخة احتياطية
```cmd
pg_restore -U postgres -d nabgha --clean "C:\Program Files\Nabgha\backups\backup_pre_update.dump"
```

### متى تعيد بناء node_modules_real
| الحالة | الإجراء |
|--------|---------|
| أضفت package جديدة لـ apps/api | `npm install` في `apps/api/node_modules_real` |
| عدّلت `schema.prisma` | `prisma generate` + `xcopy` يدوي |
| تعديل كود فقط | لا شيء — `build-installer.bat` مباشرة |

> ⚠️ **حادثة حقيقية (Aug 2026):** أضفنا `archiver`, `exceljs`, `puppeteer` لـ
> `apps/api/package.json` (للتقارير + النسخ الاحتياطي)، بس نسينا نضيفهم لـ
> `node_modules_real/package.json` المنفصل (الملف النظيف بدون `workspace:*`).
> النتيجة: الـ Installer اتبنى بنجاح ظاهرياً، لكن التطبيق كان بيفشل بصمت عند
> 3 عملاء فعليين قبل ما نكتشف السبب. **`build-installer.bat` لا يتحقق من
> تطابق الملفين خالص** — لازم تتأكد يدوياً إن أي مكتبة جديدة في `package.json`
> الأصلي موجودة كمان في `node_modules_real/package.json` قبل أي تسليم.

> ⚠️ **لسه لازم (Aug 24, 2026):** إصلاحات Session #030 بالكامل (WhatsApp، Reports permissions، تسجيل دخول موبايل، اختيار IP، Parent Portal) اتعملت على الكود المصدري مباشرة، **بس لسه مفيش build جديد اتعمل ولا اتنشر عند أي عميل حقيقي** — راجع PROGRESS_TRACKER_updated.md "الخطوة الجاية".

---

## 16. الـ Modules الموجودة

| Module | Backend | Frontend | ملاحظات |
|--------|---------|----------|---------|
| Auth | ✅ | ✅ | JWT (tenant + platform + parent) + Refresh |
| Platform Admin | ✅ | ✅ | CRUD tenants/plans + stats |
| Users | ✅ | ✅ | CRUD + permissions |
| Settings | ✅ | ✅ | center + card designer + telegram |
| Upload | ✅ | ✅ | MinIO + Local FS + magic bytes |
| Subjects | ✅ | ✅ | مع subject_grades |
| Teachers | ✅ | ✅ | |
| Students | ✅ | ✅ | QR + telegram + تبويب درجات (Session #030) |
| Groups | ✅ | ✅ | discount (تعديل inline) + grade filter |
| Sessions | ✅ | ✅ | |
| Attendance | ✅ | ✅ | Split Screen |
| Finance | ✅ | ✅ | dues + payments + treasuries + receipts |
| Barcodes | — | ✅ | label PDF + card PDF (طباعة فعلية على طابعة الليبل — راجع PROGRESS_TRACKER لحالة التشخيص) |
| WhatsApp | ✅ | ✅ | Circuit Breaker + Typing Simulation + Text Variation، messages log + retry |
| Telegram | ✅ | ✅ | **Long Polling** (مش webhook) + قناة إشعارات مستقلة بالكامل + محادثة ثنائية (صندوق وارد) |
| Parent Portal | ✅ | ✅ | جديد Session #030 — OTP واتساب، JWT منفصل، **معطّلة في Desktop Mode** |
| Dashboard | ✅ | ✅ | real widgets |
| PWA | — | ✅ | manifest + sw.js |
| Reports | ✅ | ✅ | 13+ تقرير، 4 فئات + session-attendance/session-grades، Registry pattern، Excel/PDF export، صلاحيات مصححة حسب الفئة (Session #030) |
| Backup | ✅ | ✅ | يدوي + تلقائي مجدول، pg_dump locator |
| Spinner (عجلة الحظ) | — | ✅ | اختيار طالب عشوائي (حصة جارية/مجموعة/مادة) |

---

## 17. أوامر مهمة

### Linux — Backend
```bash
cd ~/Downloads/nabgha/apps/api
npx nest build
fuser -k 3001/tcp; sleep 1
nohup node dist/main.js > /tmp/nabgha-api.log 2>&1 &
tail -3 /tmp/nabgha-api.log
curl -sk https://localhost/api/v1/health
```

### Linux — Frontend
```bash
cd ~/Downloads/nabgha
pnpm --filter web build
cd apps/web && cp $(mkcert -CAROOT)/rootCA.pem dist/rootCA.pem
sudo systemctl restart nginx
```

### Migrations
```bash
# Linux
cd ~/Downloads/nabgha/packages/db && node src/migrate.js

# Windows
cd M:\Projects\Nabgha\packages\db && node src\migrate.js
```

### Windows — Build كامل (أوتوماتيك)
```cmd
M:\Projects\Nabgha\build-installer.bat
```

### Windows — Build يدوي (لو محتاج)
```cmd
cd M:\Projects\Nabgha\apps\api && npx nest build
cd M:\Projects\Nabgha && pnpm --filter web build
cd M:\Projects\Nabgha\apps\desktop && npx tsc && npx electron-builder --win
cd M:\Projects\Nabgha && "C:\Program Files (x86)\NSIS\makensis.exe" nabgha-installer.nsi
```

### فحص مسارات hardcoded (قبل كل تسليم)
```powershell
cd M:\Projects\Nabgha
Get-ChildItem -Path apps\api\src -Recurse -Filter *.ts | Select-String -Pattern "'packages'" -SimpleMatch | Select-Object Path, LineNumber, Line
```

### استعادة backup
```cmd
pg_restore -U postgres -d nabgha --clean "C:\Program Files\Nabgha\backups\backup_pre_update.dump"
```

### تشخيص خدمة PostgreSQL واقفة (Desktop Mode)
```cmd
sc query state= all | findstr /i postgres
sc query postgresql-x64-16
net start postgresql-x64-16
sc qc postgresql-x64-16   :: تأكد START_TYPE: AUTO_START
```

### تشخيص مشاكل اتصال الشبكة المحلية (QR / موبايل مش عارف يوصل) — Session #030
```cmd
ipconfig                                  :: تأكد الـ IP في QR بتاع Wi-Fi/Ethernet الحقيقي، مش كارت افتراضي
netstat -ano | findstr 3001               :: لازم يطلع 0.0.0.0:3001 LISTENING (مش 127.0.0.1 بس)
:: Settings → Network & Internet → لازم Network profile = Private مش Public
:: Windows Firewall: Inbound Rule لبورت 3001 (و8088 لو HTTPS) — كل البروفايلات، Allow
:: لو Rule ظاهرة صح والمشكلة مستمرة: جرب قفل الفايرول بالكامل مؤقتًا لعزل السبب
:: تأكد مفيش فايرول تالت (ESET/Avast/360...) شغال فعليًا (Task Manager، مش بس Programs list)
:: تأكد الراوتر مفيهوش AP/Client Isolation مفعّل
```
راجع MASTER_DOC.md قسم 2 و12، وPROGRESS_TRACKER_updated.md قسم "اتصال الشبكة المحلية" للتفاصيل الكاملة والترتيب المُجرَّب ميدانيًا.

---

## 18. بيانات التجربة

```
كل بيانات الدخول والتوكنات اتنقلت لملف محلي: docs/CREDENTIALS.local.md (متجاهل في git).
```


---

## 19. مشاكل شائعة وحلولها

### ❌ Cannot find module 'tslib' (Installer)
```
السبب: pnpm hoisting — الـ packages الـ shared موجودة في root node_modules مش في api/node_modules
الحل: npm install منفصل في apps/api/node_modules_real/
```

### ❌ Cannot find module '@nabgha/types' (Installer)
```
السبب: Internal packages مش متضمنة في الـ installer
الحل: إضافة extraResource في desktop/package.json:
{ "from": "../../packages/types", "to": "api/node_modules/@nabgha/types" }
```

### ❌ @prisma/client did not initialize yet (Installer)
```
السبب: الـ Prisma generated client مش موجود في node_modules_real
الحل:
1. npm install prisma@5.22.0 في node_modules_real
2. prisma generate
3. xcopy الـ .prisma/client من pnpm store لـ node_modules_real
```

### ❌ relation "public.plans" does not exist (Installer)
```
السبب: migrate.js يحاول INSERT قبل ما الجداول تتعمل
الحل: 001_initial.sql تحتوي CREATE TABLE IF NOT EXISTS (مش بس INSERT)
```

### ❌ Node.js path غلط (nvm4w)
```
السبب: NSI بتفترض C:\Program Files\nodejs بس Node.js مثبت في C:\nvm4w\nodejs
الحل: fallback chain في NSI + where node كـ fallback أخير
```

### ❌ ENOENT: no such file or directory, scandir '...packages\db\src\migrations\tenant'
```
السبب: tenant.usecase.ts فيه مسار hardcoded بيفشل في الإنتاج
الحل: استخدام process.env.DB_MIGRATIONS_PATH (ممرر من main.ts)
```

### ❌ Cannot GET / (Desktop Mode)
```
السبب: STATIC_PATH مش متعين أو middleware ترتيبه غلط
الحل: setGlobalPrefix('api/v1') قبل static assets middleware
```

### ❌ Express 5 PathError (wildcard routes)
```
السبب: Express 5 مش بيقبل * أو (.*)
الحل: استخدم expressApp.use() middleware
```

### ❌ Platform Login يدخل على Tenant Dashboard
```
السبب: useAuthStore و usePlatformAuthStore بيتعارضوا
الحل: PlatformRoute يمسح tenant auth store وبالعكس
```

### ❌ EADDRINUSE: 3001
```bash
# Linux
fuser -k 3001/tcp && sleep 1 && nohup node dist/main.js > /tmp/nabgha-api.log 2>&1 &

# Windows
taskkill /f /im "نبغة.exe" /t && taskkill /f /im "node.exe" /t
```

### ❌ Access is denied عند حذف Program Files\Nabgha
```
السبب: نبغة.exe لسه شغالة في الخلفية (Tray)
الحل: taskkill /f /im "نبغة.exe" /t ثم Remove-Item
```

### ❌ `archiver_1.default is not a function` وقت التشغيل (Runtime) رغم نجاح check-types (Aug 2026)
```
السبب: المكتبة الحقيقية (archiver) والـ @types/archiver اتثبتوا بإصدارين مختلفين
(مثلاً archiver@8.0.0 مع @types/archiver@^5.1.0) — كل واحد بيتثبت بأمر pnpm منفصل
فمحدش لاحظ التعارض. TypeScript بيوافق وقت الفحص لإنه بيقرا الـ types بس، لكن
شكل التصدير الفعلي (CJS/ESM) بيختلف فعلياً بين الإصدارات وقت التشغيل.
الحل: ثبّت المكتبة والـ @types بنفس الـ major version بالظبط:
  pnpm --filter @nabgha/api add archiver@^5.3.2
  pnpm --filter @nabgha/api add -D @types/archiver@^5.1.0
الدرس العام: أي مكتبة جديدة — تأكد إن المكتبة نفسها و@types بتاعتها نفس الإصدار
الرئيسي، مش تعتمد بس على نجاح check-types كدليل كفاية.
```

### ❌ Kysely type errors بعد أي migration جديدة (عمود جديد)
```
السبب: kysely-types.ts (packages/db/src/kysely-types.ts) مش متولّد تلقائياً من
أي أداة (زي kysely-codegen) في المشروع ده — هو ملف مكتوب يدوياً بالكامل.
الحل: بعد أي ALTER TABLE ADD COLUMN، لازم تضيف العمود يدوياً لنفس الـ Table
interface في kysely-types.ts، وإلا هتاخد أخطاء overload غامضة في أي مكان
بيستخدم .select() على الجدول ده.
```

### ⚠️ Puppeteer — Chromium بيتحمّل في مكان غلط للـ installer (Aug 2026)
```
السبب: puppeteer الحديثة (v25+) بتحمّل Chromium افتراضياً في cache خاص بحساب
المستخدم على الجهاز (%USERPROFILE%\.cache\puppeteer)، مش جوه node_modules نفسها.
ده مكان مختلف باسم مستخدم مختلف لكل جهاز عميل، فمش بيتنسخ مع أي extraResource
في electron-builder خالص.
الأثر: PdfExportService.onModuleInit() بيحاول يشغّل Puppeteer وقت bootstrap
التطبيق نفسه (مش وقت الاستخدام)، فلو فشل، الـ health check بيفضل يفشل، وElectron
بيقفل نفسه بصمت (app.quit() في الـ catch) من غير أي رسالة توضح السبب للمستخدم.
الحل الدائم: قبل npm install في node_modules_real، اظبط:
  set PUPPETEER_CACHE_DIR=%CD%\node_modules\puppeteer\.local-chromium
  npm install puppeteer@25.3.0
كده Chromium بيتحمّل جوه node_modules_real نفسها (مسار نسبي، قابل للنسخ).
وفي main.ts، لازم تمرر PUPPETEER_CACHE_DIR كـ env var للـ API process وقت
التشغيل الفعلي، يشاور لنفس المسار النسبي بعد التثبيت (resources/api/node_modules/
puppeteer/.local-chromium) — راجع تفاصيل كاملة في INSTALLER_DEEP_DIVE_v2.md.
```

### ⚠️ اكتشاف باج قديم خطير: fallback اكتشاف Node.js كان بيفشل بصمت (Aug 2026)
```
الكود القديم: process.execPath.replace('electron.exe', 'node.exe').replace('electron', 'node')
السبب: ده بيفترض إن مسار البرنامج المُجمّع فيه كلمة "electron" حرفياً — لكن
التطبيق المُجمّع اسمه "نبغة.exe"، مفيهوش الكلمة دي خالص، فالـ .replace() مبيغيّرش
حاجة، والكود بيحاول يشغّل "نبغة.exe" نفسها كأنها Node.js — وده سبب ظهور نافذة
بيضة/عالقة ثانية عند بعض العملاء.
الحل: findNodePath() — بحث بمسارات ثابتة معروفة أولاً (Program Files\nodejs,
nvm4w) قبل where node، ورمي خطأ واضح بدل fallback هش. راجع main.ts الحالي.
```

### ❌ التطبيق بيفتح ويقفل لوحده بعد ثواني/دقايق عند عميل جديد (Aug 2026)
```
السبب: خدمة PostgreSQL (postgresql-x64-16) واقفة (STOPPED) على جهاز العميل —
مش باج في التطبيق نفسه. أي محاولة اتصال أثناء migrations بترمي
ECONNREFUSED 127.0.0.1:5432، والتطبيق بيقفل نفسه.
التشخيص والحل: راجع قسم 17 "تشخيص خدمة PostgreSQL واقفة" أعلاه.
بعد net start، تأكد START_TYPE: AUTO_START (عادةً كده افتراضيًا) عشان الخدمة
تشتغل تلقائيًا مع كل إعادة تشغيل للجهاز مستقبلاً.
```

### 🔴 تسريب بيانات مالية عبر Reports Module (Session #030، Aug 2026)
```
السبب: ReportsController كان بيفحص صلاحية students.view بس بغض النظر عن فئة
التقرير الفعلية — أي مستخدم عنده students.view بس (مدرّس مثلاً) كان يقدر يفتح
تقارير مالية كاملة (تحصيل، مستحقات متأخرة) رغم معندوش finance.view خالص.
الحل: خريطة صلاحيات حقيقية حسب المفتاح والفئة (راجع قسم 5، قاعدة #7).
الدرس العام: أي endpoint بيخدم "أنواع" مختلفة من المحتوى (تقارير، مثلاً) لازم
تفحص الصلاحية المناسبة *لنوع المحتوى المطلوب فعليًا*، مش صلاحية عامة واحدة
بتفترض إن كل الأنواع نفس الحساسية.
```

### ❌ تقرير التحصيل (Reports) بيرجع صفر دايمًا (Session #030، Aug 2026)
```
السبب: استعلام تقرير التحصيل كان بيفلتر على status = 'completed'، لكن حالة
الدفع الفعلية المخزّنة في قاعدة البيانات هي 'paid' — عدم تطابق قيمة enum
بين طبقتين من الكود، من غير أي خطأ ظاهر (استعلام صحيح تركيبيًا، بس بيرجع
صفوف فاضية دايمًا).
الحل: تصحيح قيمة الفلتر لـ 'paid'.
الدرس العام: أي قيمة enum/status ثابتة (magic string) في استعلام لازم تتأكد
من تطابقها الفعلي مع القيمة المخزنة في الـ DB، مش بس من صحة بناء الجملة.
```

---

## 20. قرارات معمارية مهمة

### لماذا Electron يعمل spawn لـ NestJS؟
Baileys (WhatsApp) بيستخدم ESM modules — بيتعارض مع Electron CommonJS. الـ spawn ينشئ node process منفصل يحل المشكلة.

### لماذا node_modules_real بـ npm مش pnpm؟
pnpm بيستخدم symlinks (junctions على Windows) — مش بتتنسخ صح في electron-builder. npm install بينزّل الـ modules الحقيقية مباشرة.

### لماذا 001_initial.sql بتحتوي CREATE TABLE IF NOT EXISTS؟
عشان نستغني عن `prisma db push --accept-data-loss` في الـ installer — الأمر ده خطير لأنه ممكن يحذف بيانات حقيقية تلقائياً. الـ SQL الـ idempotent أكثر أماناً وأوضح.

### لماذا DB_MIGRATIONS_PATH env var؟
مسار ملفات الـ migrations مختلف بين بيئة التطوير وبيئة الإنتاج. بدل ما كل module تحسب المسار بـ __dirname معقد وقابل للكسر، main.ts (الذي يعرف IS_PACKAGED) يحسبه مرة واحدة ويمرره لكل من يحتاجه.

### لماذا Installer واحد لـ Fresh Install وUpdate؟
نفس النمط المستخدم في Slack, VS Code, Discord — أبسط للمستخدم وأقل احتمالاً للخطأ. الكشف تلقائي بفحص وجود نبغة.exe في مجلد التثبيت.

### لماذا platformClient منفصل عن apiClient؟
- localStorage keys مختلفة
- forceLogout يوجه لمكان مختلف
- مفيش تعارض بين tenant session وplatform session

### لماذا Migration System بدل جداول مباشرة؟
- عميل جديد: أمر واحد يعمل كل حاجة
- عميل قديم: نفس الأمر يعمل اللي ناقص بس
- في المستقبل: ملف SQL جديد → يتطبق تلقائياً على كل الـ tenants

### لماذا تليجرام Long Polling مش Webhook؟
عملاء وضع Desktop (الأغلبية) بيشتغلوا خلف NAT/راوتر منزلي عادي — مالهومش IP عام ولا بورت مفتوح لاستقبال طلبات Webhook من سيرفرات تليجرام. Long Polling بيعكس الاتجاه: التطبيق نفسه هو اللي بيبادر بالطلب لتليجرام (getUpdates) بشكل دوري، فمش محتاج أي إعداد شبكة إضافي عند العميل.

### لماذا قناة تليجرام منفصلة تمامًا عن الواتساب (مش موجّهة عبرها)؟
الواتساب (عبر Baileys) قناة غير رسمية محتاجة طبقة حماية كاملة من الحظر (Circuit Breaker + Typing Simulation + Text Variation + حد يومي). تليجرام قناة رسمية 100% (Bot API رسمي) مالهاش نفس المخاطر خالص — ضمّها لنفس منطق الواتساب كان هيورّثها تعقيد وقيود مالهاش داعي (تأخير مصطنع، حد يومي، إلخ). الفصل الكامل (إعدادات/قوالب/سجل رسائل مستقلين) بيخلي كل قناة تتصرف بالسرعة والمنطق المناسب لطبيعتها، وبيضمن كمان إن أي مشكلة في قناة (زي باج الحرف المخفي اللي كان بيخرّب روابط تليجرام) متأثرش على القناة التانية خالص.

### لماذا Parent Portal ليها JWT Secret مستقل ومسار auth منفصل تمامًا (Session #030)؟
لو استخدمت نفس `JwtStrategy`/`JWT_SECRET` بتاع الموظفين، أي باج مستقبلي في التحقق من الأدوار/الصلاحيات ممكن يفتح ثغرة يقدر بيها ولي أمر (خارجي، غير موثوق بنفس درجة موظف المركز) يوصل لبيانات موظفين أو تنانتات تانية. فصل الـ secret + الـ strategy + الـ guard بالكامل (`ParentJwtStrategy`/`ParentJwtAuthGuard`) بيضمن إن أي توكن parent مقدرش يعدّي أبداً كتوكن tenant حتى لو حصل خطأ برمجي في مكان تاني — وده بالظبط الباج اللي اتكشف واتصلح أثناء بناء الفيتشر ده (راجع قسم 13).

### لماذا Parent Portal معطّلة بالكامل في Desktop Mode؟
تركيبات Desktop شغالة أوفلاين بالكامل عند العميل (`127.0.0.1` فقط، مفيش IP عام ولا استضافة). فتح باب لزيارات خارجية من أولياء الأمور في وضع أساسًا مصمم يكون معزول شبكيًا يتعارض مع افتراض الأمان الأساسي بتاع الوضع ده. الحجب مطبّق دفاعيًا على مستوى الموديول (`ParentPortalAvailabilityGuard`)، مش بس بإخفاء رابط في الواجهة.

---

> **ملاحظة للـ AI Tools:**
> لما تشتغل على المشروع ده، اقرأ:
> 1. هذا الملف أول حاجة
> 2. `MASTER_DOC.md` للمعمارية الكاملة
> 3. `PROGRESS_TRACKER_updated.md` لمعرفة إيه اللي اتعمل وإيه اللي لسه
>
> قواعد لا تنسى:
> - `getTenantDb()` مش async أبداً
> - كل UUID في Kysely: `sql<string>\`${id}::uuid\``
> - Soft delete: `.where('deleted_at', 'is', null)` في كل query
> - WhatsApp/Telegram: fire-and-forget، وقناتين مستقلتين تمامًا (راجع قسم 5)
> - أي JwtStrategy جديدة: تحقق صريح من `payload.type` — راجع قسم 5 وقسم 13
> - Reports: صلاحية حسب فئة التقرير الفعلية، مش صلاحية واحدة ثابتة — راجع قسم 5
> - Backend build: `npx nest build && node dist/main.js`
> - Frontend: static build → nginx (مش Vite dev server)
> - API URL: relative `/api/v1/...` (مش localhost)
> - Platform: `platformClient` منفصل + `usePlatformAuthStore` منفصل
> - Parent Portal: `parentClient`/`useParentAuthStore` منفصلين + معطّلة في Desktop Mode
> - Express 5: استخدم `app.use()` middleware بدل wildcard routes
> - Windows set command: بدون space قبل `&&` — وWindows cd عبر درايف مختلف: استخدم `cd /d`
> - مسارات الملفات في Desktop: استخدم `process.env.DB_MIGRATIONS_PATH` مش __dirname hardcoded
> - Desktop Mode = PostgreSQL محلي حقيقي (مش SQLite)، multi-tenant مفعل زي باقي الأوضاع
> - node_modules_real: لا تلمسها على Linux (Windows binaries)
> - Installer: build-installer.bat من Admin cmd
> - أي تصدير ملف حقيقي (PDF/Excel): عبر Reports Module (`reportsApi.generate()` + `downloadBlob()`) — مش window.print() ومش jsPDF من الفرونت
> - تليجرام: Long Polling (لا يوجد webhook في الكود الفعلي) — لا تفترض من أي وصف قديم في وثيقة تانية
