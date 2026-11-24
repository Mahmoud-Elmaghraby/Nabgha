# توثيق نبغة — ابدأ من هنا

> **المالك:** محمود المغربي · **آخر مراجعة شاملة:** 2026-11-25 · **الفرع الحالي:** `fix/phase1-stability`

الصفحة دي هي الخريطة لكل التوثيق. أي ملف جديد لازم يتضاف هنا في الجدول المناسب.

---

## 1. حسب اللي محتاجه

| أنا عايز… | اقرا |
|---|---|
| أفهم المنتج والمعمارية في 10 دقايق | [architecture/ARCHITECTURE.md](architecture/ARCHITECTURE.md) |
| أشغّل المشروع على جهازي | [../README.md](../README.md) ← [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) |
| أكتب كود صح من أول مرة (القواعد والفخاخ المعروفة) | [engineering/CONVENTIONS.md](engineering/CONVENTIONS.md) |
| أشغّل الاختبارات أو أضيف اختبار | [engineering/TESTING.md](engineering/TESTING.md) |
| أنشر تحديث على السيرفر | [operations/DEPLOYMENT_RUNBOOK.md](operations/DEPLOYMENT_RUNBOOK.md) |
| أطلّع نسخة ديسكتوب (installer) لعميل | [operations/DESKTOP_RELEASE.md](operations/DESKTOP_RELEASE.md) ← [INSTALLER_DEEP_DIVE_v2.md](INSTALLER_DEEP_DIVE_v2.md) |
| أجهّز أو أصلّح المركز التجريبي (demo) | [operations/DEMO_TENANT.md](operations/DEMO_TENANT.md) |
| أفهم موديول معيّن بالتفصيل | [modules/README.md](modules/README.md) |
| أعرف ليه اتعمل قرار معيّن | [adr/README.md](adr/README.md) |
| أعرف إيه اللي اتغيّر ومتى | [CHANGELOG.md](CHANGELOG.md) |
| أعرف المشاكل المفتوحة والمحلولة | [../ISSUES.md](../ISSUES.md) |
| أعرف إيه الجاي | [ROADMAP.md](ROADMAP.md) |

## 2. خريطة الملفات

```
README.md                      نظرة عامة + تشغيل سريع
ISSUES.md                      سجل المشاكل (مفتوح / محلول) بأرقام ثابتة
docs/
  README.md                    ← انت هنا
  CHANGELOG.md                 كل التغييرات بالتاريخ والـ commit
  ROADMAP.md                   الخطة والمراحل والأولويات
  architecture/ARCHITECTURE.md المعمارية الحالية (المرجع الرسمي)
  engineering/CONVENTIONS.md   قواعد الكود وقاعدة البيانات والـ git
  engineering/TESTING.md       استراتيجية الاختبار وطريقة التشغيل
  operations/DEPLOYMENT_RUNBOOK.md  نشر السيرفر، الـ migrations، الرجوع، الأعطال الشائعة
  operations/DESKTOP_RELEASE.md     قايمة تحقق إصدار الديسكتوب
  operations/DEMO_TENANT.md         المركز التجريبي وسكريبتات تعبئته
  modules/*.md                 توثيق الموديولات (الغرض، الـ API، البيانات، القواعد، الحدود)
  adr/*.md                     سجل القرارات المعمارية (ADR)
  ── مراجع قديمة مفصّلة (Legacy — بتتحدّث عند الحاجة بس) ──
  MASTER_DOC.md                مرجع تقني مفصّل (آخر تحديث شامل أغسطس 2026)
  DEVELOPER_GUIDE.md           دليل تشغيل البيئات (Linux/Windows) بالتفصيل
  INSTALLER_DEEP_DIVE_v2.md    الـ installer ومشاكل التثبيت عند العملاء (مرجع أساسي ولسه صالح)
  PROGRESS_TRACKER_updated.md  سجل تاريخي لحالة الموديولات حتى نوفمبر 2026
  CREDENTIALS.local.md         أسرار وبيانات دخول — على جهاز المطوّر بس (متجاهل في git)
apps/api/test/scenarios/       اختبارات السيناريوهات على Postgres حقيقي
scripts/demo/                  سكريبتات المركز التجريبي
```

## 3. مصدر الحقيقة (Source of Truth)

لو ملفين اختلفوا، الترتيب ده هو اللي بيحكم:

1. **الكود نفسه** و`packages/db/src/migrations`.
2. الملفات الحديثة: `architecture/`، `engineering/`، `operations/`، `modules/`، `adr/`، `CHANGELOG.md`، `ISSUES.md`.
3. المراجع القديمة (`MASTER_DOC`، `DEVELOPER_GUIDE`، `PROGRESS_TRACKER`) — مفيدة للتفاصيل التاريخية، بس ممكن تكون قديمة في نقط معيّنة.

## 4. قواعد التوثيق

- **أي تعديل في السلوك = تحديث التوثيق في نفس الـ commit** (الموديول + `CHANGELOG.md` + `ISSUES.md` لو كان باج).
- **أرقام المشاكل ثابتة ومابتتكررش:** `<MODULE>-<NNN>` (مثلاً `EX-011`، `BAR-003`). المشكلة المحلولة مابتتمسحش، بتتعلّم ✅ ومعاها الـ commit.
- **القرارات المهمة** (اختيار مكتبة، تغيير في قاعدة البيانات، trade-off) بتتكتب ADR جديد ومابنعدّلش ADR قديم — لو القرار اتغيّر نعمل ADR جديد يلغي القديم.
- **اللغة:** عربي واضح للشرح، وأسماء الكود والجداول والـ endpoints زي ما هي بالإنجليزي جوّه `backticks`.
- **التواريخ** بصيغة `YYYY-MM-DD`.
- **ممنوع** أي باسورد أو توكن أو مفتاح في ملفات git — مكانها `docs/CREDENTIALS.local.md` على الجهاز بس.
