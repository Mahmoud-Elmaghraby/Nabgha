# SESSION 011 — Teachers / Students / Groups Modules
**Date:** 2026-06-15  
**Status:** ✅ Complete — all endpoints live, zero TypeScript errors, migration applied

---

## 1. ملفات اتعملت أو اتعدلت

### جديدة — DB & Types

| المسار | الوصف |
|--------|-------|
| `packages/db/src/migrate-core.js` | Migration script: teachers table + subjects ALTER + groups fixes |
| `packages/db/src/kysely-types.ts` | **معدَّل** — أضاف `TeachersTable`، عدّل `SubjectsTable` و`GroupsTable` |
| `packages/types/permissions.ts` | **معدَّل** — أضاف مجموعة `teachers.*` permissions |

### جديدة — Backend API (`apps/api/src/modules/`)

**Teachers Module**

| المسار | الوصف |
|--------|-------|
| `teachers/domain/entities/teacher.entity.ts` | Domain entity + `update()` + `softDelete()` |
| `teachers/application/dtos/teacher.dto.ts` | Zod schemas: Create / Update |
| `teachers/application/use-cases/teacher.usecase.ts` | CRUD use-cases |
| `teachers/infrastructure/teacher.repository.ts` | Kysely repo + `toEntity()` mapper |
| `teachers/presentation/teacher.controller.ts` | REST controller — 5 routes |
| `teachers/teachers.module.ts` | NestJS module |

**Students Module**

| المسار | الوصف |
|--------|-------|
| `students/domain/entities/student.entity.ts` | Domain entity |
| `students/application/dtos/student.dto.ts` | Create / Update / List schemas |
| `students/application/use-cases/student.usecase.ts` | CRUD + auto-QR-code generation |
| `students/infrastructure/student.repository.ts` | Kysely repo — paginated list + filters |
| `students/presentation/student.controller.ts` | REST controller — 5 routes |
| `students/students.module.ts` | NestJS module |

**Groups Module**

| المسار | الوصف |
|--------|-------|
| `groups/domain/entities/group.entity.ts` | Domain entity + `ScheduleItem` type |
| `groups/application/dtos/group.dto.ts` | Create / Update / List + AddStudent schemas |
| `groups/application/use-cases/group.usecase.ts` | CRUD + addStudent + removeStudent |
| `groups/infrastructure/group.repository.ts` | Kysely repo — student count join + enrollment ops |
| `groups/presentation/group.controller.ts` | REST controller — 8 routes |
| `groups/groups.module.ts` | NestJS module |

### معدَّلة — Backend Config

| المسار | الوصف |
|--------|-------|
| `apps/api/src/app.module.ts` | أضاف `TeachersModule`, `StudentsModule`, `GroupsModule` |

### جديدة — Frontend (`apps/web/src/features/`)

**Teachers Feature**

| المسار | الوصف |
|--------|-------|
| `teachers/types/teacher.types.ts` | TS interfaces: `TeacherDto`, `CreateTeacherPayload`, `UpdateTeacherPayload` |
| `teachers/api/teachers.api.ts` | API client — list / getOne / create / update / delete |
| `teachers/hooks/useTeachers.ts` | `useTeachers(search?)` + `useTeacher(id)` |
| `teachers/hooks/useTeacherMutations.ts` | `useCreateTeacher`, `useUpdateTeacher`, `useDeleteTeacher` |
| `teachers/components/TeachersList.tsx` | DataTable مع delete confirm |
| `teachers/components/TeacherFormModal.tsx` | Dialog — create + edit |
| `teachers/pages/TeachersPage.tsx` | Page الرئيسية مع search |

**Students Feature**

| المسار | الوصف |
|--------|-------|
| `students/types/student.types.ts` | TS interfaces: `StudentDto`, payloads, pagination |
| `students/api/students.api.ts` | API client — CRUD |
| `students/hooks/useStudents.ts` | `useStudents(params)` + `useStudent(id)` |
| `students/hooks/useStudentMutations.ts` | Create / Update / Delete mutations |
| `students/components/StudentsList.tsx` | DataTable مع grade badge |
| `students/components/StudentFormModal.tsx` | Dialog — 6 fields مع قائمة المراحل الدراسية |
| `students/pages/StudentsPage.tsx` | Page مع search + grade filter |

