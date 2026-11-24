# المركز التجريبي (Demo Tenant)

> **الحالة:** معتمد · **آخر تحديث:** 2026-11-25

مركز على السيرفر بنفرّجه للمدرسين المهتمين. لازم يبان كأنه مركز شغال فعلاً.

## 1. بيانات الدخول والمحتوى

| البند | القيمة |
|---|---|
| الرابط | `https://nabgha.tcronix.com` |
| كود المركز (slug) / المستخدم / الباسورد | `demo` / `demo` / `Demo@2026` |
| الـ schema | `tenant_f2eaf686_f3b1_454c_894f_a8eee1efc642` |
| المدرس | أ/ أحمد سامي — رياضيات |
| الطلاب والمجموعات | 66 طالب في 5 مجموعات (أول وتاني وتالت ثانوي) |
| الحصص | 42 حصة على مدار 6 أسابيع فيها حضور ودرجات، وحصة النهارده مفتوحة وفيها حضور بديل |
| المالية | 97 إيصال على خزنتين، ومصروفات |
| بنك الأسئلة | 76 سؤال رياضيات على 9 وحدات، فيهم كل الأنواع والمستويات |
| الامتحانات | امتحانين وتسميعين، وامتحان نوفمبر مربوط بحصة امتحان جاية |

⚠️ **أرقام أولياء الأمور وهمية (`0100000xxxx`). ممنوع نوصّل واتساب حقيقي على المركز ده.**

## 2. السكريبتات

| السكريبت | بيعمل إيه | بيتكرر؟ |
|---|---|---|
| `scripts/demo/seed-demo.mjs` | بيعمل المركز من الأول من خلال الـ API: المادة والصفوف والمدرس والمجموعات والطلاب والحصص والحضور والمالية | لأ، بيتشغّل مرة واحدة على مركز جديد |
| `scripts/demo/seed-exams.mjs` | بنك الأسئلة، والامتحانات والتسميعات بالمولّد الذكي، وربط امتحان بحصة | آه بأمان: الأسئلة المكررة بتتخطى، والامتحان اللي موجود مابيتعملش تاني |

الاتنين بيمرّوا على الـ API، يعني بيعدّوا على نفس الـ validation والقواعد اللي بيعدّي عليها المستخدم. وفي نفس الوقت ده اختبار حقيقي للـ API.

```bash
# على السيرفر
cd /var/www/Nabgha
API_URL=http://localhost:3003/api/v1 PLATFORM_EMAIL=... PLATFORM_PASSWORD=... \
  DEMO_SLUG=demo DEMO_ADMIN_USER=demo DEMO_ADMIN_PASS=Demo@2026 node scripts/demo/seed-demo.mjs < /dev/null

API_URL=http://localhost:3003/api/v1 DEMO_SLUG=demo DEMO_ADMIN_USER=demo DEMO_ADMIN_PASS=Demo@2026 \
  node scripts/demo/seed-exams.mjs < /dev/null
```

## 3. فحص الحالة وتكملة الناقص
الأمر ده آمن تشغّله أكتر من مرة. بيعرض حالة السيرفر، ويطبّق 028 لو ناقصة، ويكمّل الامتحانات:

```bash
set -e
cd /var/www/Nabgha
Q() { docker exec nabgha_postgres psql -U nabgha -d nabgha -v ON_ERROR_STOP=1 -At -c "$1" < /dev/null; }
DEMO=tenant_f2eaf686_f3b1_454c_894f_a8eee1efc642
echo "commit: $(git log --oneline -1)"
echo "028 applied: $(Q "select count(*) from $DEMO.schema_migrations where version='tenant/028_fix_times_used_trigger_schema.sql'")"
echo "questions: $(Q "select count(*) from $DEMO.exam_questions where deleted_at is null")"
echo "exams: $(Q "select count(*) from $DEMO.exams where deleted_at is null")"
# لو 028 = 0 ← طبّقها بالإجراء اللي في DEPLOYMENT_RUNBOOK §4، وبعدين:
API_URL=http://localhost:3003/api/v1 DEMO_SLUG=demo DEMO_ADMIN_USER=demo DEMO_ADMIN_PASS=Demo@2026 node scripts/demo/seed-exams.mjs < /dev/null
```

**المفروض يطلع:** commit `60b9b1e` أو أحدث، و`028 applied: 1`، و`questions: 76`، و`exams: 4`.

## 4. سيناريو العرض المقترح (10 دقايق)
1. **الداشبورد:** حصة النهارده وأرقام الشهر.
2. **الحضور:** سكان كارت → رسالة لولي الأمر. وكمان الحضور البديل ورصيد التعويض.
3. **الدرجات:** رصد الدرجات لحصة امتحان، وإرسالها لأولياء الأمور.
4. **بنك الأسئلة:**
   - المولّد الذكي ← طباعة النموذج (ب) ونموذج إجابته.
   - الاستيراد ← "شوف مثال".
5. **المالية:** تحصيل وطباعة إيصال، وبعدين تقرير الشهر.
6. **الباركود:** طباعة ليبل بشكل QR على اليمين، بعدد نسخ.
7. **عجلة الحظ** على بروجكتور بملء الشاشة.
