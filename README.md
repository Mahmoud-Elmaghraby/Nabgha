# نبغة (Nabgha)

نظام إدارة متكامل للسناتر والمراكز التعليمية: الطلاب، المجموعات، الحصص والحضور، الدرجات والامتحانات، المالية والتحصيل، التقارير، وإشعارات أولياء الأمور عبر واتساب وتليجرام.

## أوضاع التشغيل

| الوضع | `DEPLOY_MODE` | الوصف |
|---|---|---|
| Desktop | `desktop` | تطبيق Electron على جهاز العميل + PostgreSQL محلي. بيتثبّت بـ installer (NSIS). |
| LAN | `local` | سيرفر محلي في السنتر + nginx HTTPS، الأجهزة توصل عبر الشبكة. |
| SaaS | `saas` | سيرفر سحابي متعدد المراكز. |

كل مركز (tenant) له PostgreSQL schema منفصلة في كل الأوضاع.

## المكونات

```
apps/
  api/        NestJS 11 — Prisma (public schema) + Kysely (tenant schemas)
  web/        React 18 + Vite + Tailwind + shadcn/ui (RTL)
  desktop/    Electron 29 — يشغّل الـ API كـ child process
packages/
  db/         Prisma schema + SQL migrations (packages/db/src/migrations)
  types/      أنواع وصلاحيات مشتركة
  config/, eslint-config/, typescript-config/
infra/docker/ PostgreSQL + Redis + MinIO لبيئة التطوير
```

الموديولات: auth, users, settings, upload, subjects, teachers, students, groups, sessions/attendance, exams, finance, reports, backup, whatsapp, telegram, parent-portal, platform.

## التشغيل للتطوير

المتطلبات: Node 20+، pnpm 10، Docker (أو PostgreSQL محلي).

```bash
pnpm install
cp apps/api/.env.example apps/api/.env      # وعدّل القيم
cp packages/db/.env.example packages/db/.env
docker compose -f infra/docker/docker-compose.yml up -d

pnpm --filter api build && node apps/api/dist/main.js
pnpm --filter web dev
```

تفاصيل التشغيل على ويندوز ووضع Desktop في `docs/DEVELOPER_GUIDE.md`.

## بناء الـ Installer (ويندوز)

شغّل `build-installer.bat` كـ Administrator. الناتج يتحط في `releases/` (متجاهل في git).

## الدوكمنتيشن

| الملف | المحتوى |
|---|---|
| `docs/MASTER_DOC.md` | المعمارية، قاعدة البيانات، القرارات التقنية |
| `docs/DEVELOPER_GUIDE.md` | دليل المطور وتشغيل البيئات |
| `docs/INSTALLER_DEEP_DIVE_v2.md` | الـ installer ومشاكل التثبيت عند العملاء |
| `docs/PROGRESS_TRACKER_updated.md` | حالة كل موديول والخطوات الجاية |
| `ISSUES.md` | المشاكل المعروفة من مراجعة الكود |

بيانات الدخول والتوكنات في `docs/CREDENTIALS.local.md` على جهاز المطور فقط، ومش بتترفع على git.