**Groups Feature**

| المسار | الوصف |
|--------|-------|
| `groups/types/group.types.ts` | `GroupDto`, `ScheduleItem`, `DAY_LABELS` map |
| `groups/api/groups.api.ts` | CRUD + `getStudents` + `addStudent` + `removeStudent` |
| `groups/hooks/useGroups.ts` | `useGroups`, `useGroup`, `useGroupStudents` |
| `groups/hooks/useGroupMutations.ts` | 5 mutations + enrollment mutations |
| `groups/components/GroupsList.tsx` | DataTable مع schedule chips + student count |
| `groups/components/GroupFormModal.tsx` | Dialog مع interactive weekly schedule builder |
| `groups/components/GroupStudentsDrawer.tsx` | FormSheet — enrolled list + add-from-search |
| `groups/pages/GroupsPage.tsx` | Page مع search + form modal + drawer |

### معدَّلة — Frontend Router

| المسار | الوصف |
|--------|-------|
| `apps/web/src/app/router.tsx` | أضاف routes `/teachers`, `/students`, `/groups` — بدل `ComingSoon` |

---

## 2. DB Schema — التغييرات الكاملة

### جدول جديد: `teachers` (في كل tenant schema)

```sql
CREATE TABLE teachers (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(255)  NOT NULL,
  phone        VARCHAR(20),
  email        VARCHAR(255),
  subject_ids  JSONB         NOT NULL DEFAULT '[]',
  notes        TEXT,
  is_active    BOOLEAN       NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ
);
```

| Column | Type | Required | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | UUID | ✅ | gen_random_uuid() | PK |
| `name` | VARCHAR(255) | ✅ | — | اسم المدرس |
| `phone` | VARCHAR(20) | ❌ | NULL | رقم الهاتف |
| `email` | VARCHAR(255) | ❌ | NULL | البريد الإلكتروني |
| `subject_ids` | JSONB | ✅ | `[]` | قائمة IDs المواد |
| `notes` | TEXT | ❌ | NULL | ملاحظات |
| `is_active` | BOOLEAN | ✅ | true | |
| `created_at` | TIMESTAMPTZ | ✅ | NOW() | |
| `updated_at` | TIMESTAMPTZ | ✅ | NOW() | |
| `deleted_at` | TIMESTAMPTZ | ❌ | NULL | Soft delete |

### جدول `subjects` — أعمدة مضافة

```sql
ALTER TABLE subjects
  ADD COLUMN IF NOT EXISTS default_fee      NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_type     VARCHAR(20)   NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS session_duration INTEGER       NOT NULL DEFAULT 60;
```

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `default_fee` | NUMERIC(10,2) | 0 | الرسوم الافتراضية للحصة/الشهر |
| `payment_type` | VARCHAR(20) | `'monthly'` | `monthly` / `per_session` |
| `session_duration` | INTEGER | 60 | مدة الحصة بالدقائق |

### جدول `groups` — تعديلات

```sql
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS subject_id UUID;        -- FK اختياري للـ subjects table

ALTER TABLE groups
  ALTER COLUMN teacher_id DROP NOT NULL;           -- كان NOT NULL في migrate-tenants.js
```

| Column | التغيير | السبب |
|--------|---------|-------|
| `subject_id` | **جديد** — UUID NULL | FK اختياري للربط بجدول subjects بدل varchar |
| `teacher_id` | **عُدِّل** — صار nullable | يسمح بإنشاء مجموعة بدون مدرس مؤقتاً |

### جداول موجودة (idempotent في migrate-core.js)

| الجدول | الحالة |
|--------|--------|
| `students` | `CREATE TABLE IF NOT EXISTS` — لم يتغير |
| `groups` | `CREATE TABLE IF NOT EXISTS` + تعديلات فوق |
| `group_students` | `CREATE TABLE IF NOT EXISTS` — لم يتغير |

---

## 3. API Endpoints الجديدة

### Base URL: `http://localhost:3001/api/v1`

> **Auth:** كل الـ endpoints تحتاج `Authorization: Bearer <token>` + `x-tenant-slug` header (أو tenant من الـ JWT).

