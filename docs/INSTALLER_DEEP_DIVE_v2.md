# نبغة — Installer & Update Mechanism: التوثيق الكامل (النسخة النهائية)
> ℹ️ لسه المرجع الأساسي للـ installer. قايمة التحقق المختصرة لكل إصدار: [`operations/DESKTOP_RELEASE.md`](operations/DESKTOP_RELEASE.md).


> **تاريخ الجلسة الأصلية:** 30 يونيو 2026
> **آخر تحديث:** 3 أغسطس 2026 — راجع "الجزء الحادي عشر" لمشاكل جديدة (Puppeteer، اكتشاف Node.js، النسخ الاحتياطي)
> **الحالة:** 🔵 معظم المشاكل القديمة مُصلَحة ومختبرة — لكن فيه مشكلة مفتوحة لسه (راجع المشكلة 10)
> **الهدف:** توثيق شامل لكل مشكلة واجهناها في بناء الـ Windows Installer وحلها، مع دليل عملي لكل نوع تعديل قادم.

---

## الخلاصة التنفيذية (لو مستعجل اقرأ ده بس)

1. **المشكلة الجذرية في كل حاجة:** pnpm بتعمل hoisting للـ dependencies في الـ root `node_modules` مع symlinks — وelectron-builder بينسخ بس المجلد المحلي (`apps/api/node_modules`) فيفضل ناقص packages كتير.
2. **الحل:** عملنا `node_modules_real` لكل من `apps/api` و`packages/db` — مجلد منفصل فيه `package.json` نظيف بدون `workspace:*`، اتعمله `npm install` عادي (مش pnpm) فطلعت dependencies flat حقيقية بدون symlinks.
3. **Installer واحد بس لكل الحالات:** نفس الـ `nabgha-setup.exe` يُستخدم للتثبيت الأول وللتحديثات — بيتعرف على نفسه عن طريق فحص وجود `نبغة.exe` في `$INSTDIR` قبل النسخ.
4. **الأمان عند التحديث:** Backup إجباري (`pg_dump`) قبل أي migration في وضع التحديث، ونظام migrations idempotent (tracking table) يضمن إن أي SQL يتنفذ مرة واحدة بس.
5. **لا اعتماد على `prisma db push` في الإنتاج:** ✅ تم تحويل `001_initial.sql` لتحتوي `CREATE TABLE IF NOT EXISTS` للجداول الثلاثة — مش محتاجين Prisma عند العميل خالص.
6. **سكريبت واحد:** `build-installer.bat` في root المشروع يعمل كل خطوات البناء بالترتيب الصحيح بأمر واحد.
7. **(جديد، أغسطس 2026)** Puppeteer بيحمّل Chromium في مكان غير قابل للنسخ افتراضياً (cache خاص بالمستخدم) — لازم يتحمّل في مسار نسبي داخل `node_modules_real` عبر `PUPPETEER_CACHE_DIR`. وfallback اكتشاف Node.js القديم كان بيفشل بصمت على أي اسم exe متخصصص. راجع "الجزء الحادي عشر".

---

## الجزء الأول: رحلة حل مشاكل الـ Build (Fresh Install)

### المشكلة 1 — `tslib` مش موجودة (Cannot find module 'tslib')

**الأعراض:**
```
Error: Cannot find module 'tslib'
Require stack:
- C:\Program Files\Nabgha\resources\api\node_modules\@nestjs\core\index.js
```

**السبب الجذري:**
pnpm بيعمل **hoisting** — يعني بيحط معظم الـ dependencies المشتركة في `node_modules` الموجودة في **root** المونوريبو (`M:\Projects\Nabgha\node_modules`) مش جوه `apps/api/node_modules` المحلية. لما `electron-builder` ينفذ:
```json
{ "from": "../api/node_modules", "to": "api/node_modules" }
```
هو بينسخ بس المجلد المحلي الناقص، فالـ packages اللي اتعملها hoisting (زي `tslib`) متبقاش موجودة في الـ installer خالص.

**أول محاولة فاشلة:** ضم الـ root `node_modules` بالكامل كـ extraResource.
- النتيجة: حجم الـ installer قفز لأكتر من 1GB لأن الـ root node_modules فيها dependencies بتاعة **كل** الـ apps في المونوريبو.
- **القرار:** رجعنا فيها فوراً — مش مقبول للتسليم.

**الحل النهائي الصحيح — `node_modules_real`:**

```bash
mkdir apps/api/node_modules_real
cd apps/api/node_modules_real
# نعمل package.json نظيف بدون workspace:* dependencies
npm install --legacy-peer-deps
```

**لماذا `npm` ومش `pnpm`؟**
لأن `npm install` بيعمل نسخ حقيقي (hard copy) للـ dependencies جوه `node_modules/`، مش symlinks لمخزن مركزي زي pnpm. ده يضمن إن أي حاجة تتنسخ بـ electron-builder تكون كاملة وقائمة بذاتها.

**لماذا `package.json` منفصل؟**
لأن `apps/api/package.json` الأصلي فيه `workspace:*` اللي npm مش بيفهمه:
```
npm error code EUNSUPPORTEDPROTOCOL
npm error Unsupported URL Type "workspace:": workspace:*
```

---

### المشكلة 2 — `@nabgha/types` مش موجودة

**الأعراض:**
```
Error: Cannot find module '@nabgha/types'
Require stack:
- ...\dist\shared\infrastructure\auth\permissions.js
```

**السبب:**
الكود الـ compiled (`dist/*.js`) بيستورد `@nabgha/types` و`@nabgha/db` في runtime فعلياً.

**الحل:**
```json
{
  "from": "../../packages/types",
  "to": "api/node_modules/@nabgha/types"
},
{
  "from": "../../packages/db",
  "to": "api/node_modules/@nabgha/db"
}
```

---

### المشكلة 3 — `@prisma/client did not initialize yet`

**الأعراض:**
```
Error: @prisma/client did not initialize yet. Please run "prisma generate"
```

**السبب:**
الـ Prisma Client المولّد (`.prisma/client/`) ناقص من الـ installer.

**المحاولات الفاشلة:**
- `prisma@latest` — رجع v7 وكسر التوافق مع `schema.prisma` بتاعنا (v7 غيّر syntax الـ schema بالكامل)
- `prisma generate` — كانت بتولد في الـ pnpm store مش جوه `node_modules_real`

