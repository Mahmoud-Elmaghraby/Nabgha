# النسخ الاحتياطي (Backup)

> **الحالة:** ✅ اتراجع (2026-11-25) · **الكود:** `apps/api/src/modules/settings` (backup*) · `apps/web/src/features/settings`

## 1. الغرض
نسخة كاملة من بيانات البرنامج على جهاز العميل (قاعدة البيانات + ملفات التخزين زي الشعار والصور)، علشان لو الجهاز أو قاعدة البيانات باظت، البيانات ماتضيعش.

**متاح في الديسكتوب بس** (`DEPLOY_MODE=desktop`). على السيرفر النسخ بيتعمل من إدارة السيرفر ([DEPLOYMENT_RUNBOOK](../operations/DEPLOYMENT_RUNBOOK.md)). السبب إن `pg_dump` بياخد قاعدة البيانات كلها، يعني كل المراكز (BACKUP-006).

## 2. المستخدم بيعمل إيه
- **الإعدادات ← النسخ الاحتياطي:**
  - كارت الحالة: "آخر نسخة سليمة من …"، أو آخر فشل وسببه بالأحمر.
  - زرار "خد نسخة احتياطية دلوقتي".
  - مفتاح النسخ التلقائي، وهو **مفعّل افتراضياً**.
  - قايمة النسخ، وكل نسخة مكتوب جنبها "تلقائي" أو "يدوي"، ومعاها زرار تحميل.
- **الصفحة الرئيسية:** تنبيه أحمر لو مفيش نسخة سليمة من أكتر من 48 ساعة، أو لو مفيش نسخة خالص وآخر محاولة فشلت. فيه زرار بيفتح `/settings?tab=backup`. التنبيه بيظهر بس للي عنده صلاحية `settings.view`.

## 3. الـ API (`/settings/backup`)
| Method | المسار | الصلاحية | ملاحظات |
|---|---|---|---|
| GET | `availability` | `settings.view` | `{ available }`، والواجهة بتخفي التبويب لو `false` |
| GET | `status` | `settings.view` | `{ available, autoEnabled, running, lastSuccessAt, lastFailureAt, lastError, stale }`. برّا الديسكتوب بترجع `available=false` ومابتلمسش حاجة |
| POST | `create` | `settings.edit` | نسخة يدوية. 409 `BACKUP_IN_PROGRESS` لو فيه نسخة شغالة |
| GET | `list` | `settings.view` | فيها `kind: auto/manual` |
| GET | `download/:filename` | `settings.view` | حماية من path traversal |
| GET/PUT | `auto-backup` | view/edit | |

كل المسارات (ماعدا `availability` و`status`) عليها `BackupAvailabilityGuard`، و`createBackup` نفسها بتشيك تاني.

## 4. خطوات النسخة (`BackupUseCase.createBackup`)
1. `pg_dump -F c`. المسار بيتحدد من `PgDumpLocatorService`: `PG_DUMP_PATH`، أو الـ PATH، أو `C:/D:\Program Files\PostgreSQL\12–18`.
2. **الفحص (BACKUP-008):** توقيع `PGDMP`، وبعدين `pg_restore -f - <dump>` بيقرا الملف كله ويرمي الناتج. لو `pg_restore` مش موجود جنب `pg_dump`، بيكتفي بالتوقيع (`verification: header-only` في الـ manifest).
3. zip فيه `database.dump` + `storage/` + `manifest.json` (`trigger`، `tenantId`، `verification`).
4. الـ dump الخام بيتمسح في كل الحالات، والـ zip الناقص بيتمسح لو الضغط فشل.
5. النجاح والفشل بيتسجّلوا في `tenant_settings`.

**المكان:** `%APPDATA%\Nabgha\backups\`، والأسماء:
- `nabgha-backup-auto-<ts>.zip`: نسخة تلقائية.
- `nabgha-backup-<ts>.zip`: نسخة يدوية، أو نسخة قديمة اتعملت قبل التحديث.

## 5. النسخ التلقائي (`ScheduledBackupUseCase`)
- بيكشف كل ساعة (`40 * * * *`)، وبعد تشغيل البرنامج بـ 3 دقايق.
- بيعمل نسخة لو: النسخ التلقائي مفعّل، ومفيش نسخة شغالة، وآخر نسخة ناجحة أقدم من 24 ساعة (أو مفيش)، وآخر فشل أقدم من 50 دقيقة.
- لو مفيش سجل لآخر نجاح (عملاء قبل التحديث)، بياخد تاريخ أحدث ملف نسخة.
- التنضيف: آخر 7 نسخ **تلقائية** بس. النسخ اليدوية مابتتمسحش.

## 6. البيانات (`tenant_settings`)
| المفتاح | القيمة |
|---|---|
| `auto_backup_enabled` | `'false'` = مقفول بقرار المستخدم. أي قيمة تانية أو مفيش = مفعّل |
| `backup_last_success_at` | ISO |
| `backup_last_failure_at` | ISO |
| `backup_last_error` | أول 300 حرف من السبب |

## 7. الحدود المعروفة
- **BACKUP-004:** النسخ على نفس الهارد. مؤجّل بقرار المالك.
- **BACKUP-005:** مفيش استرجاع من البرنامج. الاسترجاع يدوي من الدعم:
  1. نفك الـ zip.
  2. `pg_restore -U nabgha -d nabgha --clean --if-exists database.dump` والبرنامج مقفول.
  3. ننسخ `storage/` لـ `%APPDATA%\Nabgha\storage`.
- النسخ القديمة اللي اتعملت قبل التحديث بتتعامل كيدوية، فمابتتمسحش تلقائي.

## 8. الاختبارات
`apps/api/test/scenarios/backup.check.ts`: 38 فحص. بيغطي القفل برّا الديسكتوب، والتفعيل الافتراضي، واللحاق، والفحص (ملف بايظ أو مقطوع)، وتسجيل الفشل، ونسختين في نفس الوقت، والتنضيف.

## 9. المشاكل المرتبطة
BACKUP-001 → BACKUP-009 في [`ISSUES.md`](../../ISSUES.md).