---

### Teachers — `/teachers`

#### `GET /teachers`
```
Permission : teachers.view
Query Params: search? (string) — يبحث في name / phone / email
Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "أحمد محمد",
      "phone": "01012345678",
      "email": "ahmed@test.com",
      "subjectIds": [],
      "notes": "مدرس رياضيات",
      "isActive": true,
      "createdAt": "2026-06-15T12:16:07.573Z",
      "updatedAt": "2026-06-15T12:16:07.573Z",
      "deletedAt": null
    }
  ]
}
```

#### `GET /teachers/:id`
```
Permission : teachers.view
Response   : { "success": true, "data": { ...TeacherDto } }
Errors     : 404 NOT_FOUND
```

#### `POST /teachers`
```
Permission   : teachers.create
Request Body :
{
  "name": "string (min:2, max:255, required)",
  "phone": "string? (max:20)",
  "email": "string? (email format)",
  "subjectIds": ["uuid", ...],   // default []
  "notes": "string?"
}
Response: { "success": true, "data": { ...TeacherDto } }
```

#### `PUT /teachers/:id`
```
Permission   : teachers.edit
Request Body : (all optional)
{
  "name": "string?",
  "phone": "string? | null",
  "email": "string? | null",
  "subjectIds": ["uuid", ...]?,
  "notes": "string? | null",
  "isActive": boolean?
}
Response: { "success": true, "data": { ...TeacherDto } }
```

#### `DELETE /teachers/:id`
```
Permission : teachers.delete
Action     : Soft delete (sets deleted_at = NOW(), is_active = false)
Response   : { "success": true, "data": { "message": "تم حذف المدرس بنجاح" } }
```

---

### Students — `/students`

#### `GET /students`
```
Permission  : students.view
Query Params:
  search?   string  — يبحث في full_name / parent_phone / student_phone
  grade?    string  — فلتر بالمرحلة الدراسية
  isActive? boolean (true/false as string)
  page?     number  (default: 1)
  limit?    number  (default: 20)
Response:
{
  "success": true,
  "data": {
    "data": [ ...StudentDto[] ],
    "total": 42,
    "page": 1,
    "limit": 20
  }
}
```

#### `GET /students/:id`
```
Permission : students.view
Response   : { "success": true, "data": { ...StudentDto } }
Errors     : 404 NOT_FOUND
```

**StudentDto shape:**
```json
{
  "id": "uuid",
  "fullName": "محمد علي",
  "parentPhone": "01098765432",
  "studentPhone": null,
  "dateOfBirth": null,
  "grade": "الصف الثالث الثانوي",
  "notes": "طالب متميز",
  "qrCode": "STU-9a30a355-25e3-49ac-8c9e-5f5edd8b9791",
  "isActive": true,
  "createdAt": "2026-06-15T12:16:07.606Z",
  "updatedAt": "2026-06-15T12:16:07.606Z",
  "deletedAt": null
}
```

#### `POST /students`
```
Permission   : students.create
Request Body :
{
  "fullName": "string (min:2, required)",
  "parentPhone": "string (min:7, required)",
  "studentPhone": "string?",
  "dateOfBirth": "string? (ISO date: YYYY-MM-DD)",
  "grade": "string?",
  "notes": "string?"
}
Auto-generated: qrCode = "STU-{uuid}"
```

#### `PUT /students/:id`
```
Permission   : students.edit
Request Body : (all optional — same fields as POST + isActive: boolean?)
```

#### `DELETE /students/:id`
```
Permission : students.delete
Action     : Soft delete
Response   : { "success": true, "data": { "message": "تم حذف الطالب بنجاح" } }
```

---

### Groups — `/groups`

#### `GET /groups`
```
Permission  : groups.view
Query Params:
  search?    string  — يبحث في name
  teacherId? uuid    — فلتر بالمدرس
  isActive?  boolean
  page?      number  (default: 1)
  limit?     number  (default: 20)
Response: Paginated<GroupDto> — يشمل studentCount في كل مجموعة
```