**الحل النهائي:**
```bash
npm install prisma@5.22.0 --save-dev --legacy-peer-deps
.\node_modules\.bin\prisma generate --schema=M:\Projects\Nabgha\packages\db\prisma\schema.prisma
```
ثم نسخ يدوي (xcopy) للملفات المولدة من الـ pnpm store:
```cmd
xcopy /E /I /Y "...\.pnpm\@prisma+client@5.22.0...\node_modules\@prisma\client" "apps\api\node_modules_real\node_modules\@prisma\client"
xcopy /E /I /Y "...\.pnpm\@prisma+client@5.22.0...\node_modules\.prisma\client" "apps\api\node_modules_real\node_modules\.prisma\client"
```

> ⚠️ **مهم:** لو عدّلت `schema.prisma` مستقبلاً، لازم تعيد الخطوتين دول قبل البناء.

---

### المشكلة 4 — `relation "public.plans" does not exist`

**الأعراض:**
```
[Migrate] → Applying: public/001_initial.sql
[Migrate ERR] ❌ Migration failed: relation "public.plans" does not exist
```

**السبب الجذري:**
`001_initial.sql` كانت تعمل `INSERT INTO public.plans` بس، بافتراض إن الجدول موجود. الجدول نفسه كان بيتعمل من Prisma فقط (`prisma db push`) — وكنا شيلنا الخطوة دي بالغلط.

**الحل المرحلي (استُخدم مؤقتاً):**
رجّعنا `prisma db push` للـ NSI بمسار صحيح.

**الحل النهائي الدائم (✅ منفّذ حالياً):**
تحويل `001_initial.sql` لتحتوي `CREATE TABLE IF NOT EXISTS` — راجع الجزء السادس.

---

### المشكلة 5 — Node.js path غير معروف (nvm4w)

**الأعراض:**
كل أوامر Node.js كانت تفشل صامتة بدون رسالة خطأ واضحة.

**السبب:**
NSI كانت بتفترض مسارات ثابتة (`$PROGRAMFILES64\nodejs\node.exe`)، لكن Node.js كان مثبت عبر **nvm4w** في `C:\nvm4w\nodejs\node.exe`.

**الحل — fallback chain:**
```nsi
StrCpy $NODE_PATH "$PROGRAMFILES64\nodejs\node.exe"
${IfNot} ${FileExists} "$NODE_PATH"
  StrCpy $NODE_PATH "C:\Program Files\nodejs\node.exe"
${EndIf}
${IfNot} ${FileExists} "$NODE_PATH"
  StrCpy $NODE_PATH "C:\nvm4w\nodejs\node.exe"
${EndIf}
${IfNot} ${FileExists} "$NODE_PATH"
  nsExec::ExecToStack 'where node'
  Pop $0
  Pop $NODE_PATH
${EndIf}
```

> 💡 **الدرس:** أي عميل ممكن يكون Node.js عنده مثبت بأي طريقة (nvm, nvm4w, installer رسمي, Chocolatey...). الـ `where node` كـ fallback أخير يغطي أي حالة.

---

### المشكلة 6 — تكرار `plans does not exist` بعد إصلاح node path

بعد حل مشكلة الـ node path، ظهر إن السبب الحقيقي لفشل الـ migration كان شيل `db push` — مش مشكلة الـ path. بعد رجوعه بمسار صحيح:
```
[Migrate] ⏭  Skipped: public/001_initial.sql
[Migrate] 🎉 All migrations completed successfully!
```

---

## الجزء الثاني: مشكلة إنشاء الـ Tenant (Provisioning)

### المشكلة 7 — `ENOENT: no such file or directory, scandir '...packages\db\src\migrations\tenant'`

**السياق:** بعد نجاح تسجيل الدخول كـ Platform Admin، إنشاء tenant جديد كان يفشل.

**السبب الجذري:**
`tenant.usecase.ts` فيه مسار hardcoded مبني على هيكل بيئة التطوير:
```typescript
const migrationsDir = path.join(
  __dirname, '..', '..', '..', '..', '..', '..',
  'packages', 'db', 'src', 'migrations', 'tenant'
);
```
في الإنتاج، `__dirname` مختلف تماماً فالمسار بقى غلط.

> ⚠️ **هذا النوع من الأخطاء لا يظهر عند بدء التشغيل — يظهر فقط عند استخدام الفيتشر المحددة.** يعني ممكن تقول "التطبيق شغال!" بينما في الحقيقة فيه أخطاء كامنة في مسارات لم تُستخدم بعد.

**الحل المعماري الصحيح:**

في `apps/desktop/src/main.ts`:
```typescript
const env = {
  ...process.env,
  // ...
  DB_MIGRATIONS_PATH: path.join(DB_PATH, 'src', 'migrations'),
};
```

في `tenant.usecase.ts`:
```typescript
const migrationsDir = process.env.DB_MIGRATIONS_PATH
  ? path.join(process.env.DB_MIGRATIONS_PATH, 'tenant')
  : path.join(__dirname, '..', '..', '..', '..', '..', '..', 'packages', 'db', 'src', 'migrations', 'tenant');
```

> 💡 **النمط الصحيح:** مصدر حقيقة واحد (`main.ts`) يحسب المسار الصحيح بمعرفة `IS_PACKAGED`، ويمرره لكل مكان يحتاجه عبر env var.

**Audit للتأكد من عدم وجود حالات أخرى:**
```powershell
Get-ChildItem -Path apps\api\src -Recurse -Filter *.ts | Select-String -Pattern "'packages'" -SimpleMatch | Select-Object Path, LineNumber, Line
```
النتيجة: `tenant.usecase.ts` كان **المكان الوحيد** بنفس الـ anti-pattern. ✅

---

## الجزء الثالث: آلية Update Mode الآمنة

### القرار المعماري: Single Installer, Dual Mode

نفس `nabgha-setup.exe` يخدم سيناريوهين:
- **Fresh Install:** لا يوجد `نبغة.exe` في `$INSTDIR` → تثبيت كامل
- **Update:** يوجد `نبغة.exe` في `$INSTDIR` → استبدال الكود فقط + migrations جديدة بس

### نقطة الكشف
```nsi
Function .onInit
  ${IfNot} ${FileExists} "$INSTDIR\نبغة.exe"
    StrCpy $IS_UPDATE "0"
  ${Else}
    StrCpy $IS_UPDATE "1"
  ${EndIf}
FunctionEnd
```

