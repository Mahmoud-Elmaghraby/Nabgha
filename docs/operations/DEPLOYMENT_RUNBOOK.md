# دليل النشر والتشغيل — السيرفر (SaaS)

> **الحالة:** معتمد · **آخر تحديث:** 2026-11-25 · **المسؤول:** محمود
> بيانات الدخول والمفاتيح في `docs/CREDENTIALS.local.md` (على جهاز المطوّر بس).

## 0. قواعد مايتكسروش
1. **السيرفر عليه مشاريع تانية**: `clinic-platform` (فيه ملفات مرضى)، makki، printos، unibox، new-mistak، nmplatform، ubaa. **أي أمر بيلمس نبغة بس**، وممنوع نغيّر nginx العام أو Docker العام.
2. **نسخة احتياطية قبل أي migration** (§5).
3. **المركز التجريبي `demo` أرقامه وهمية، وممنوع نوصّل عليه واتساب حقيقي.**
4. ملف `infra/docker/docker-compose.yml` على السيرفر فيه تعديل محلي خاص بيه. **ماتعملوش reset.**

## 1. شكل السيرفر

| البند | القيمة |
|---|---|
| المزوّد / IP | Contabo · `169.58.33.103` · المستخدم `root` |
| الدومين | `https://nabgha.tcronix.com` |
| الكود | `/var/www/Nabgha` على branch `fix/phase1-stability` |
| الـ API | pm2 باسم `nabgha-api`، port 3003، **بيسمع على `localhost` (IPv6 `::1`) بس** |
| الواجهة | nginx بيعرض `apps/web/dist`، والـ proxy على `http://localhost:3003/api/v1/` |
| قاعدة البيانات | Docker `nabgha_postgres` (user/db: `nabgha`) |
| Redis / التخزين | `nabgha_redis` / `nabgha_minio` |
| البيئة | `NODE_ENV=production` |
| النسخ الاحتياطية | `/root/backups/nabgha/*.dump` |

**المراكز على السيرفر:**
- `demo` (`tenant_f2eaf686_f3b1_454c_894f_a8eee1efc642`).
- `my-center` (`tenant_00000000_0000_0000_0000_000000000001`): قديم ومعمول من غير سجل migrations، **وبنسيبه زي ما هو**. فيه مهمة بتطلّع تحذير "Credit sweep failed" عليه، والتحذير ده عادي ومتوقع.

## 2. طريقة تنفيذ الأوامر من ويندوز
إعدادات الشبكة في جلسات Claude مش بتسمح بـ SSH، فمحمود بيشغّل الأوامر من PowerShell 5.1 بالشكل ده:

```powershell
@'
...bash script...
'@ | ssh -i M:\Projects\makki-platform\.deploy-keys\id_ed25519_makki root@169.58.33.103 "tr -d '\015' | bash"
```

**فخاخ معروفة:**
- السكريبت كله بيتقري من stdin. **أي أمر جوّاه ممكن يقرا من stdin** (`docker exec -i`، pm2، psql، node) لازم ياخد `< /dev/null`، وإلا هيبلع باقي السكريبت وهيقف من غير ما يقول (حصلت يوم 22/11).
- PowerShell 5.1 بيشيل علامات `"` من الـ arguments، فبنبعت السكريبت على stdin دايماً.
- `$` جوّه `@'...'@` مش بتتفك في PowerShell، وده المطلوب.

## 3. نشر تحديث عادي (كود بس)

**على جهاز المطوّر:**
```powershell
cd M:\Projects\Nabgha
git push origin fix/phase1-stability
```

**على السيرفر:**
```bash
set -e
cd /var/www/Nabgha
git pull --ff-only origin fix/phase1-stability < /dev/null
git log --oneline -1
cd apps/api && npx nest build < /dev/null          # لو فيه تعديل في الـ API
cd ../web && pnpm build < /dev/null 2>&1 | tail -1  # لو فيه تعديل في الواجهة
cd ../..
pm2 restart nabgha-api --update-env < /dev/null > /dev/null
# استنّى لحد ما الـ API يقوم (بياخد 10–20 ثانية) — مانفحصش بعد عدد ثواني ثابت
for i in $(seq 1 12); do
  c=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3003/api/v1/health)
  echo "health try $i: $c"; [ "$c" = "200" ] && break; sleep 5
done
```

- ⚠️ **فحص الحالة على `localhost` مش `127.0.0.1`**: الـ API بيسمع على IPv6، فـ `127.0.0.1` بيرجّع `000` حتى لو الـ API شغال.
- لو فيه dependency جديدة اتضافت: `pnpm install --frozen-lockfile < /dev/null` قبل الـ build.
- بعد التحديث: **Ctrl + Shift + R** في المتصفح، لأن فيه PWA service worker.

## 4. تطبيق migration جديدة
**مابنشغّلش `migrate.js` على السيرفر.** لو اتشغّل هيحاول يطبّق كل حاجة من أول وجديد على `my-center`. بدل كده بنطبّق الملف الجديد بنفسنا على كل schema ليها `schema_migrations`، ونسجّله فيها:

```bash
set -e
cd /var/www/Nabgha
MIG=packages/db/src/migrations/tenant/NNN_name.sql     # ← غيّر الاسم
V=tenant/NNN_name.sql
Q() { docker exec nabgha_postgres psql -U nabgha -d nabgha -v ON_ERROR_STOP=1 -At -c "$1" < /dev/null; }
for S in $(Q "select table_schema from information_schema.tables where table_name='schema_migrations' and table_schema like 'tenant_%'"); do
  DONE=$(Q "select count(*) from \"$S\".schema_migrations where version='$V'")
  if [ "$DONE" = "0" ]; then
    { echo "BEGIN; SET search_path TO \"$S\";"; cat $MIG; echo "INSERT INTO \"$S\".schema_migrations(version) VALUES ('$V'); COMMIT;"; } \
      | docker exec -i nabgha_postgres psql -U nabgha -d nabgha -v ON_ERROR_STOP=1 -q >/dev/null
    echo "migrated $S"
  else
    echo "skip $S (already applied)"
  fi
done
```

- كل migration بتتطبّق **جوّه transaction**، فلو فشلت مفيش حاجة بتتغيّر في الـ schema دي.
- لو الـ migration بتعتمد على جدول ممكن يكون مش موجود، ضيف شرط وجوده قبل التطبيق (زي ما عملنا في 027 و028 مع `exams`/`exam_items`).
- **الترتيب:** نسخة احتياطية، ثم الـ migration، ثم build وrestart (لو الكود الجديد محتاج الأعمدة الجديدة).

**حالة السيرفر (2026-11-25):** متطبّق لحد **027** بالتأكيد. **028 لسه محتاجين نتأكد منها**، شغّل أمر الفحص اللي في [DEMO_TENANT §3](DEMO_TENANT.md#3-فحص-الحالة-وتكملة-الناقص).

## 5. النسخ الاحتياطي والرجوع

**نسخة احتياطية:**
```bash
mkdir -p /root/backups/nabgha
docker exec nabgha_postgres pg_dump -U nabgha -d nabgha -Fc > /root/backups/nabgha/before-<what>-$(date +%Y%m%d-%H%M).dump
```

**النسخ الموجودة:**
- `before-update-20261122-0311.dump`: قبل أول تحديث (الكود وقتها كان على `db10e56`).
- `before-exams-20261122-1609.dump`: قبل نشر الامتحانات.

**الرجوع للكود:**
```bash
cd /var/www/Nabgha && git checkout <commit> < /dev/null && cd apps/api && npx nest build && cd ../web && pnpm build && pm2 restart nabgha-api
```
بعد ما ترجع، رجّع الـ branch: `git checkout fix/phase1-stability`.

**الرجوع لقاعدة البيانات (خطير، بيمسح أي بيانات اتعملت بعد النسخة):**
```bash
docker exec -i nabgha_postgres pg_restore -U nabgha -d nabgha --clean --if-exists < /root/backups/nabgha/<file>.dump
```
⚠️ ماتعملهاش غير بعد ما تتأكد. مع المراكز الحقيقية الأفضل نعمل migration تصلّح بدل ما نرجّع نسخة.

## 6. التشخيص

| العَرَض | الفحص |
|---|---|
| الموقع شغال والـ API لأ | `pm2 describe nabgha-api` (status / restarts)، و`pm2 logs nabgha-api --err --lines 60 --nostream` |
| خطأ 500 | `pm2 logs nabgha-api --out --lines 300 --nostream \| grep -E '"level":50'`، والـ `trace` فيه السبب الحقيقي |
| `health: 000` | جرّب `curl http://localhost:3003/api/v1/health` (مش 127.0.0.1)، وممكن الـ API لسه بيقوم |
| `relation "X" does not exist` | جدول في SQL خام أو دالة plpgsql من غير اسم الـ schema ([CONVENTIONS §2.1](../engineering/CONVENTIONS.md#21-الـ-tenant-schema--أهم-قاعدة-في-المشروع)) |
| الواجهة مش باين فيها التعديل | Ctrl+Shift+R (service worker). اتأكد إن `pnpm build` اتعمل بعد الـ pull |
| `TENANT_NOT_FOUND` | الـ slug غلط. الـ slug بيتوحّد (trim + حروف صغيرة) من AUTH-015، فلو لسه بيظهر يبقى المركز مش موجود فعلاً |

## 7. سجل عمليات النشر

| التاريخ | Commit | المحتوى | Migrations |
|---|---|---|---|
| 2026-11-22 | `ba4f522` | أول نشر للفرع + المركز التجريبي | لحد 026 |
| 2026-11-22 | `f7645c2` | الدخول + الواتساب + الامتحانات (باك إند وواجهة) | 027 |
| 2026-11-23 | `b6b5bef` | عجلة الحظ + الباركود + صفحة الهبوط | — |
| 2026-11-23 | `363d711` | سكريبت تعبئة الـ demo: اتضاف 76 سؤال، والامتحانات فشلت بسبب EX-011 | — |
| ⚠️ مش متأكدين | `60b9b1e` | إصلاح trigger الامتحانات (028) + تكملة امتحانات الـ demo | 028 |

> سجّل أي نشر جديد هنا.