**GroupDto shape:**
```json
{
  "id": "uuid",
  "name": "مجموعة الرياضيات أ",
  "subject": "رياضيات",
  "teacherId": "uuid | null",
  "subjectId": "uuid | null",
  "maxStudents": 20,
  "monthlyFee": 500,
  "schedule": [
    { "day": "saturday", "startTime": "16:00", "endTime": "18:00" },
    { "day": "tuesday",  "startTime": "16:00", "endTime": "18:00" }
  ],
  "isActive": true,
  "studentCount": 1,
  "createdAt": "...",
  "updatedAt": "...",
  "deletedAt": null
}
```

#### `GET /groups/:id`
```
Permission : groups.view
Response   : { "success": true, "data": { ...GroupDto } }
```

#### `POST /groups`
```
Permission   : groups.create
Request Body :
{
  "name": "string (min:2, required)",
  "subject": "string? (max:255)",
  "teacherId": "uuid?",
  "subjectId": "uuid?",
  "maxStudents": number (1-200, default:30),
  "monthlyFee": number (≥0, default:0),
  "schedule": [
    { "day": "saturday|sunday|monday|tuesday|wednesday|thursday|friday",
      "startTime": "HH:MM",
      "endTime": "HH:MM" }
  ]
}
```

#### `PUT /groups/:id`
```
Permission   : groups.edit
Request Body : (all optional — same fields as POST + isActive: boolean?)
```

#### `DELETE /groups/:id`
```
Permission : groups.delete
Action     : Soft delete
```

#### `GET /groups/:id/students`
```
Permission : groups.view
Response:
{
  "success": true,
  "data": [
    {
      "enrollment_id": "uuid",
      "joined_at": "ISO datetime",
      "student_id": "uuid",
      "full_name": "محمد علي",
      "parent_phone": "01098765432",
      "student_phone": null,
      "grade": "الصف الثالث الثانوي",
      "is_active": true
    }
  ]
}
```

#### `POST /groups/:id/students`
```
Permission   : groups.edit
Request Body : { "studentId": "uuid" }
Validations  :
  - مجموعة موجودة وغير محذوفة
  - عدد الطلاب < maxStudents  → 400 GROUP_FULL
  - الطالب مش مسجّل أصلاً     → 409 STUDENT_ALREADY_IN_GROUP
Response     : { "success": true, "data": { "message": "تم إضافة الطالب للمجموعة بنجاح" } }
```

#### `DELETE /groups/:id/students/:studentId`
```
Permission : groups.edit
Action     : Sets left_at = NOW() في group_students (soft removal)
Response   : { "success": true, "data": { "message": "تم إزالة الطالب من المجموعة بنجاح" } }
```

---

### جدول ملخص الـ Permissions

| Role | teachers | students | groups |
|------|----------|----------|--------|
| tenant_admin | ✅ كل شيء (`*`) | ✅ | ✅ |
| teacher | view فقط | view فقط | view فقط |
| secretary | view فقط | view + create + edit | view فقط |
| parent | ❌ | view فقط | ❌ |

---

## 4. Business Logic والـ Workflow

### A. Teachers Module

**إزاي بيتضاف مدرس:**
```
1. Admin/Secretary يملأ Form: name (إلزامي) + phone + email + notes
2. POST /teachers → TeacherEntity.create()
3. الـ teacher_id المولود يُستخدم في حقل teacherId في المجموعات
```

**علاقة المدرس بالمواد (`subject_ids`):**
- `subject_ids` هو JSONB array من UUIDs بتشاور على جدول `subjects`
- حالياً stored as reference فقط — مفيش FK enforcement في DB
- لما بتعمل مجموعة، بتختار `teacherId` من الـ teachers table
- المجموعة بتشيل `subject` (نص حر) أو `subject_id` (UUID ref) بالتوازي

**علاقة المدرس بالمجموعات:**
```
Teacher ←——— has many ———→ Groups (via groups.teacher_id)
```
- مدرس واحد ممكن يكون مسؤول عن مجموعات متعددة
- لما تحذف مدرس (soft delete) المجموعات بتافضل كما هي (teacher_id بيفضل يشاور على UUID مش موجود)
- مستقبلاً: لازم handle هذه الحالة (cascade or set null)

---

### B. Students Module