### لماذا هذا آمن جوهريًا؟
قاعدة بيانات PostgreSQL **لا تعيش داخل `$INSTDIR`** إطلاقًا — هي على محرك PostgreSQL منفصل (`C:\Program Files\PostgreSQL\...\data`). فحتى لو الـ installer استبدل كل ملف في مجلد التثبيت، **مستحيل يلمس بيانات قاعدة البيانات**.

### Backup إجباري قبل أي تحديث
```nsi
${If} $IS_UPDATE == "1"
  CreateDirectory "$INSTDIR\backups"
  nsExec::ExecToStack '"$PG_DUMP_PATH" -U postgres -d nabgha -F c -f "$INSTDIR\backups\backup_pre_update.dump"'
  Pop $BACKUP_RESULT
  ${If} $BACKUP_RESULT != 0
    MessageBox MB_YESNO "تحذير: فشل إنشاء نسخة احتياطية!$\nهل تريد المتابعة؟" IDYES continue_update IDNO abort_install
    abort_install:
      Abort
    continue_update:
  ${EndIf}
${EndIf}
```

**أمر الاستعادة في حالة طارئة:**
```cmd
pg_restore -U postgres -d nabgha --clean "C:\Program Files\Nabgha\backups\backup_pre_update.dump"
```

---

## الجزء الرابع: نتائج الاختبار الفعلي الكامل

### اختبار 1 — Fresh Install كامل (قاعدة بيانات فاضية)
```
[Migrate] → Applying: public/001_initial.sql   ← اتنفذت من الـ SQL الجديدة (بدون Prisma)
[Migrate] → Applying: public/schema_migrations
[Migrate] Found 0 tenant(s)
[Migrate] 🎉 All migrations completed successfully!
```
✅ Platform Admin login نجح، Dashboard فاضي كما هو متوقع.

### اختبار 2 — Update فوق 3 Tenants حقيقيين
```
"تحديث نبغة — يوجد تثبيت سابق على جهازك"
[Migrate] ⏭ Skipped: public/001_initial.sql      ← لم يُعَد تنفيذه (آمن)
[Migrate] Found 3 tenant(s)                        ← البيانات محفوظة 100%!
[Migrate] ⏭ Skipped: tenant/001_initial.sql (×3)
[Migrate] 🎉 All migrations completed successfully!
```
✅ الـ 3 tenants موجودين بالكامل بعد التحديث.
✅ إنشاء tenant رابع جديد نجح بدون أي error (تأكيد fix مشكلة 7).

---

## الجزء الخامس: الـ `package.json` النهائي (apps/desktop) — مرجع كامل

```json
{
  "name": "@nabgha/desktop",
  "version": "1.0.0",
  "description": "nabgha Desktop App",
  "main": "dist/main.js",
  "scripts": {
    "dev": "tsc && electron dist/main.js",
    "build": "tsc && electron-builder",
    "pack": "electron-builder --dir"
  },
  "dependencies": {
    "better-sqlite3": "^9.4.3",
    "electron-store": "^8.1.0"
  },
  "devDependencies": {
    "electron": "^29.4.6",
    "electron-builder": "^24.13.3",
    "typescript": "5.9.2"
  },
  "build": {
    "appId": "com.nabgha.desktop",
    "productName": "نبغة",
    "directories": { "output": "release" },
    "win": { "target": "nsis", "icon": "assets/icon.ico" },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": false,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "نبغة",
      "installerIcon": "assets/icon.ico",
      "uninstallerIcon": "assets/icon.ico"
    },
    "files": ["dist/**/*", "assets/**/*"],
    "extraResources": [
      { "from": "../api/dist",                                        "to": "api/dist" },
      { "from": "../api/node_modules_real/node_modules",              "to": "api/node_modules" },
      { "from": "../../packages/types",                               "to": "api/node_modules/@nabgha/types" },
      { "from": "../../packages/db",                                  "to": "api/node_modules/@nabgha/db" },
      { "from": "../web/dist",                                        "to": "web/dist" },
      { "from": "../../packages/db/src",                              "to": "db/src" },
      { "from": "../../packages/db/prisma",                           "to": "db/prisma" },
      { "from": "../../packages/db/node_modules_real/node_modules",   "to": "db/node_modules" },
      { "from": "../api/node_modules_real/node_modules/prisma",       "to": "db/node_modules/prisma" },
      { "from": "../api/node_modules_real/node_modules/@prisma",      "to": "db/node_modules/@prisma" }
    ]
  }
}
```

### شرح كل extraResource

| from | to | لماذا |
|---|---|---|
| `../api/dist` | `api/dist` | الكود الـ compiled بتاع NestJS |
| `../api/node_modules_real/node_modules` | `api/node_modules` | Dependencies flat بدون symlinks (حل مشكلة 1) |
| `../../packages/types` | `api/node_modules/@nabgha/types` | Internal package مطلوب في runtime (مشكلة 2) |
| `../../packages/db` | `api/node_modules/@nabgha/db` | Internal package مطلوب في runtime |
| `../web/dist` | `web/dist` | React build |
| `../../packages/db/src` | `db/src` | `migrate.js` + ملفات `.sql` |
| `../../packages/db/prisma` | `db/prisma` | `schema.prisma` (محتفظ به للـ Prisma Client) |
| `../../packages/db/node_modules_real/node_modules` | `db/node_modules` | Dependencies بتاعة `migrate.js` |
| `.../prisma` (من api) | `db/node_modules/prisma` | Prisma CLI binary |
| `.../@prisma` (من api) | `db/node_modules/@prisma` | `@prisma/client` المولّد |

---

## الجزء السادس: التحسين المعماري النهائي ✅ (منفّذ)

### المشكلة التي كانت موجودة
الاعتماد على `prisma db push --accept-data-loss` في الـ installer — خطير لأن Prisma تقرر بمفردها أي تعديلات (بما فيها الحذف) يجب تطبيقها دون موافقة بشرية.

### الحل المنفّذ

**1. تحديث `packages/db/src/migrations/public/001_initial.sql`:**

