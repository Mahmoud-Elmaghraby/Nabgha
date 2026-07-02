// ============================================
// نبغة — مصدر الصلاحيات والأدوار الموحّد
// Single Source of Truth — يُستورد في الـ backend والـ frontend
// ============================================

// ===== الأدوار (ثابتة) =====
export const ROLES = [
  { value: 'tenant_admin', label: 'مدير' },
  { value: 'teacher', label: 'مدرس' },
  { value: 'secretary', label: 'سكرتارية' },
  { value: 'parent', label: 'ولي أمر' },
] as const;

export type UserRole = (typeof ROLES)[number]['value'];

export const ROLE_VALUES = ROLES.map((r) => r.value) as UserRole[];

export function getRoleLabel(role: string): string {
  return ROLES.find((r) => r.value === role)?.label ?? role;
}

// ===== الصلاحيات (تكبر مع الوقت) =====
export interface PermissionDef {
  key: string;
  label: string;
}

export interface PermissionGroup {
  group: string;
  groupLabel: string;
  permissions: PermissionDef[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    group: 'teachers',
    groupLabel: 'المدرسون',
    permissions: [
      { key: 'teachers.view', label: 'عرض المدرسين' },
      { key: 'teachers.create', label: 'إضافة مدرس' },
      { key: 'teachers.edit', label: 'تعديل مدرس' },
      { key: 'teachers.delete', label: 'حذف مدرس' },
    ],
  },
  {
    group: 'students',
    groupLabel: 'الطلاب',
    permissions: [
      { key: 'students.view', label: 'عرض الطلاب' },
      { key: 'students.create', label: 'إضافة طالب' },
      { key: 'students.edit', label: 'تعديل طالب' },
      { key: 'students.delete', label: 'حذف طالب' },
    ],
  },
  {
    group: 'groups',
    groupLabel: 'المجموعات',
    permissions: [
      { key: 'groups.view', label: 'عرض المجموعات' },
      { key: 'groups.create', label: 'إضافة مجموعة' },
      { key: 'groups.edit', label: 'تعديل مجموعة' },
      { key: 'groups.delete', label: 'حذف مجموعة' },
    ],
  },
  {
    group: 'sessions',
    groupLabel: 'الحصص',
    permissions: [
      { key: 'sessions.view', label: 'عرض الحصص' },
      { key: 'sessions.create', label: 'إضافة حصة' },
      { key: 'sessions.edit', label: 'تعديل حصة' },
      { key: 'sessions.delete', label: 'حذف حصة' },
      { key: 'sessions.attendance', label: 'تسجيل الحضور' },
    ],
  },
  {
    group: 'finance',
    groupLabel: 'المالية',
    permissions: [
      { key: 'finance.view', label: 'عرض الحسابات' },
      { key: 'finance.collect', label: 'تحصيل المدفوعات' },
      { key: 'finance.manage', label: 'إدارة الحسابات (الخزائن والمصروفات)' },
    ],
  },
  {
    group: 'reports',
    groupLabel: 'التقارير',
    permissions: [
      { key: 'reports.view', label: 'عرض التقارير' },
      { key: 'reports.export', label: 'تصدير التقارير' },
      { key: 'reports.send_whatsapp', label: 'إرسال رسائل واتساب جماعية' },
    ],
  },
  {
    group: 'settings',
    groupLabel: 'الإعدادات',
    permissions: [
      { key: 'settings.view', label: 'عرض الإعدادات' },
      { key: 'settings.edit', label: 'تعديل الإعدادات' },
    ],
  },
];

export const ALL_PERMISSION_KEYS: string[] = PERMISSION_GROUPS.flatMap((g) =>
  g.permissions.map((p) => p.key),
);

export function getPermissionLabel(key: string): string {
  for (const group of PERMISSION_GROUPS) {
    const found = group.permissions.find((p) => p.key === key);
    if (found) return found.label;
  }
  return key;
}

// ===== الصلاحيات الافتراضية لكل دور =====
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  tenant_admin: ['*'],
  teacher: ['students.view', 'groups.view', 'sessions.view', 'sessions.attendance', 'reports.view', 'teachers.view'],
  secretary: ['students.view', 'students.create', 'students.edit', 'sessions.view', 'sessions.create', 'sessions.edit', 'sessions.attendance', 'finance.view', 'finance.collect', 'teachers.view', 'groups.view'],
  parent: ['students.view'],
};

// ===== دالة التحقق من الصلاحية =====
export function hasPermission(userPermissions: string[], required: string): boolean {
  if (userPermissions.includes('*')) return true;
  if (userPermissions.includes(required)) return true;
  const [resource] = required.split('.');
  if (userPermissions.includes(`${resource}.*`)) return true;
  return false;
}