**إزاي بيتسجل طالب:**
```
1. إدخال: fullName + parentPhone (إلزاميين) + بيانات اختيارية
2. POST /students → StudentUseCase.create()
3. System يولّد QR Code تلقائياً: "STU-{uuid}"
4. الطالب بيتخزن في tenant schema — معزول تماماً عن tenants تاني
```

**علاقة الطالب بالمجموعات:**
```
Student ←———many-to-many (via group_students)———→ Group

group_students:
  - group_id   UUID
  - student_id UUID
  - joined_at  TIMESTAMPTZ (auto)
  - left_at    TIMESTAMPTZ (null = نشط في المجموعة)
  - UNIQUE(group_id, student_id)
```

**ملاحظة عن الرسوم:**
- `students` table مفيهاش fee مباشرة
- الرسوم بتتحسب من `groups.monthly_fee` × عدد المجموعات اللي الطالب فيها
- مستقبلاً: `payments` table بيربط student + group + month + amount

---

### C. Groups Module

**إزاي بتتعمل مجموعة:**
```
1. اختيار: name (إلزامي) + subject + teacherId + maxStudents + monthlyFee
2. تحديد الجدول الأسبوعي: يوم + وقت البدء + وقت الانتهاء
3. POST /groups → GroupEntity stored
4. studentCount يبدأ من 0
```

**إزاي بيتضاف طالب لمجموعة:**
```
POST /groups/:id/students { studentId }

Checks:
  ① المجموعة موجودة ومش محذوفة
  ② studentCount < maxStudents (وإلا → 400 GROUP_FULL)
  ③ الطالب مش عنده left_at = null في نفس المجموعة
     (وإلا → 409 STUDENT_ALREADY_IN_GROUP)

Action:
  INSERT INTO group_students (group_id, student_id)
  ON CONFLICT DO UPDATE SET left_at = null
  (يسمح بإعادة الإضافة بعد الإزالة)
```

**حساب الرسوم (Fee Logic):**
```
حالياً (Session 011):
  fee = groups.monthly_fee  ← ثابت على المجموعة

مستقبلاً (Session القادمة):
  1. subjects.default_fee   ← افتراضي للمادة
  2. groups.monthly_fee     ← override على مستوى المجموعة
  3. payments.amount        ← الرسوم الفعلية المدفوعة (custom per payment)

Priority: custom_payment_amount > group.monthly_fee > subject.default_fee
```

**سيناريو انتقال الطالب من مجموعة لأخرى:**
```
الحالة: طالب في "مجموعة الرياضيات أ" ويريد الانتقال لـ "مجموعة الرياضيات ب"

الخطوات:
Step 1: DELETE /groups/{groupA_id}/students/{student_id}
        → sets group_students.left_at = NOW()
        → الطالب "خرج" من المجموعة الأولى تاريخياً

Step 2: POST /groups/{groupB_id}/students { "studentId": "..." }
        → check: groupB.studentCount < groupB.maxStudents
        → INSERT new group_students row (joined_at = NOW())

النتيجة في DB:
  group_students:
  | group_id   | student_id | joined_at  | left_at    |
  |------------|------------|------------|------------|
  | groupA_id  | student_id | 2026-01-01 | 2026-06-15 | ← مغلق
  | groupB_id  | student_id | 2026-06-15 | NULL       | ← نشط

ملاحظة: الـ history محفوظ — تقدر تشوف الطالب كان في إيه ومتى خرج
```

**حالة ON CONFLICT في group_students:**
```sql
ON CONFLICT (group_id, student_id)
DO UPDATE SET left_at = null
```
ده بيسمح بإعادة الإضافة للطالب لو اتمسح من نفس المجموعة قبل كده.

---

## 5. Frontend Pages والـ Components

### TeachersPage (`/teachers`)
```
TeachersPage
├── PageHeader          — title + "إضافة مدرس" button
├── Search Input        — debounced 300ms → useTeachers(search)
├── TeachersList        — DataTable:
│   ├── Avatar (initials + green bg)
│   ├── Name + Email
│   ├── Phone
│   ├── Status badge (نشط / غير نشط)
│   └── Actions (edit / delete with confirm)
└── TeacherFormModal    — Dialog:
    ├── name (required)
    ├── phone + email (grid, optional)
    ├── notes (textarea)
    └── Save / Cancel buttons
```