```sql
-- ============================================================
-- 001_initial.sql — Public Schema Initial Structure + Seed
-- ============================================================
-- ملاحظة: platform admin بيتنشأ من migrate.js مش هنا
-- هذا الملف ينشئ الجداول أولاً (إذا لم تكن موجودة)
-- ثم يضيف بيانات الخطط الافتراضية
-- ============================================================

-- 1. PLANS
CREATE TABLE IF NOT EXISTS public.plans (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  "maxStudents" INTEGER NOT NULL,
  features      JSONB NOT NULL DEFAULT '{}',
  price         INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. TENANTS
CREATE TABLE IF NOT EXISTS public.tenants (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  plan_id     TEXT NOT NULL REFERENCES public.plans(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  limits      JSONB NOT NULL DEFAULT '{}',
  schema_name TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. PLATFORM_USERS
CREATE TABLE IF NOT EXISTS public.platform_users (
  id              TEXT PRIMARY KEY,
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  name            TEXT NOT NULL,
  is_super_admin  BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Default Plans Seed
INSERT INTO public.plans (id, name, slug, "maxStudents", price, features, created_at, updated_at) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Starter',    'starter',    100,    199, '{"whatsapp":false,"parentPortal":false,"advancedReports":false}', NOW(), NOW()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Pro',        'pro',        500,    499, '{"whatsapp":true,"parentPortal":true,"advancedReports":true}',   NOW(), NOW()),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Enterprise', 'enterprise', 999999, 0,   '{"whatsapp":true,"multiBranch":true,"parentPortal":true,"advancedReports":true}', NOW(), NOW()),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Desktop',    'desktop',    999999, 0,   '{"whatsapp":false,"parentPortal":false,"advancedReports":false}', NOW(), NOW())
ON CONFLICT (slug) DO NOTHING;
```

**2. حذف `prisma db push` من `nabgha-installer.nsi` بالكامل** — الـ NSI الحالية تعتمد فقط على `migrate.js`.

**3. النتيجة:** النظام بالكامل (public + tenant) بقى يعتمد على فلسفة migration واحدة موحدة، idempotent، آمنة 100%.

---

## الجزء السابع: `nabgha-installer.nsi` — النسخة النهائية الكاملة

```nsi
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "nsDialogs.nsh"

Name "نبغة"
OutFile "nabgha-setup.exe"
InstallDir "$PROGRAMFILES64\Nabgha"
RequestExecutionLevel admin

!define MUI_ABORTWARNING
!define MUI_ICON "apps\desktop\assets\icon.ico"

Var PG_PASSWORD
Var Dialog
Var Label
Var PasswordInput
Var PG_FOUND
Var NODE_PATH
Var PSQL_PATH
Var PG_DUMP_PATH
Var IS_UPDATE
Var BACKUP_RESULT

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
Page custom PgPasswordPage PgPasswordPageLeave
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_LANGUAGE "Arabic"

Function .onInit
  ${IfNot} ${FileExists} "$INSTDIR\نبغة.exe"
    StrCpy $IS_UPDATE "0"
  ${Else}
    StrCpy $IS_UPDATE "1"
  ${EndIf}
FunctionEnd

Function PgPasswordPage
  nsExec::ExecToStack 'psql --version'
  Pop $PG_FOUND
  ${If} $PG_FOUND != 0
    StrCpy $PG_PASSWORD "123456"
    Abort
  ${EndIf}
  nsDialogs::Create 1018
  Pop $Dialog
  ${If} $IS_UPDATE == "1"
    ${NSD_CreateLabel} 0 0 100% 40u "تحديث نبغة — يوجد تثبيت سابق على جهازك.$\nأدخل كلمة مرور المستخدم postgres لإتمام التحديث بأمان:"
  ${Else}
    ${NSD_CreateLabel} 0 0 100% 40u "PostgreSQL موجود على جهازك.$\nأدخل كلمة مرور المستخدم postgres:"
  ${EndIf}
  Pop $Label
  ${NSD_CreatePassword} 0 50u 100% 14u ""
  Pop $PasswordInput
  nsDialogs::Show
FunctionEnd

Function PgPasswordPageLeave
  ${NSD_GetText} $PasswordInput $PG_PASSWORD
FunctionEnd

Section "نبغة" SecMain
  SetOutPath "$INSTDIR"

  ${If} $IS_UPDATE == "1"
    DetailPrint "============================================"
    DetailPrint "تحديث مكتشف — جاري المتابعة بوضع التحديث الآمن"
    DetailPrint "============================================"
    DetailPrint "جاري إيقاف نبغة..."
    nsExec::ExecToStack 'taskkill /f /im "نبغة.exe" /t'
    Sleep 2000
  ${Else}
    DetailPrint "============================================"
    DetailPrint "تثبيت جديد"
    DetailPrint "============================================"
  ${EndIf}

  File /r "apps\desktop\release\win-unpacked\*.*"

  nsExec::ExecToStack 'node --version'
  Pop $0
  ${If} $0 != 0
    DetailPrint "جاري تثبيت Node.js..."
    File "/oname=$TEMP\node-installer.msi" "tools\node-v20.19.2-x64.msi"
    ExecWait 'msiexec /i "$TEMP\node-installer.msi" /quiet /norestart'
    Sleep 3000
    DetailPrint "تم تثبيت Node.js"
  ${Else}
    DetailPrint "Node.js موجود بالفعل"
  ${EndIf}

  StrCpy $NODE_PATH "$PROGRAMFILES64\nodejs\node.exe"
  ${IfNot} ${FileExists} "$NODE_PATH"
    StrCpy $NODE_PATH "C:\Program Files\nodejs\node.exe"
  ${EndIf}
  ${IfNot} ${FileExists} "$NODE_PATH"
    StrCpy $NODE_PATH "C:\nvm4w\nodejs\node.exe"
  ${EndIf}
  ${IfNot} ${FileExists} "$NODE_PATH"
    nsExec::ExecToStack 'where node'
    Pop $0
    Pop $NODE_PATH
  ${EndIf}
  DetailPrint "Node path: $NODE_PATH"

  nsExec::ExecToStack 'psql --version'
  Pop $0
  ${If} $0 != 0
    DetailPrint "جاري تثبيت PostgreSQL..."
    File "/oname=$TEMP\pg-installer.exe" "tools\postgresql-windows-x64.exe"
    ExecWait '"$TEMP\pg-installer.exe" --mode unattended --superpassword "123456" --enable-components server,commandlinetools'
    Sleep 8000
    DetailPrint "تم تثبيت PostgreSQL"
    StrCpy $PG_PASSWORD "123456"
  ${Else}
    DetailPrint "PostgreSQL موجود بالفعل"
  ${EndIf}

  StrCpy $PSQL_PATH "C:\Program Files\PostgreSQL\16\bin\psql.exe"
  ${IfNot} ${FileExists} "$PSQL_PATH"
    StrCpy $PSQL_PATH "C:\Program Files\PostgreSQL\17\bin\psql.exe"
  ${EndIf}

  StrCpy $PG_DUMP_PATH "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe"
  ${IfNot} ${FileExists} "$PG_DUMP_PATH"
    StrCpy $PG_DUMP_PATH "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe"
  ${EndIf}

  System::Call 'Kernel32::SetEnvironmentVariable(t "PGPASSWORD", t "$PG_PASSWORD")'

  ${If} $IS_UPDATE == "1"
    DetailPrint "جاري إنشاء نسخة احتياطية من قاعدة البيانات..."
    CreateDirectory "$INSTDIR\backups"
    nsExec::ExecToStack '"$PG_DUMP_PATH" -U postgres -d nabgha -F c -f "$INSTDIR\backups\backup_pre_update.dump"'
    Pop $BACKUP_RESULT
    ${If} $BACKUP_RESULT != 0
      MessageBox MB_YESNO "تحذير: فشل إنشاء نسخة احتياطية من قاعدة البيانات!$\nهل تريد المتابعة بدون نسخة احتياطية؟ (غير موصى به)" IDYES continue_update IDNO abort_install
      abort_install:
        DetailPrint "تم إلغاء التحديث بناءً على طلب المستخدم"
        Abort
      continue_update:
        DetailPrint "تم تجاوز فشل النسخة الاحتياطية بناءً على طلب المستخدم"
    ${Else}
      DetailPrint "تم إنشاء النسخة الاحتياطية بنجاح: $INSTDIR\backups\backup_pre_update.dump"
    ${EndIf}
  ${EndIf}

  DetailPrint "جاري إعداد قاعدة البيانات..."
  nsExec::ExecToStack '"$PSQL_PATH" -U postgres -c "CREATE USER nabgha WITH PASSWORD $\'nabgha123$\';"'
  Pop $0
  nsExec::ExecToStack '"$PSQL_PATH" -U postgres -c "CREATE DATABASE nabgha OWNER nabgha;"'
  Pop $0
  nsExec::ExecToStack '"$PSQL_PATH" -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE nabgha TO nabgha;"'
  Pop $0

  ; الجداول تُنشأ الآن من 001_initial.sql (CREATE TABLE IF NOT EXISTS)
  ; لا حاجة لـ prisma db push خالص
  DetailPrint "جاري تشغيل الـ Migrations..."
  System::Call 'Kernel32::SetEnvironmentVariable(t "DATABASE_URL", t "postgresql://nabgha:nabgha123@127.0.0.1:5432/nabgha")'
  nsExec::ExecToStack '"$NODE_PATH" "$INSTDIR\resources\db\src\migrate.js"'
  Pop $0
  ${If} $0 != 0
    DetailPrint "خطأ: Migration فشلت — راجع الـ logs"
    ${If} $IS_UPDATE == "1"
      MessageBox MB_OK "فشلت عملية التحديث!$\nالنسخة الاحتياطية موجودة في:$\n$INSTDIR\backups\backup_pre_update.dump$\nيرجى التواصل مع الدعم الفني."
    ${EndIf}
  ${Else}
    DetailPrint "تم تشغيل الـ Migrations بنجاح"
  ${EndIf}

  ${If} $IS_UPDATE == "1"
    DetailPrint "تم التحديث بنجاح!"
  ${Else}
    DetailPrint "تم التثبيت بنجاح!"
  ${EndIf}

  CreateDirectory "$SMPROGRAMS\نبغة"
  CreateShortcut "$SMPROGRAMS\نبغة\نبغة.lnk" "$INSTDIR\نبغة.exe"
  CreateShortcut "$DESKTOP\نبغة.lnk" "$INSTDIR\نبغة.exe"

  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Nabgha" "DisplayName" "نبغة"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Nabgha" "UninstallString" "$INSTDIR\Uninstall.exe"

SectionEnd

Section "Uninstall"
  Delete "$INSTDIR\*.*"
  RMDir /r "$INSTDIR"
  Delete "$DESKTOP\نبغة.lnk"
  Delete "$SMPROGRAMS\نبغة\نبغة.lnk"
  RMDir "$SMPROGRAMS\نبغة"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Nabgha"
SectionEnd
```

