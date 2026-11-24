# نبغة (Nabgha)

نظام إدارة متكامل للمدرسين والسناتر التعليمية في مصر. بيغطي:
- الطلاب والمجموعات والحصص، والحضور بالباركود ورصيد التعويض.
- الدرجات، وبنك الأسئلة والامتحانات والتسميعات.
- المالية: المستحقات والتحصيل والخزن.
- التقارير.
- إشعارات أولياء الأمور على واتساب وتليجرام، وبوابة لولي الأمر.

| | |
|---|---|
| **التوثيق** | **[docs/README.md](docs/README.md) ← ابدأ من هنا** |
| المعمارية | [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) |
| المشاكل | [ISSUES.md](ISSUES.md) |
| التغييرات | [docs/CHANGELOG.md](docs/CHANGELOG.md) |
| الخطة | [docs/ROADMAP.md](docs/ROADMAP.md) |

## أوضاع التشغيل

| الوضع | `DEPLOY_MODE` | الوصف |
|---|---|---|
| Desktop | `desktop` | تطبيق Electron على جهاز العميل + PostgreSQL محلي. التثبيت بـ installer (NSIS). |
| LAN | `local` | سيرفر محلي في السنتر + nginx HTTPS، والأجهزة بتوصل على الشبكة. |
| SaaS | `saas` | سيرفر سحابي فيه مراكز كتير. حالياً `https://nabgha.tcronix.com`. |

كل مركز (tenant) ليه PostgreSQL schema منفصلة في كل الأوضاع.

## المكونات

```
apps/
  api/        NestJS 11 — Prisma (public schema) + Kysely (tenant schemas)
  web/        React 18 + Vite + Tailwind + shadcn/ui (RTL)
  desktop/    Electron 29 — بيشغّل الـ API كـ child process
packages/
  db/         Prisma schema + SQL migrations (packages/db/src/migrations)
  types/      أنواع وصلاحيات مشتركة
  config/, eslint-config/, typescript-config/
infra/docker/ PostgreSQL + Redis + MinIO لبيئة التطوير
scripts/demo/ تعبئة المركز التجريبي
```

## التشغيل للتطوير

**المتطلبات:** Node 20+، وpnpm 10، وDocker أو PostgreSQL محلي.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env      # وعدّل القيم
cp packages/db/.env.example packages/db/.env
docker compose -f infra/docker/docker-compose.yml up -d
cd packages/db && node src/migrate.js && cd ../..

pnpm --filter api build && node apps/api/dist/main.js
pnpm --filter web dev
```

تفاصيل التشغيل على ويندوز ووضع الديسكتوب في [docs/DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md).

## الجودة قبل أي commit

```bash
pnpm --filter api check-types                       # لازم تعدّي من غير أخطاء
pnpm --filter web build                             # لازم ينجح
cd apps/api && pnpm test:scenarios                  # 131 فحص على Postgres حقيقي (شوف docs/engineering/TESTING.md)
```

القواعد كلها في [docs/engineering/CONVENTIONS.md](docs/engineering/CONVENTIONS.md).

## النشر

- **السيرفر:** [docs/operations/DEPLOYMENT_RUNBOOK.md](docs/operations/DEPLOYMENT_RUNBOOK.md).
- **الديسكتوب:** شغّل `build-installer.bat` كـ Administrator، والناتج بيتحط في `releases/` (متجاهل في git). قايمة التحقق في [docs/operations/DESKTOP_RELEASE.md](docs/operations/DESKTOP_RELEASE.md).

## الأسرار
بيانات الدخول والتوكنات في `docs/CREDENTIALS.local.md` على جهاز المطوّر بس، ومش بتترفع على git.