### StudentsPage (`/students`)
```
StudentsPage
├── PageHeader          — title + "إضافة طالب" button
├── Filters Row
│   ├── Search Input    — debounced → useStudents(search, grade)
│   └── Grade Dropdown  — 14 مرحلة دراسية
├── StudentsList        — DataTable:
│   ├── Avatar (initials + blue bg) + fullName + grade
│   ├── parentPhone (mono font)
│   ├── studentPhone (or —)
│   ├── Status badge
│   └── Actions (edit / delete)
└── StudentFormModal    — Dialog:
    ├── fullName (required)
    ├── parentPhone + studentPhone (grid)
    ├── grade dropdown + dateOfBirth date picker (grid)
    ├── notes (textarea)
    └── Auto-QR generated server-side
```

### GroupsPage (`/groups`)
```
GroupsPage
├── PageHeader          — title + "إضافة مجموعة" button
├── Search Input        — debounced
├── GroupsList          — DataTable:
│   ├── name + subject
│   ├── Schedule chips  — "السبت 16:00", "الثلاثاء 16:00"
│   ├── Student count   — "5 / 20" (actual/max)
│   ├── Monthly fee     — "500 ج.م" أو "مجاني"
│   ├── Status badge
│   └── Actions: view-students / edit / delete
├── GroupFormModal      — Dialog:
│   ├── name (required)
│   ├── subject + teacher dropdown (grid)
│   ├── maxStudents + monthlyFee (grid)
│   └── Weekly Schedule Builder:
│       ├── Day toggle buttons (7 أيام)
│       └── Per-day: startTime + endTime inputs
└── GroupStudentsDrawer — FormSheet (right panel):
    ├── Header: "اسم المجموعة — X/Y طالب"
    ├── Enrolled Students List:
    │   └── Per student: name + phone + grade + "إزالة" button
    └── Add Student Section:
        ├── Debounced search → useStudents(search)
        ├── Available students list (not already enrolled)
        └── Per student: "إضافة" button
```

### Component Reuse Pattern

| Shared Component | مستخدم في |
|-----------------|-----------|
| `DataTable` | TeachersList, StudentsList, GroupsList |
| `PageHeader` | كل الـ pages |
| `FormSheet` | GroupStudentsDrawer |
| `Dialog` (shadcn) | TeacherFormModal, StudentFormModal, GroupFormModal |
| `useDebounce` | TeachersPage, StudentsPage, GroupsPage, GroupStudentsDrawer |

---

## 6. Manual Testing Guide

### الخطوات الكاملة بالـ cURL

**Setup:**
```bash
BASE="http://localhost:3001/api/v1"
TOKEN=$(curl -s $BASE/auth/login -X POST \
  -H "Content-Type: application/json" \
  -d '{"slug":"test-center","username":"admin","password":"Nabgha@TempPass123"}' \
  | jq -r '.data.accessToken')
AUTH="Authorization: Bearer $TOKEN"
```

---

#### ① تسجيل مدرس جديد

```bash
# إنشاء المدرس
curl -s $BASE/teachers -X POST \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{
    "name": "د. سارة أحمد",
    "phone": "01234567890",
    "email": "sara@example.com",
    "subjectIds": [],
    "notes": "مدرسة فيزياء — ثانوي"
  }' | jq .

# التحقق
curl -s $BASE/teachers -H "$AUTH" | jq '.data | length'

# تعديل البيانات
TEACHER_ID="<id من الرد>"
curl -s $BASE/teachers/$TEACHER_ID -X PUT \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"phone": "01111111111", "isActive": true}' | jq .
```

---

#### ② تسجيل طالب جديد

```bash
# إنشاء الطالب
STUDENT=$(curl -s $BASE/students -X POST \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{
    "fullName": "فاطمة محمد",
    "parentPhone": "01055555555",
    "studentPhone": "01066666666",
    "dateOfBirth": "2009-03-15",
    "grade": "الصف الثالث الثانوي",
    "notes": "تحضر بانتظام"
  }')
echo $STUDENT | jq .
STUDENT_ID=$(echo $STUDENT | jq -r '.data.id')

# البحث عن الطالب
curl -s "$BASE/students?search=فاطمة" -H "$AUTH" | jq '.data.data[0].fullName'

# فلتر بالمرحلة
curl -s "$BASE/students?grade=الصف الثالث الثانوي" -H "$AUTH" | jq '.data.total'
```