---

## الجزء الثامن: `build-installer.bat` — الأتمتة الكاملة

موجود في `M:\Projects\Nabgha\build-installer.bat`. **يجب تشغيله من cmd بصلاحيات Administrator.**

```bat
@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo   نبغة - Build Installer Script
echo ========================================
echo.

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [خطأ] لازم تشغل الملف ده كـ Administrator
    pause & exit /b 1
)

set ROOT=M:\Projects\Nabgha
set MAKENSIS="C:\Program Files (x86)\NSIS\makensis.exe"

echo [1/6] جاري إيقاف أي نسخة شغالة من نبغة...
taskkill /f /im "نبغة.exe" /t >nul 2>&1
taskkill /f /im "node.exe" /t >nul 2>&1
timeout /t 2 /nobreak >nul
echo       تم.

echo [2/6] جاري بناء API...
cd /d "%ROOT%\apps\api"
call npx nest build
if %errorLevel% neq 0 ( echo [خطأ] فشل بناء API & pause & exit /b 1 )
echo       تم بناء API بنجاح.

echo [3/6] جاري بناء الواجهة...
cd /d "%ROOT%"
call pnpm --filter web build
if %errorLevel% neq 0 ( echo [خطأ] فشل بناء الواجهة & pause & exit /b 1 )
echo       تم بناء الواجهة بنجاح.

echo [4/6] جاري بناء Electron...
cd /d "%ROOT%\apps\desktop"
call npx tsc
if %errorLevel% neq 0 ( echo [خطأ] فشل بناء Electron & pause & exit /b 1 )
echo       تم بناء Electron بنجاح.

echo [5/6] جاري تجميع التطبيق (electron-builder)...
call npx electron-builder --win
if %errorLevel% neq 0 ( echo [خطأ] فشل electron-builder & pause & exit /b 1 )
echo       تم تجميع التطبيق بنجاح.

echo [6/6] جاري بناء الـ Installer...
cd /d "%ROOT%"
%MAKENSIS% nabgha-installer.nsi
if %errorLevel% neq 0 ( echo [خطأ] فشل بناء الـ Installer & pause & exit /b 1 )
echo       تم بناء الـ Installer بنجاح.

echo.
echo ========================================
echo   تم بناء كل شيء بنجاح!
echo   الملف: %ROOT%\nabgha-setup.exe
echo ========================================
pause
```

> ⚠️ **السكريبت لا يعيد بناء `node_modules_real` تلقائياً** — راجع "الحالة ج" في دليل العمل اليومي.

