# نبغة — Technical Architecture & Reference
> ⚠️ **مرجع قديم (Legacy):** الملف ده بيتحفظ عشان التفاصيل التاريخية. **المرجع الرسمي الحالي:** [`docs/README.md`](README.md) ← المعمارية: [`architecture/ARCHITECTURE.md`](architecture/ARCHITECTURE.md).
> لو فيه اختلاف بين الملف ده والتوثيق الجديد أو الكود، **الجديد والكود هما الصح**.

> **آخر تحديث:** August 24, 2026 (Session #031 — دمج اكتشافات Session #030 غير الموثّقة)

---

## 1. أوضاع النشر (Deploy Modes)

* **LAN Mode (`DEPLOY_MODE=local`):** NestJS + PostgreSQL على خادم محلي. nginx HTTPS. Multi-tenant مفعل.
* **Desktop Solo Mode (`DEPLOY_MODE=desktop`):** يعمل عبر Electron. **PostgreSQL محلي حقيقي** (خدمة Windows `postgresql-x64-16`، `DATABASE_URL=postgresql://nabgha:nabgha123@127.0.0.1:5432/nabgha`) — **مش SQLite** (تصحيح — كان في هذا الملف خطأ سابق مؤكد بالفحص المباشر للكود والبيئة الفعلية). Multi-tenant **مفعل بنفس آلية Schema per Tenant** المستخدمة في باقي الأوضاع (مش معطل) — الفرق الوحيد عن LAN Mode إن الـ API بيتشغّل كـ child process منفصل يطلقه Electron بدل ما يكون سيرفر مستقل، وإن PostgreSQL نسخة محلية على جهاز العميل نفسه بدل سيرفر مشترك. **بوابة أولياء الأمور (قسم 10.7) معطّلة بالكامل في هذا الوضع** — أمان (لا اتصال خارجي آمن لعميل أوفلاين).
* **SaaS Cloud Mode (`DEPLOY_MODE=saas`):** NestJS + PostgreSQL على السيرفر. Multi-tenant مفعل.

---

## 2. المعمارية العامة (Architecture)

```text
Browser / Mobile
    ↓ HTTPS :443
nginx (reverse proxy + SSL)
    ├── /api/v1/  → NestJS :3001
    ├── /storage/ → MinIO :9002
    └── /*        → React Static Build (dist/)

NestJS
    ├── PostgreSQL :5433
    │     ├── public schema  (Prisma)
    │     └── tenant schemas (Kysely)
    ├── Redis :6380
    └── MinIO :9002
```

### Key Design Decisions
- **Multi-tenancy:** Schema per Tenant — كل مركز له PostgreSQL schema منفصل. مطبّق في كل أوضاع النشر الثلاثة بما فيها Desktop Solo Mode (راجع تصحيح القسم 1 أعلاه).
- **ORM Strategy:** Prisma للـ Public Schema + Kysely للـ Tenant Schemas.
- **Dual Auth (أصبح Triple Auth — راجع قسم 7):** JWT منفصل للـ platform admins، tenant users، وأولياء الأمور (Parent Portal).
- **Storage:** MinIO + nginx proxy → HTTPS URLs فقط (في LAN/SaaS). في Desktop Mode: Local FileSystem.
- **Frontend:** Static build على nginx — مش Vite dev server.
- **URLs:** Relative دايماً (`/api/v1/...`, `/storage/...`).
- **اختيار IP للشبكة المحلية (QR Code):** `os.networkInterfaces()` بيُفلتر عمداً لاستبعاد كروت شبكة افتراضية (VPN/VMware/Docker/WSL/Hyper-V) ويُفضّل Wi-Fi/Ethernet — باج حقيقي اتصلح Aug 2026 (راجع قسم 12 Technical Constraints وDEVELOPER_GUIDE.md قسم 19 لدليل تشخيص شبكة كامل).

---

## 3. Monorepo Structure

```plaintext
nabgha/                          ← Turborepo + pnpm workspaces
├── apps/
│   ├── api/                     ← NestJS Backend (port 3001)
│   ├── web/                     ← React + Vite Frontend (static → nginx)
│   ├── desktop/                 ← Electron wrapper (مؤجل)
│   └── worker/                  ← Background Jobs
├── packages/
│   ├── types/                   ← Shared TypeScript types + permissions + GRADE_OPTIONS
│   ├── db/                      ← Prisma schema (public) + Kysely types (tenant)
│   │   └── src/
│   │       ├── kysely-types.ts
│   │       ├── migrate-tenants.js
│   │       ├── migrate-whatsapp.js
│   │       ├── migrate-settings.js
│   │       ├── migrate-core.js
│   │       ├── migrate-subjects-v2.js
│   │       ├── migrate-student-code.js
│   │       └── migrate-telegram.js    ← telegram_chat_id + bot token
│   └── config/
└── infra/
    └── docker/docker-compose.yml
```

---

## 4. Backend — NestJS

### Tech Stack
- **Framework:** NestJS 11 (TypeScript)
- **ORM — Public Schema:** Prisma 5
- **Query Builder — Tenant Schemas:** Kysely
- **Database:** PostgreSQL :5433
- **Auth:** JWT (Access 15m + Refresh 30d) — tenant/platform/parent، راجع قسم 7
- **Validation:** Zod
- **Storage:** MinIO (ioredis for Redis cache)
- **WhatsApp:** Baileys (@whiskeysockets/baileys)
- **Telegram:** Axios → Telegram Bot API (Long Polling — راجع قسم 10)
- **HTTP Client:** Axios
- **Security:** Helmet + @nestjs/throttler
- **Logging:** Pino + LoggingInterceptor + TransformInterceptor (camelCase)

### Critical Rules
```typescript
// 1. getTenantDb مش async أبداً
const db = this.kysely.getTenantDb(tenantId);  // ✅
const db = await this.kysely.getTenantDb(tenantId);  // ❌

// 2. UUID في Kysely
.where('id', '=', sql<string>`${id}::uuid`)

// 3. Soft delete في كل query
.where('deleted_at', 'is', null)

// 4. AppError order
throw new AppError('NOT_FOUND', 'الطالب غير موجود', 404);

// 5. Notifications fire-and-forget
this.notify(tenantId, studentId, text).catch(err => logger.error(err));
```

---

## 5. Frontend — React

### Tech Stack
- **Framework:** React 18 + Vite + TypeScript
- **Deploy:** Static build → nginx (مش Vite dev server)
- **Styling:** Tailwind CSS v3 + shadcn/ui
- **State & Routing:** Zustand + React Query + React Router v7
- **Forms:** React Hook Form + Zod
- **Direction:** RTL Arabic

### shadcn Components المثبتة
`alert-dialog, avatar, badge, button, dialog, dropdown-menu, input, label, select, table`

**غير مثبتة:** card, switch, textarea, checkbox — استخدم plain HTML/Tailwind

### Shared Components
- **DataTable:** Table responsive
- **PageHeader:** Title + Actions
- **ImageUploader:** Drag & drop + preview + remove (maxHeight: 160px)
- **AttendancePanel:** Split screen — كل الحصص تحت بعض مع scanner لكل واحدة
- **FloatingFab:** Draggable FAB — listeners تضاف عند drag فقط
- **ThermalReceipt:** 58mm thermal printer component

### نمط تصدير الملفات (PDF/Excel) — Aug 2026
أي تصدير ملف حقيقي (تحميل PDF/Excel قابل للحفظ على الجهاز، مش نافذة طباعة متصفح) **لازم** يمر عبر `reportsApi.generate(key, params, format)` (`GET /reports/:key/generate` بـ `responseType: 'blob'`) ثم `downloadBlob(blob, filename)` (`shared/lib/downloadBlob.ts`) — الملف بيتولّد في الباك إند (`ExcelExportService`/`PdfExportService`، راجع قسم 10.5) ويرجع كـ blob حقيقي. **ممنوع** استخدام `window.print()` أو مكتبات PDF جافاسكريبت من جوه المتصفح (زي jsPDF) لأي تصدير مقصود منه ملف يتحفظ — ده كان باج فعلي في تصدير درجات الحصة (كان بيفتح `window.open(blob)` بتجربة "زي Ctrl+P")، اتصلح بترحيله لنفس نمط تصدير كشف الحضور (`session-attendance` report provider) عبر provider جديد `session-grades`.

---

## 6. Database Schema

### Public Schema (Prisma)
`plans, tenants, platform_users, tenant_features`

### Tenant Schema الكاملة (Kysely)

```sql
users (id UUID PK, email, username UNIQUE, password_hash, name,
  role VARCHAR(50), permissions JSONB, is_active, created_at, updated_at, deleted_at)

center_settings (id UUID PK, center_name, center_logo_url TEXT,
  center_phone, center_address, currency, currency_symbol, academic_year,
  created_at, updated_at)
  -- center_logo_url: relative URL → /storage/nabgha/tenants/{id}/logo/...

tenant_settings (key VARCHAR PK, value TEXT, updated_at)
  -- card_designer → JSON { frontImage, backImage, groupX, groupY, qrSize }
  -- telegram_bot_token → string

subjects (id UUID PK, name, color, is_active, created_at, updated_at, deleted_at)

subject_grades (id UUID PK, subject_id UUID FK, grade VARCHAR(100),
  fee NUMERIC(10,2), payment_type, session_duration INTEGER,
  is_active, created_at, updated_at, deleted_at,
  UNIQUE(subject_id, grade))
  -- ⚠️ Fee يعيش هنا — مش على subjects أو groups

teachers (id UUID PK, name, phone, email, subject_ids JSONB,
  notes, is_active, created_at, updated_at, deleted_at)

students (id UUID PK, full_name, parent_phone, student_phone,
  date_of_birth, grade, notes, qr_code UNIQUE,
  student_code VARCHAR(20) UNIQUE,  -- STU-00001
  telegram_chat_id VARCHAR(50) NULL,  -- تاريخي — الربط الحالي عبر جدول telegram_links
  is_active, created_at, updated_at, deleted_at)

groups (id UUID PK, name, subject_grade_id UUID FK → subject_grades(id),
  teacher_id UUID FK, max_students INTEGER, schedule JSONB,
  is_active, created_at, updated_at, deleted_at)

group_students (id UUID PK, group_id UUID, student_id UUID,
  discount NUMERIC(10,2) DEFAULT 0,
  joined_at TIMESTAMPTZ, left_at TIMESTAMPTZ)
  -- ⚠️ مفيش UNIQUE constraint — left_at يحدد النشط

sessions (id UUID PK, group_id UUID, date DATE, start_time TIME,
  end_time TIME, status VARCHAR(20), notes, created_at, updated_at)

attendance (id UUID PK, session_id UUID, student_id UUID,
  status VARCHAR(20), notes, created_at, updated_at,
  UNIQUE(session_id, student_id))

payments (id UUID PK, student_id UUID, group_id UUID,
  subject_grade_id UUID FK, month VARCHAR(7),
  due_amount NUMERIC(10,2),  -- = subject_grade.fee - group_student.discount
  paid_amount NUMERIC(10,2), discount_applied NUMERIC(10,2),
  status VARCHAR(20), payment_method VARCHAR(20),
  receipt_number SERIAL, notes, created_by UUID,
  paid_at TIMESTAMPTZ, created_at, updated_at)

wa_sessions, wa_settings, wa_templates, wa_messages_log,
wa_bulk_jobs, wa_inbound_messages

-- Telegram — قناة مستقلة بالكامل عن الواتساب (راجع قسم 10)، migrations 016-021:
telegram_links              (id UUID PK, tenant_id, entity_type, entity_id, chat_id, created_at)
  -- الربط الفعلي طالب↔chat_id (استبدل students.telegram_chat_id القديم عملياً)
telegram_settings           (id UUID PK, tenant_id UNIQUE, telegram_enabled,
                              notify_absent, notify_present, notify_late, notify_3_absences,
                              notify_payment_confirm, notify_payment_due_7d, notify_payment_due_1d,
                              notify_payment_overdue, notify_new_student, notify_group_added,
                              notify_group_removed, notify_absence_excused, notify_grade_recorded, ...)
  -- منفصلة تمامًا عن wa_settings — تفعيل نوع إشعار في تليجرام لا يمس إعداد الواتساب المقابل
telegram_templates          (id UUID PK, tenant_id, key, body, is_default, UNIQUE(tenant_id, key))
  -- منفصلة تمامًا عن wa_templates
telegram_messages           (id UUID PK, tenant_id, chat_id, entity_type, entity_id,
                              template_key, body, status, error_message, sent_at, created_at)
telegram_inbound_messages   (id UUID PK, tenant_id, chat_id, body, entity_type, entity_id,
                              is_read, received_at, created_at)
  -- entity_id بيتملى فورًا وقت الاستقبال (عكس wa_inbound_messages) — الربط عبر chat_id دقيق ومباشر

-- Parent Portal — بوابة أولياء الأمور (راجع قسم 10.7)، migration 012:
parent_otp_codes            (id UUID PK, tenant_id, phone, otp_code, expires_at,
                              is_used, created_at)
  -- OTP عبر واتساب، مسار مصادقة منفصل تمامًا عن users (سيكريت JWT منفصل PARENT_JWT_SECRET)
```

### GRADE_OPTIONS (packages/types/index.ts)
```typescript
export const GRADE_OPTIONS = [
  'أول ابتدائي', 'ثاني ابتدائي', 'ثالث ابتدائي',
  'رابع ابتدائي', 'خامس ابتدائي', 'سادس ابتدائي',
  'أول إعدادي', 'ثاني إعدادي', 'ثالث إعدادي',
  'أول ثانوي', 'ثاني ثانوي', 'ثالث ثانوي',
] as const;
```

---

## 7. Authentication & RBAC

### Guards Pipeline (إلزامي لا يتغير)
```
JwtAuthGuard → TenantGuard → RolesGuard → PermissionGuard
```

- **TenantGuard:** Redis cache (5 min TTL).
- **PermissionGuard:** `tenant_admin` له bypass تلقائي.
- **Tenant users:** `/auth/login` → JWT Secret `JWT_SECRET`
- **Platform Admin:** `/platform/auth/login` → JWT Secret `PLATFORM_JWT_SECRET`
- **أولياء الأمور (Parent Portal، جديد Aug 2026):** OTP عبر واتساب → JWT Secret منفصل `PARENT_JWT_SECRET` عبر `ParentJwtStrategy`/`ParentJwtAuthGuard` مستقلة تمامًا عن `JwtStrategy` العامة — محجوبة بالكامل في `DEPLOY_MODE=desktop` عبر `ParentPortalAvailabilityGuard`.

> **🔴 باج أمني حرج اتصلح (Session #030، Aug 2026):** `JwtStrategy.validate()` العامة (تستخدمها كل توكنات tenant) كانت **مش بتتحقق من `payload.type !== 'tenant'`** — ثغرة نظرية تسمح لتوكن نوع تاني (لو اتسرب) يعدّي كأنه tenant token صحيح. اتكشفت أثناء بناء استراتيجية JWT ثالثة لـ Parent Portal، واتصلحت بالتوازي.

---

## 8. Upload Module

### Endpoints
```
POST /api/v1/upload/image  ← any image, max 5MB
POST /api/v1/upload/logo   ← center logo, max 2MB
POST /api/v1/upload/card   ← card background, max 5MB
```

### Security (Magic Bytes Validation)
```typescript
function validateMagicBytes(buffer: Buffer, mimetype: string): boolean {
  const jpeg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  const png  = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
  const webp = buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
  // ...
}
```

### URL Format
```
/storage/nabgha/tenants/{tenantId}/logo/{filename}
/storage/nabgha/tenants/{tenantId}/cards/{filename}
```

---

## 9. WhatsApp Module

### Templates المتاحة
`ABSENT, PRESENT, LATE, THREE_ABSENCES, PAYMENT_CONFIRM, PAYMENT_DUE, PAYMENT_OVERDUE, NEW_STUDENT, GROUP_ADDED, GROUP_REMOVED, ABSENCE_EXCUSED, GRADE_RECORDED, TELEGRAM_LINK`

> **ملاحظة (Aug 2026):** كل القوالب أُعيدت صياغتها لنبرة رسمية موحّدة، وبقت تبدأ بـ `{center_name}` (متغيّر) بدل ما تبدأ باسم المنتج "نبغة" نفسه بشكل ثابت — كانت مشكلة white-labeling حقيقية (اسم البرنامج التقني كان بيظهر في رسايل العميل النهائي بدل اسم مركزه).

### Notification Triggers
- `NEW_STUDENT` → StudentUseCase.create
- `GROUP_ADDED` → GroupUseCase.addStudent
- `GROUP_REMOVED` → GroupUseCase.removeStudent
- `PAYMENT_CONFIRM` → FinanceUseCase.createPayment
- `GRADE_RECORDED` → SessionUseCase (رصد درجة أول مرة بس — تصحيحات لاحقة تحتاج إرسال يدوي صريح، مش تلقائي، عشان منبعتش رسائل متكررة لكل تعديل. لها توگل تشغيل/إيقاف مستقل `notify_grade_recorded`، migration 015)
- `TELEGRAM_LINK` → `SendTelegramLinksUseCase` (موديول تليجرام) — رابط دعوة طالب لربط تليجرام بيتبعت **عبر الواتساب نفسه** (مش عبر بوت تليجرام)، لأن ولي الأمر لسه مش مربوط بتليجرام وقت إرسال الرابط أصلاً

### إرسال صور (Aug 2026)
`IWaProvider.sendImage()` — بيبعت صورة (Buffer) + caption عبر Baileys. مستخدمة لإرفاق صورة الحصة (ورقة امتحان/سبورة) مع رسالة `GRADE_RECORDED`.

### نمط Job في الخلفية (Fire-and-Forget) — إلزامي لأي إرسال جماعي
إرسال رسائل جماعية (زي التقارير الشهرية أو رسائل الدرجات) **لازم** يستخدم `WA_BULK_JOB_REPOSITORY` (job tracking بـ progress/sent/failed) بدل انتظار الإرسال بالكامل داخل نفس الـ HTTP request. السبب: تأخير الحماية من الحظر (anti-ban delay) بين كل رسالة بيتراكم لعدد الرسائل، وأي انتظار متزامن (synchronous) بيجمّد واجهة المستخدم لدقايق. النمط الصح: الـ endpoint يرجع `jobId` فوراً، والفرونت يتابع التقدّم بـ polling. **حماية double-submit** اتضافت لبعض مسارات الإرسال الجماعي (Session #030).

### Anti-Ban (`BaileysProvider` — `apps/api/src/modules/whatsapp/infrastructure/baileys.provider.ts`)
نظام حماية من الحظر متعدد الطبقات، كله جوه `BaileysProvider` نفسه:
- **Circuit Breaker:** بعد `CIRCUIT_FAILURE_THRESHOLD = 5` فشل متتالي في الإرسال لنفس التنانت، الدائرة تتفتح (`openUntil`) وتوقف كل محاولات الإرسال لساعة كاملة (`CIRCUIT_COOLDOWN_MS = 60 * 60 * 1000`) قبل ما تسمح بمحاولة تانية تلقائياً — بيتصفّر فوراً عند أي إرسال ناجح أو اتصال ناجح من جديد.
- **Typing Simulation:** قبل أي رسالة، `simulateHumanTyping()` بيعمل `presenceSubscribe` + `sendPresenceUpdate('composing', jid)`، بينتظر مدة متناسبة مع طول النص (`TYPING_MS_PER_CHAR = 40`، محصورة بين `TYPING_MIN_MS = 1500` و`TYPING_MAX_MS = 4000` + jitter عشوائي)، ثم `sendPresenceUpdate('paused', jid)` — محاكاة سلوك كتابة بشري حقيقي بدل إرسال فوري آلي. الفشل هنا لا يوقف الإرسال (best-effort، بيتجاوَز بصمت).
- **Text Variation:** `addTextVariation()` بيحط حرف Unicode غير مرئي عشوائي (`INVISIBLE_CHARS`) **جوه** نص الرسالة عشان كل رسالة تبقى فريدة تقنياً وتفلت من كشف الـ bulk-duplicate — **باج حرج اتصلح (Aug 2026):** الكود القديم كان بيحط الحرف في **آخر** الرسالة دايمًا، وده كان بيخرّب أي رابط بيكون آخر سطر في الرسالة (تحديدًا رابط `TELEGRAM_LINK`) — تليجرام كان بيرفض الـ `start` parameter الفاسد بصمت (شات فاضي، مفيش رد حتى لو المستخدم داس Start). الإصلاح: الحرف بيتحط دلوقتي في موضع عشوائي **جوه** النص فقط (`[1, length-1]`)، أبداً في أول أو آخر حرف — نفس الحماية، صفر تكلفة أداء إضافية، بدون خطر تكسير أي رابط أو نص حساس تاني في نهاية الرسالة.
- **Daily Limit — إصلاح حالة سباق (Aug 2026):** `SendBulkUseCase` كان بيجيب `sentToday` من قاعدة البيانات **مرة واحدة بس** عند بداية الـ job الجماعي، وبعدين بيزوّده في متغيّر ذاكرة محلي طول عمر الـ job (اللي ممكن ياخد دقايق) — أي إرسال تاني بيحصل بالتوازي من مكان تاني في البرنامج (إشعار فردي مثلاً) كان بيتجاهله تمامًا وممكن يتخطى الحد الفعلي. الإصلاح: `countTodayByTenantId(tenantId)` بيتنادى من قاعدة البيانات **قبل كل رسالة** بدل الاعتماد على العداد المحلي — تكلفة إضافية مهملة (استعلام مفهرس واحد) جنب تأخير الإرسال المتعمد (ثواني) الموجود أصلاً بين كل رسالة وتانية.
- `RestoreSessionsUseCase` → auto-reconnect على startup
- `RetryFailedMessagesUseCase` → retry كل 10 دقايق
- `normalizePhone()` → `01xxxxxxxxx` → `201xxxxxxxxx`
- Timezone: `Africa/Cairo`

### مراجعة شاملة إضافية (Session #030، Aug 2026)
راجعة كاملة للموديول كشفت 8 نقاط إضافية غير موثّقة سابقاً، أبرزها: 🔴 حالة فقدان إشعارات صامت (فشل بيتبلع بدون تسجيل ولا رصد)، وباج تجمد يوم الـ Warmup عند عبور منتصف الليل، وحالة سباق في نموذج إعدادات الواتساب (refetch خلفية بيكتب فوق تعديلات المستخدم الحالية). تفاصيل كاملة في `PROGRESS_TRACKER_updated.md` قسم WhatsApp Module.

---

## 10. Telegram Module — قناة إشعارات مستقلة بالكامل + محادثة ثنائية (Aug 2026)

> **إعادة بناء معمارية كاملة (Aug 2026):** تليجرام دلوقتي **مش** بيستخدم Webhook خالص (الوصف القديم في هذا الملف كان غير صحيح) — والأهم: بقى **قناة إشعارات مستقلة تمامًا** عن الواتساب (إعداداتها/قوالبها/سجل رسائلها منفصل بالكامل)، مش مجرد "بوت بيبعت رابط ربط" زي ما كان قبل كده.

### ليه Long Polling مش Webhook؟
تثبيتات وضع Desktop (الأغلبية الساحقة من عملاء نبغة) مالهاش IP عام ولا بورت مفتوح — Webhook مستحيل يوصلها. الحل: **Long Polling** — `TelegramService.getUpdates()` بينادي `GET https://api.telegram.org/bot<token>/getUpdates` بـ `{offset, timeout: 30, allowed_updates: ['message']}` بشكل دوري.

### العمارة
- **`TelegramPollingService`** — حلقة polling مستقلة لكل تنانت (`Map<tenantId, TenantLoopState>`)، بتتشغّل تلقائياً عند بداية التطبيق (`restoreAll()`، تأخير 5 ثواني) وكمان فورًا لما التوكن يتحفظ ويتفعّل بنجاح (`PUT /telegram/settings`). بتفرض قاعدة "توكن واحد = poller واحد نشط" على مستوى النظام كله (تليجرام مايسمحش بأكتر من مستهلك واحد لنفس التوكن على `getUpdates`).
- **`TelegramCommandRegistry.dispatch()`** — بيوجّه رسائل واردة: أوامر (`/start <studentCode>`) لمعالجات مخصصة، وأي نص عادي غير أمر لـ `HandleTelegramInboundUseCase` (محادثة ثنائية، راجع تحت).
- **`/start <studentCode>`** → `TelegramService.linkChat()` → `resolveEntityIdByCode()` (بحث فى `students` بالكود) → عند النجاح: صف جديد في `telegram_links` + رد "✅ تم الربط بنجاح!" — عند الفشل: "❌ لم يتم العثور على الطالب" — لو مفيش كود خالص (`/start` من غير باراميتر): رجوع صامت بدون رد.

### قناة الإشعارات (منفصلة بالكامل عن الواتساب — additive-only)
`TelegramNotifyUseCase` (مصدّرة من `TelegramModule`) مرآة لـ `SendNotificationUseCase` بتاع الواتساب لكن أبسط (بوت رسمي آمن 100%، مفيهوش داعي لأي حماية من حظر):
1. فحص `telegram_settings.telegram_enabled` + فحص المفتاح المناسب لنوع الإشعار (`notify_absent`... إلخ)
2. `telegram_links.findChatId(tenantId, 'student', entityId)` — لو الطالب مش مربوط تليجرام، رجوع هادئ (`not_linked`) بدون تسجيل خطأ (الحالة الطبيعية لأغلب الطلاب)
3. جلب القالب من `telegram_templates`، `render()`، إرسال عبر `TelegramService.sendMessage()`
4. تسجيل النتيجة في `telegram_messages`

**الوصل في الموديولات الأخرى (finance/groups/sessions/students):** بعد كل نداء `sendNotification.execute(...)` بتاع الواتساب الموجود، نداء إضافي مستقل لـ `telegramNotify.execute(...)` ملفوف في `.catch()` خاص بيه — **صفر تعديل** على أي سطر واتساب موجود، فشل تليجرام (أو العكس) لا يؤثر على القناة التانية خالص. 11 نقطة وصل مؤكدة عبر `finance.usecase.ts`، `group.usecase.ts`، `session.usecase.ts`، `student.usecase.ts`.

### محادثة ثنائية (Two-Way Inbox) — ميزة تنافسية جديدة
بما إن تليجرام قناة رسمية (عكس الواتساب المعتمد على Baileys غير الرسمي)، أي رسالة نصية عادية (مش أمر) من ولي الأمر بتتوجه لـ `HandleTelegramInboundUseCase` وتتخزن في `telegram_inbound_messages` مع `entity_id` معبّى **فورًا** (الربط عبر `chat_id` دقيق، عكس مطابقة رقم تليفون في الواتساب) — تظهر في "صندوق الوارد" (`TelegramInbox.tsx`) بربط تلقائي 100% باسم الطالب الصحيح.

### الفرونت إند
`TelegramNotifySettingsCard.tsx` (تفعيل/تعطيل كل نوع إشعار، مستقل عن إعدادات الواتساب المقابلة)، `TelegramTemplatesCard.tsx` (تعديل نصوص القوالب)، `TelegramInbox.tsx` (صندوق الوارد)، كلها جوه `TelegramSettingsForm.tsx`/`TelegramPage.tsx`.

### Endpoints (محدّثة)
```
GET/PUT /telegram/settings           ← إعدادات البوت (توكن) — منفصلة عن notify-settings
GET/PUT /telegram/notify-settings    ← تفعيل كل نوع إشعار (settings.view/settings.edit)
GET     /telegram/templates
PUT     /telegram/templates/:key
POST    /telegram/templates/:key/reset
GET     /telegram/inbound
PUT     /telegram/inbound/:id/read
GET     /telegram/bot-info
GET     /telegram/deep-link/:studentCode
```
> ⚠️ لا يوجد `POST /telegram/webhook/:tenantId` ولا `POST /telegram/setup-webhook` — كانت في نسخة قديمة من هذا الملف ومش موجودة في الكود الفعلي أصلاً حسب آخر مراجعة.

### ⬜ لسه مؤجل / غير مؤكد
- اختبار end-to-end كامل لكل نوع إشعار تليجرام (غياب/حضور/دفع/درجة...) في بيئة حقيقية — الأسلاك (wiring) اتأكدت بالكود، لكن التجربة الفعلية الشاملة لسه معلقة.
- `SendTelegramLinksUseCase` (الإرسال الجماعي لروابط الربط عبر الواتساب) **من غير آلية إلغاء** — عكس `SendBulkUseCase` بتاع الواتساب اللي عنده `activeJobs` Map + `DELETE /whatsapp/bulk/:jobId`. اتكشفت أثناء أزمة تشغيلية حقيقية، اتحلت وقتها بفصل الواتساب يدويًا بدل إصلاح كود — لسه مفتوحة.
- باج عرض (مش إرسال): `get-messages.usecase.ts`/`get-telegram-messages.usecase.ts` بيربط سجل الرسائل بالطالب عبر `LEFT JOIN` برقم التليفون — لو أخوين ليهم نفس رقم ولي الأمر، الاسم المعروض في السجل ممكن يبقى غلط (المحتوى الفعلي المُرسل سليم 100%، المشكلة في العرض بس).

---

## 10.5 Reports Module (Aug 2026)

بنية **Registry/Strategy pattern** — كل تقرير عبارة عن provider مستقل بيسجّل نفسه في `ReportRegistryService` (in-memory Map).

```
modules/reports/
├── report-registry.service.ts   ← register()/get()/getAll()
├── report.types.ts              ← ReportDefinition (key, title, category, getPreviewData, generate)
├── reports.controller.ts        ← GET /reports (catalog), GET /reports/:key/preview, GET /reports/:key/generate
└── providers/                   ← provider واحد لكل تقرير (13+ حالياً، بما فيهم session-attendance وsession-grades)
```

**4 فئات:** الطلاب، المالية، الحصص، الامتحانات والتسميعات — كل فئة صفحتها الرئيسية + تابات فرعية.

**تقارير على مستوى حصة واحدة (`session-attendance`, `session-grades`):** بتُستدعى مباشرة من مودالات الحصة (`AttendanceSheet.tsx`, `DegreesSheet.tsx`) عبر `reportsApi.generate(key, {sessionId, status?}, format)` + `downloadBlob()` — نفس النمط بالظبط للاتنين، فايل حقيقي (PDF/Excel) قابل للحفظ على الجهاز، مش نافذة طباعة متصفح. `session-grades` بيرتب حسب الدرجة (الأعلى أولاً)، وعمود الحالة (حاضر/غايب) متعمّد إخفاؤه من التقرير بطلب صريح — الأعمدة: الكود، الاسم، الدرجة بس.

**بنية مشتركة** (`shared/infrastructure/export/`):
- `excel-export.service.ts` (ExcelJS) — جدول واحد أو تقرير مركّب (composite: عدة أقسام + ملخص)
- `pdf-export.service.ts` (Puppeteer، RTL عربي) — نفس المنطق + `generateHonorBoard()` للتصميم الاحتفالي (لوحة الشرف)

**نمط Frontend مهم — Nested Routes بدل تكرار الـ Layout:**
أي قسم فيه فئات رئيسية + تابات فرعية (زي التقارير) **لازم** يستخدم `<Outlet />` عبر الراوتر المتداخل (`children` في `createBrowserRouter`)، مش كل صفحة تلف نفسها بـ `<Layout>{children}</Layout>`. لو كل صفحة بتستدعي الـ Layout بنفسها، أي تنقل بين تابين بيهدم شريط التابات نفسه ويعيد بناءه من الصفر (رمشة/طفطفة ملحوظة). الحل: الـ Layout عنصر راوتر أب واحد، والصفحات الداخلية `leaf` routes بس.

### 🔴 باجات أمنية/بيانات حرجة اتكشفت واتصلحت (Session #030، Aug 2026)
1. **تسريب بيانات مالية:** `ReportsController` كان بيفحص صلاحية `students.view` بس بغض النظر عن فئة التقرير الفعلية — أي مستخدم عنده `students.view` بس (مدرّس مثلاً، من غير `finance.view`) كان يقدر يفتح تقارير مالية كاملة (تحصيل، مستحقات متأخرة). اتصلح بخريطة صلاحيات حقيقية: `REPORT_KEY_PERMISSIONS` (استثناءات مثل `student-statement`→`finance.view`) + `CATEGORY_PERMISSIONS` (`finance`→`finance.view`, `students`→`students.view`, `sessions`→`sessions.view`, `exams`→`sessions.view`).
2. **تقرير التحصيل بيرجع صفر دايمًا:** الاستعلام كان بيفلتر على حالة `'completed'` بينما حالة الدفع الفعلية في قاعدة البيانات هي `'paid'` — التقرير كان معطوب بالكامل بصمت. اتصلح بتصحيح قيمة الفلتر.

## 10.6 Backup Module (Aug 2026)

```
modules/settings/
├── infrastructure/backup/pg-dump-locator.service.ts   ← يدوّر على pg_dump.exe (Registry + مسارات ثابتة + PATH)
├── application/use-cases/backup.usecase.ts            ← ينشئ zip (dump + storage + manifest.json)
└── application/use-cases/scheduled-backup.usecase.ts  ← @Cron يومي (3 صباحاً)، الاحتفاظ بآخر 7 نسخ
```

- **PgDumpLocatorService:** بيدوّر على `pg_dump` بنفس منطق الـ Registry اللي الـ Installer (NSIS) بيستخدمه (فرع 64-bit ثم 32-bit ثم مسارات ثابتة `12`→`18` ثم PATH كملاذ أخير).
- ⚠️ **مشكلة مفتوحة لسه (Aug 2026):** `backup.usecase.ts` بيمرّر رابط الاتصال الكامل (`postgresql://user:pass@host:port/db`) كمعامل واحد لـ `pg_dump` عبر `execFile`، وده بيفشل أحياناً على Windows بخطأ غامض `spawn UNKNOWN` حتى لو نفس البيانات شغالة تمام بمعاملات منفصلة (`-U -h -d`). **الحل المقترح (لسه مش منفّذ):** التحويل لمعاملات منفصلة + `PGPASSWORD` كـ environment variable بدل تضمينه في الرابط.

## 10.7 Parent Portal — بوابة أولياء الأمور (جديد بالكامل، Session #030، Aug 2026)

فيتشر جديد بُني من الصفر يسمح لولي الأمر بمتابعة بيانات ابنه (حضور/درجات/مستحقات مالية) مباشرة من غير المرور بالمركز.

**قيد معماري صارم:** **معطّلة بالكامل في `DEPLOY_MODE=desktop`** — تركيبات الديسكتوب أوفلاين بالكامل عند العميل، ومش آمن تخدم زيارات خارجية من أولياء الأمور. متاحة فقط في LAN/SaaS Mode. الحجب مطبّق عبر `ParentPortalAvailabilityGuard` على مستوى الموديول بالكامل.

**قرارات معمارية:**
- صفحة تفصيلية مستقلة لكل طالب (مش داشبورد مجمّع لكل الأبناء).
- مصادقة OTP عبر واتساب، على مسار **منفصل تمامًا** عن نظام `users` الخاص بالموظفين — JWT Secret مستقل (`PARENT_JWT_SECRET`)، راجع قسم 7.

**Backend:** `parent-portal.module.ts/.controller.ts/.service.ts/.repository.ts` (طلب/تأكيد OTP) + `ParentJwtStrategy`/`ParentJwtAuthGuard` + `ParentPortalAvailabilityGuard` + endpoint تفاصيل الطالب (بيعيد استخدام `StudentUseCase`/`FinanceUseCase` مع فحص ملكية صريح — 403 لو الطالب مش من أبناء ولي الأمر ده). جدول `parent_otp_codes` (migration 012، راجع قسم 6).

**Frontend:** شجرة routes منفصلة (`/parent/:slug/login`, `/parent/:slug/dashboard`, `/parent/:slug/students/:studentId`) + Zustand store/axios client/localStorage keys منفصلة (بادئة `parent_*`) + layout خفيف منفصل (مش بيعيد استخدام `AppLayout` الخاص بالموظفين).

**باج أمني مكتشف أثناء البناء:** راجع قسم 7 (JWT type check).

---

## 11. nginx Configuration

```nginx
server {
    listen 443 ssl;
    client_max_body_size 6m;
    server_name _ localhost;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    root /path/to/dist;

    location /storage/ {
        proxy_pass http://127.0.0.1:9002/;
        proxy_set_header Host 127.0.0.1:9002;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_read_timeout 300;
    }

    location / {
        add_header Cache-Control "no-store";
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 12. Technical Constraints

### Backend
- `getTenantDb()` → **مش async** أبداً
- UUID في Kysely → `sql<string>\`${id}::uuid\``
- Soft Delete → `.where('deleted_at', 'is', null)` في كل query
- Zod validation → إلزامي على كل Controller input
- `AppError(code, message, statusCode)` → هذا الترتيب
- Notifications → fire-and-forget دايماً
- `tenantId` → `req.user.tenantId`، `userId` → `req.user.sub`
- Redis inject → `@Inject('REDIS_CLIENT')`
- أي `JwtStrategy` جديدة (زي `ParentJwtStrategy`) → لازم تتحقق من `payload.type` المتوقع صراحة، مش تفترض إنه tenant تلقائياً (راجع قسم 7)
- اختيار IP للشبكة المحلية (`os.networkInterfaces()`) → لازم يستبعد كروت شبكة افتراضية معروفة الاسم (VPN/VMware/Docker/WSL/Hyper-V) ويفضّل Wi-Fi/Ethernet

### Frontend
- API URL → relative (`/api/v1/...`)
- Storage URL → relative (`/storage/...`)
- GRADE_OPTIONS → من `@nabgha/types` حصراً
- shadcn → المثبتة فقط
- RTL → `dir="rtl"` إلزامي
- Search → `useDebounce` إلزامي
- Logo state → منفصل عن form state (logoInitialized flag)
- تصدير ملفات (PDF/Excel) → عبر `reportsApi.generate()` + `downloadBlob()` حصراً (راجع قسم 5) — مش `window.print()` ومش مكتبات PDF جافاسكريبت من جوه المتصفح