---

#### ③ إنشاء مجموعة وإضافة طلاب

```bash
TEACHER_ID="<teacher uuid>"
STUDENT_ID="<student uuid>"

# إنشاء المجموعة
GROUP=$(curl -s $BASE/groups -X POST \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d "{
    \"name\": \"فيزياء ثانوي — أ\",
    \"subject\": \"فيزياء\",
    \"teacherId\": \"$TEACHER_ID\",
    \"maxStudents\": 15,
    \"monthlyFee\": 600,
    \"schedule\": [
      {\"day\": \"sunday\",    \"startTime\": \"17:00\", \"endTime\": \"19:00\"},
      {\"day\": \"wednesday\", \"startTime\": \"17:00\", \"endTime\": \"19:00\"}
    ]
  }")
echo $GROUP | jq .
GROUP_ID=$(echo $GROUP | jq -r '.data.id')

# إضافة الطالب
curl -s $BASE/groups/$GROUP_ID/students -X POST \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d "{\"studentId\": \"$STUDENT_ID\"}" | jq .

# عرض الطلاب المسجلين
curl -s $BASE/groups/$GROUP_ID/students -H "$AUTH" | jq '.data[].full_name'

# التحقق من studentCount في قائمة المجموعات
curl -s $BASE/groups -H "$AUTH" | jq '.data.data[0].studentCount'
```

---

#### ④ انتقال طالب من مجموعة لأخرى

```bash
GROUP_A_ID="<uuid المجموعة الأولى>"
GROUP_B_ID="<uuid المجموعة الثانية>"
STUDENT_ID="<uuid الطالب>"

# Step 1: مسح من المجموعة الأولى
curl -s $BASE/groups/$GROUP_A_ID/students/$STUDENT_ID -X DELETE \
  -H "$AUTH" | jq .
# → { "success": true, "data": { "message": "تم إزالة الطالب من المجموعة بنجاح" } }

# Step 2: إضافة للمجموعة الثانية
curl -s $BASE/groups/$GROUP_B_ID/students -X POST \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d "{\"studentId\": \"$STUDENT_ID\"}" | jq .
# → { "success": true, "data": { "message": "تم إضافة الطالب للمجموعة بنجاح" } }

# التحقق: الطالب في المجموعة الثانية فقط
curl -s $BASE/groups/$GROUP_B_ID/students -H "$AUTH" | jq '.data[].full_name'

# التحقق: المجموعة الأولى صفر طلاب
curl -s $BASE/groups/$GROUP_A_ID -H "$AUTH" | jq '.data.studentCount'
```

---

#### اختبار الـ Edge Cases

```bash
# محاولة إضافة طالب لمجموعة ممتلئة (maxStudents=1 وفيها 1)
# → 400: { "code": "GROUP_FULL", "message": "المجموعة وصلت للحد الأقصى من الطلاب" }

# محاولة إضافة نفس الطالب مرتين
curl -s $BASE/groups/$GROUP_ID/students -X POST \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d "{\"studentId\": \"$STUDENT_ID\"}" | jq .
# → 409: { "code": "STUDENT_ALREADY_IN_GROUP" }

# إعادة إضافة طالب بعد إزالته (يجب أن ينجح)
curl -s $BASE/groups/$GROUP_ID/students/$STUDENT_ID -X DELETE -H "$AUTH"
curl -s $BASE/groups/$GROUP_ID/students -X POST -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d "{\"studentId\": \"$STUDENT_ID\"}" | jq .
# → 200 success (ON CONFLICT resets left_at to null)
```

---

## 7. حاجات ناقصة وEdge Cases تحتاج Attention

### ⚠️ Critical — يعطّل الـ data integrity