---

## الجزء التاسع: دليل العمل اليومي

### الحالة أ — تعديل كود فقط (لا تغيير في schema)
```cmd
M:\Projects\Nabgha\build-installer.bat
```
هذا كل ما تحتاجه.

### الحالة ب — إضافة عمود/جدول في tenant schema (الأكثر شيوعًا)
1. أنشئ migration جديدة بترقيم تصاعدي:
```
packages/db/src/migrations/tenant/002_add_national_id.sql
```
```sql
ALTER TABLE students ADD COLUMN IF NOT EXISTS national_id VARCHAR(20);
```
2. عدّل الكود.
3. شغّل `build-installer.bat`.

> ✅ **آمن 100%** بفضل `schema_migrations` tracking table — كل migration تتنفذ مرة واحدة فقط لكل tenant.

### الحالة ج — إضافة عمود/جدول في public schema (plans, tenants)
1. أضف migration جديدة:
```
packages/db/src/migrations/public/002_add_xxx.sql
```
```sql
ALTER TABLE plans ADD COLUMN IF NOT EXISTS new_field TEXT;
```
2. لو التعديل يأثر على `schema.prisma` (موديل جديد)، أعد توليد الـ Prisma Client:
```cmd
cd /d M:\Projects\Nabgha\apps\api\node_modules_real
.\node_modules\.bin\prisma generate --schema=M:\Projects\Nabgha\packages\db\prisma\schema.prisma
:: ثم xcopy الناتج لـ node_modules_real
xcopy /E /I /Y "<pnpm store path>\node_modules\@prisma\client" "node_modules\@prisma\client"
xcopy /E /I /Y "<pnpm store path>\node_modules\.prisma\client" "node_modules\.prisma\client"
```
3. شغّل `build-installer.bat`.

### الحالة د — حذف عمود أو جدول
**لا تحذف مباشرة أبدًا.** استخدم نمط الحذف الآمن على خطوتين:
```sql
-- خطوة 1: أعد تسمية (مش حذف)
ALTER TABLE students RENAME COLUMN old_field TO old_field_deprecated_20260630;
-- انتظر شهر أو أكثر للتأكد
-- خطوة 2 (migration منفصلة لاحقة): احذف بعد التأكد
-- ALTER TABLE students DROP COLUMN IF EXISTS old_field_deprecated_20260630;
```

### قائمة تحقق قبل أي تسليم لعميل حي

- [ ] `build-installer.bat` نجح بالكامل (6 خطوات بدون خطأ)؟
- [ ] لو فيه migration جديدة، اختبرتها على نسخة محلية بها بيانات أولاً؟
- [ ] كل migration جديدة تستخدم `IF NOT EXISTS` أو ما يكافئها؟
- [ ] النسخة الاحتياطية (`backup_pre_update.dump`) ظهرت في الـ installer log بنجاح؟
- [ ] أبلغت العميل بإغلاق التطبيق فعلياً (من Tray) قبل التحديث؟

---

## الجزء العاشر: ملاحظات تشغيلية مهمة

### نظام Tray — التطبيق لا يُغلق بالـ X
التطبيق مصمم يفضل شغال في الخلفية (System Tray) طوال اليوم الدراسي. **للإغلاق الفعلي:** Right-click على الأيقونة في Tray → "إغلاق نبغة".

> ⚠️ **أثر عملي:** عند اختبار أي تحديث يدويًا، تحقق دائمًا من Task Manager أو Tray — إغلاق النافذة وحده لا يوقف العمليات.

### Migration يعمل عند كل تشغيل للتطبيق
```typescript
app.whenReady().then(async () => {
  await runMigrations();  // يُنفَّذ في كل فتح
  await startAPI();
});
```
هذا **تصميم صحيح ومقصود** — يضمن تطبيق أي migration جديدة عند أول تشغيل بعد التحديث. بفضل tracking table، كل ما سبق تنفيذه يُتخطى فوراً (`Skipped`) بدون أي أثر.

### الشبكة ديناميكية بالكامل
- Frontend يستخدم Relative URLs (`/api/v1/...`) — لا يوجد IP مكتوب.
- `getLanIP()` في `main.ts` يحسب IP المحلي ديناميكياً في كل تشغيل.
- **لا حاجة لأي تعديل متعلق بالـ IP** — النظام يتكيف تلقائياً.

> ⚠️ **تحديث Session #030 (Aug 18, 2026):** الجملة أعلاه ("لا حاجة لأي تعديل متعلق بالـ IP") احتاجت تصحيح جزئي — `getLanIP()` القديمة كانت بتاخد أول IPv4 غير داخلي تلاقيه من `os.networkInterfaces()` من غير فلترة، وده ممكن يختار كارت شبكة افتراضي (VPN/VMware/Docker/Hyper-V) بدل الواي فاي/الإيثرنت الحقيقي لو الجهاز عنده أكتر من كارت. اتصلح بمنطق `pickLanIp()` يستبعد أسماء كروت افتراضية معروفة ويفضّل كارت باسمه فيه Wi-Fi/Ethernet — راجع `PROGRESS_TRACKER_updated.md` (قسم "اتصال الشبكة المحلية") لتفاصيل الإصلاح ودليل تشخيص ميداني كامل لمشاكل "الموبايل مش عارف يوصل" (فايرول، نوع الشبكة، برامج حماية، AP isolation).

### مواصفات الجهاز الموصى بها للعميل

| المكون | الحد الأدنى | الموصى به |
|---|---|---|
| نظام التشغيل | Windows 10 64-bit | Windows 10/11 64-bit |
| المعالج | Core i3 جيل 6 | Core i5 أي جيل |
| الذاكرة | 8GB RAM | 8GB RAM |
| التخزين | SSD 128GB | SSD 256GB |
| الشبكة | Wi-Fi | كابل LAN |

> ❌ **لا يعمل على:** Windows 7/8، أنظمة 32-bit، HDD قديم بدون SSD، Pentium/Celeron قديم.

---

## الجزء الحادي عشر: مشاكل جديدة (جلسة أغسطس 2026)

> **السياق:** بعد سبرنت ضخم أضاف موديول تقارير كامل + نسخ احتياطي + إشعارات درجات
> عبر واتساب، اكتشفنا 3 عملاء حقيقيين عندهم "التطبيق بيفتح لحظة وبعدين يقفل بصمت"
> بعد تحديث نسخة. الأقسام دي توثيق كامل للتشخيص والحل.

### المشكلة 8 — التطبيق بيفتح ويقفل بصمت (Puppeteer/Chromium)

**الأعراض:**
شاشة التحميل الخضرا بتظهر، توصل لـ"جاري الاتصال..."، وبعدين **تختفي بصمت من غير أي رسالة خطأ** — لا نافذة رئيسية بتفتح ولا أي تنبيه.

**سبب صعوبة التشخيص:**
`app.whenReady()` في `main.ts` بيلف كل حاجة في `try/catch`، ولو أي خطوة فشلت (migrations، startAPI، أو `waitForAPI()` بعد 60 محاولة/60 ثانية)، الكود بينفذ:
```typescript
catch (err) {
  console.error('Startup failed:', err);
  splash.close();
  app.quit();  // ← يقفل بصمت، الرسالة بتروح لـ console.log اللي محدش شايفه في نسخة مُجمّعة
}
```

**طريقة التشخيص الوحيدة الموثوقة:** تشغيل الـ API يدوياً من الترمينال (خارج Electron تماماً)، بنفس متغيرات البيئة اللي `main.ts` بيظبطها، عشان نشوف الخطأ الحقيقي مطبوع على الشاشة مباشرة:
```cmd
set JWT_SECRET=<JWT_SECRET>
set PLATFORM_JWT_SECRET=<PLATFORM_JWT_SECRET>
set DATABASE_URL=postgresql://nabgha:nabgha123@127.0.0.1:5432/nabgha
set DEPLOY_MODE=desktop
set DOTENV_DISABLED=true
set PORT=3001
node "C:\Program Files\Nabgha\resources\api\dist\main.js"
```

**الخطأ الحقيقي اللي ظهر:**
```
Error: Could not find Chrome (ver. 150.0.7871.24). This can occur if either
1. you did not perform an installation before running the script
2. your cache path is incorrectly configured (which is: C:\Users\{username}\.cache\puppeteer)
    at PdfExportService.onModuleInit (...\pdf-export.service.js:22:24)
```

**السبب الجذري:**
مكتبة Puppeteer الحديثة (v25+) بتحمّل Chromium افتراضياً في **cache خاص بحساب المستخدم على الجهاز** (`%USERPROFILE%\.cache\puppeteer`)، مش جوه `node_modules` نفسها. المسار ده:
1. **مختلف باسم مستخدم مختلف لكل جهاز عميل** — مش قابل للتعميم في installer واحد.
2. **مش بيتنسخ مع أي `extraResource`** في `electron-builder` أصلاً، لإنه برّه فولدر المشروع بالكامل.

وبما إن `PdfExportService.onModuleInit()` بيحاول يشغّل Puppeteer **وقت بداية تشغيل التطبيق نفسه** (Bootstrap)، مش وقت الاستخدام الفعلي للتقارير، أي فشل هنا بيوقف التطبيق بالكامل — حتى لو المستخدم عمره ما هيستخدم فيتشر التقارير.

**الحل المؤقت (لعميل عنده التطبيق مثبت بالفعل):**
```cmd
xcopy /E /I /Y "C:\Program Files\Nabgha\resources\api\node_modules\puppeteer\.local-chromium" "C:\Users\{اسم_المستخدم}\.cache\puppeteer"
```
⚠️ ده حل يدوي **لكل جهاز لوحده** (لازم تعرف اسم المستخدم بالظبط، وفيه مسافات أحياناً زي "Zedan Net" فلازم علامات تنصيص).

**الحل الدائم (في `node_modules_real` + `main.ts`):**

الخطوة 1 — قبل تثبيت Puppeteer في `node_modules_real`، اظبط متغيّر البيئة يوجّهه لمسار داخل المشروع نفسه (مش الـ cache الخاص):
```cmd
cd apps\api\node_modules_real
rmdir /s /q node_modules\puppeteer
set PUPPETEER_CACHE_DIR=%CD%\node_modules\puppeteer\.local-chromium
npm install puppeteer@25.3.0 --legacy-peer-deps
```
تأكيد إن Chromium فعلاً نزل في المكان الصح:
```cmd
node -e "const p = require('./node_modules/puppeteer'); p.launch().then(b => { console.log('SUCCESS'); b.close(); }).catch(e => console.log('FAILED:', e.message));"
```

الخطوة 2 — في `apps/desktop/src/main.ts`، إضافة مسار Chromium الجديد وتمريره كـ env var للـ API process وقت التشغيل:
```typescript
const PUPPETEER_CACHE_PATH = IS_PACKAGED
  ? path.join(RESOURCES, 'api', 'node_modules', 'puppeteer', '.local-chromium')
  : path.join(__dirname, '..', '..', 'api', 'node_modules', 'puppeteer', '.local-chromium');

// جوه startAPI()، ضمن الـ env object:
PUPPETEER_CACHE_DIR: PUPPETEER_CACHE_PATH,
```

> ⚠️ **ملحوظة:** `node_modules_real/package.json` (الملف النظيف المنفصل) كان أصلاً ناقص `archiver`, `exceljs`, `puppeteer` بالكامل — كانوا مُضافين لـ `apps/api/package.json` الأصلي بس نسينا نضيفهم للنسخة النظيفة. تأكد دايماً إن كل مكتبة جديدة موجودة في الملفين.

---

### المشكلة 9 — نافذة بيضة/عالقة ثانية عند بعض العملاء (اكتشاف Node.js الهش)

**السبب الجذري:**
كود اكتشاف Node.js القديم كان بيعتمد على `where node` أولاً، ولو فشلت، fallback هش:
```typescript
// ❌ الكود القديم — كان بيفشل بصمت
nodePath = process.execPath.replace('electron.exe', 'node.exe').replace('electron', 'node');
```
ده بيفترض إن مسار البرنامج المُجمّع (`process.execPath`) فيه الكلمة الحرفية "electron"، لكن التطبيق المُجمّع اسمه **"نبغة.exe"** — مفيهوش الكلمة دي خالص، فالـ `.replace()` مبيغيّرش أي حاجة، والكود بيحاول يشغّل **"نبغة.exe" نفسها كأنها Node.js**.