| # | المشكلة | الحل المقترح |
|---|---------|-------------|
| 1 | **Cascade on teacher soft-delete**: لو اتمسح مدرس، المجموعات بتافضل بـ `teacher_id` مكسور | Migration تضيف ON DELETE SET NULL أو handle في UseCase |
| 2 | **No student existence check in addStudent**: بيحاول insert بـ student_id مش موجود | إضافة `findById` check في `GroupUseCase.addStudent()` |
| 3 | **group_students.left_at logic in ON CONFLICT**: في حالة نادرة ممكن يحصل data race | نضيف transaction |

### 🔶 Important — يأثر على UX

| # | المشكلة | الحل المقترح |
|---|---------|-------------|
| 4 | **TeacherFormModal مش بتعرض subject selector**: `subjectIds` بيتبعت دايماً `[]` | إضافة multi-select للمواد من `useSubjects()` |
| 5 | **GroupStudentsDrawer يرجع snake_case من API**: `full_name`, `student_id` بدل camelCase | إما mapper في الـ repository أو تعديل الـ SELECT aliases |
| 6 | **لا يوجد pagination في GET /teachers**: بيرجع كل المدرسين مرة واحدة | إضافة paginate أو limit معقول (مش مشكلة لو العدد < 100) |
| 7 | **لا يوجد teacher name في GET /groups**: بترجع teacherId بس بدون name | جوين مع teachers في `GroupRepository.findAll()` |

### 🔷 Nice to Have — Features ناقصة

| # | الـ Feature | الأولوية |
|---|------------|---------|
| 8 | **تعديل isActive للطالب من الـ UI** — مش ظاهر في الفورم | Medium |
| 9 | **فلتر المجموعات بالمدرس من الـ UI** — الفلتر موجود في API بس مش في الـ UI | Medium |
| 10 | **QR Code display في profile الطالب** — الـ qrCode موجود لكن مفيش عرض بصري | Low |
| 11 | **Group capacity indicator** — progress bar `5/20` بدل مجرد رقم | Low |
| 12 | **Export students list** | Low |
| 13 | **subject_id FK enforcement** في DB — حالياً stored كـ UUID بدون FK constraint | Medium |

### 🔴 Bug موجود الآن — اتكتشف في Testing

| # | الـ Bug | الملف | الحل |
|---|---------|-------|------|
| 14 | **`groups.teacher_id NOT NULL`** كان بيمنع إنشاء مجموعة بدون مدرس | `migrate-core.js` | ✅ **اتحل** — `ALTER COLUMN teacher_id DROP NOT NULL` |
| 15 | **GroupStudentsDrawer response keys**: الـ component يتوقع `studentId` لكن API بترجع `student_id` | `GroupStudentsDrawer.tsx` line 46 | يحتاج normalize في الـ mapper أو fix في الـ component |

### الترتيب المقترح للـ Session التالية

```
Priority 1 (Fixes):
  - Fix #15 — GroupStudentsDrawer snake_case keys
  - Fix #2  — Student existence check in addStudent
  - Fix #7  — Include teacher name in groups response

Priority 2 (Features):
  - Payments Module (payments table موجودة في migrate-tenants.js)
  - Attendance Module (sessions + attendance tables موجودة)

Priority 3 (Enhancements):
  - SubjectIds multi-select في TeacherFormModal
  - Teacher name join في Groups list
```

---

## Quick Reference — Routes Map

```
GET    /api/v1/teachers                        → list teachers
POST   /api/v1/teachers                        → create teacher
GET    /api/v1/teachers/:id                    → get teacher
PUT    /api/v1/teachers/:id                    → update teacher
DELETE /api/v1/teachers/:id                    → soft-delete teacher

GET    /api/v1/students                        → list students (paginated)
POST   /api/v1/students                        → create student + auto QR
GET    /api/v1/students/:id                    → get student
PUT    /api/v1/students/:id                    → update student
DELETE /api/v1/students/:id                    → soft-delete student

GET    /api/v1/groups                          → list groups (paginated + studentCount)
POST   /api/v1/groups                          → create group
GET    /api/v1/groups/:id                      → get group
PUT    /api/v1/groups/:id                      → update group
DELETE /api/v1/groups/:id                      → soft-delete group
GET    /api/v1/groups/:id/students             → list enrolled students
POST   /api/v1/groups/:id/students             → enroll student
DELETE /api/v1/groups/:id/students/:studentId  → remove student (soft)
```