**الحل — `findNodePath()`:**
```typescript
function findNodePath(): string {
  const knownPaths = [
    path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'nodejs', 'node.exe'),
    'C:\\Program Files\\nodejs\\node.exe',
    'C:\\nvm4w\\nodejs\\node.exe',
  ];
  for (const p of knownPaths) {
    if (fs.existsSync(p)) return p;
  }
  try {
    const { execSync } = require('child_process');
    const cmd = process.platform === 'win32' ? 'where node' : 'which node';
    const result = execSync(cmd).toString().trim().split('\n')[0].trim();
    if (result && fs.existsSync(result)) return result;
  } catch { /* تجاهل — نرمي خطأ واضح تحت */ }
  throw new Error('لم يتم العثور على Node.js على هذا الجهاز — تثبيت نبغة غير مكتمل');
}
```
البحث بمسارات ثابتة معروفة **أولاً** (بدل `where node` بس)، ورمي خطأ واضح بدل fallback هش. مستخدمة في `startAPI()` و`runMigrations()` الاتنين.

---

### المشكلة 10 — النسخ الاحتياطي بيفشل بخطأ `spawn UNKNOWN` (⚠️ مفتوحة، مش متأكد الحل)

**الأعراض:**
```
[API ERROR]: pg_dump failed: spawn UNKNOWN
    context: "BackupUseCase"
POST /api/v1/settings/backup/create 500
```

**التشخيص:**
نفس الأمر بالضبط لو اتنفذ يدوياً بمعاملات منفصلة (`-U`, `-h`, `-d`) بينجح 100% من المرة الأولى:
```cmd
set PGPASSWORD=nabgha123
"C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" -U nabgha -h 127.0.0.1 -d nabgha -F c -f "backup.dump"
```
لكن نفس البيانات لو اتمرّرت كرابط اتصال كامل واحد (`postgresql://user:pass@host:port/db`) لـ`pg_dump` عبر `execFile` من Node.js، بتفشل بخطأ `spawn UNKNOWN` الغامض ده (خطأ عام من Windows نفسه عن تشغيل عملية فرعية، مش من `pg_dump` مباشرة).

**الحل المقترح (لسه مش منفّذ فعلياً في الكود):**
تحويل `backup.usecase.ts` من صيغة الرابط الكامل لمعاملات منفصلة + `PGPASSWORD` كـ environment variable للعملية الفرعية، بدل تضمينه في الرابط:
```typescript
// بدل:
execFileAsync(pgDumpPath, [databaseUrl, '-F', 'c', '-f', dumpFilePath]);

// الأصح (مقترح، يحتاج اختبار):
execFileAsync(pgDumpPath, ['-U', dbUser, '-h', dbHost, '-p', dbPort, '-d', dbName, '-F', 'c', '-f', dumpFilePath], {
  env: { ...process.env, PGPASSWORD: dbPassword },
});
```
> ⚠️ **لو حد بيشتغل على الملف ده بعدين:** التشخيص متأكد (الطريقة اليدوية بالمعاملات المنفصلة شغالة 100% في كل تجاربنا)، لكن التعديل في الكود نفسه لسه محصلش وقت الكتابة. اختبر على جهاز حقيقي قبل التسليم.

---

### دليل تشغيلي: باسورد PostgreSQL مختلف عند بعض العملاء

اتضح إن بعض أجهزة العملاء عندها باسورد `postgres`/`nabgha` **مختلف عن الافتراضي** (`123456`/`nabgha123`) — على الأغلب لإن PostgreSQL كان مثبت على الجهاز من قبل تثبيت نبغة، أو من دعم فني سابق. لو الباسورد الافتراضي مش شغال ومحتاج تصلحه بسرعة (نسخة احتياطية طارئة، تشخيص):

1. **افتح `pg_hba.conf` مؤقتاً** (`C:\Program Files\PostgreSQL\{version}\data\pg_hba.conf`) وابدّل كل `scram-sha-256` بـ `trust` (Find & Replace).
2. **أعد تشغيل الخدمة:** `net stop postgresql-x64-{version}` ثم `net start postgresql-x64-{version}` (من CMD بصلاحيات Administrator).
3. **اتصل من غير باسورد وصلّح الباسوردات:**
   ```cmd
   "C:\Program Files\PostgreSQL\{version}\bin\psql.exe" -U postgres -h 127.0.0.1
   ALTER USER postgres WITH PASSWORD '123456';
   ALTER USER nabgha WITH PASSWORD 'nabgha123';
   \q
   ```
4. **رجّع `pg_hba.conf` لوضعه الأصلي** (`scram-sha-256`) وأعد تشغيل الخدمة تاني — **خطوة إلزامية**، متسيبش القاعدة مفتوحة بـ `trust`.

> ⚠️ **دايماً خد نسخة احتياطية من قاعدة البيانات قبل أي تعديل على `pg_hba.conf` أو الباسوردات**، حتى لو الخطوات دي آمنة نظرياً.

---

## ملخص أوامر مرجعية سريعة

```cmd
:: بناء installer جديد
M:\Projects\Nabgha\build-installer.bat   :: من Admin cmd

:: إعادة توليد Prisma Client بعد تعديل schema.prisma
cd /d M:\Projects\Nabgha\apps\api\node_modules_real
.\node_modules\.bin\prisma generate --schema=M:\Projects\Nabgha\packages\db\prisma\schema.prisma

:: فحص دوري لمسارات hardcoded
cd M:\Projects\Nabgha
powershell -Command "Get-ChildItem -Path apps\api\src -Recurse -Filter *.ts | Select-String -Pattern \"'packages'\" -SimpleMatch | Select-Object Path, LineNumber, Line"

:: استعادة نسخة احتياطية في حالة طارئة
pg_restore -U postgres -d nabgha --clean "C:\Program Files\Nabgha\backups\backup_pre_update.dump"

:: تنظيف كامل للاختبار (لا تستخدم على جهاز عميل!)
taskkill /f /im "نبغة.exe" /t
Remove-Item -Recurse -Force "C:\Program Files\Nabgha"
psql -U postgres -c "DROP DATABASE IF EXISTS nabgha;"
psql -U postgres -c "DROP USER IF EXISTS nabgha;"

:: إعادة تحميل Puppeteer في مسار صحيح داخل node_modules_real (بعد أي تحديث لـ puppeteer)
cd apps\api\node_modules_real
rmdir /s /q node_modules\puppeteer
set PUPPETEER_CACHE_DIR=%CD%\node_modules\puppeteer\.local-chromium
npm install puppeteer@25.3.0 --legacy-peer-deps

:: حل مؤقت لعميل عنده التطبيق مثبت بالفعل قبل الإصلاح الدائم (Puppeteer)
xcopy /E /I /Y "C:\Program Files\Nabgha\resources\api\node_modules\puppeteer\.local-chromium" "C:\Users\{اسم_المستخدم}\.cache\puppeteer"
```
