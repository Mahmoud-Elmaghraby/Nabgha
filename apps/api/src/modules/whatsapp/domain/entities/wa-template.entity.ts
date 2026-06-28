export const WA_TEMPLATE_KEYS = [
  'ABSENT',
  'PRESENT',
  'LATE',
  'THREE_ABSENCES',
  'PAYMENT_CONFIRM',
  'PAYMENT_DUE',
  'PAYMENT_OVERDUE',
  'NEW_STUDENT',
  'GROUP_ADDED',
  'GROUP_REMOVED',
] as const;

export type WaTemplateKey = typeof WA_TEMPLATE_KEYS[number];

export const WA_DEFAULT_TEMPLATES: Record<WaTemplateKey, string> = {
  ABSENT:           'نبغة: {student_name} غاب عن حصة {subject} اليوم {date} 📚',
  PRESENT:          'نبغة: {student_name} حضر حصة {subject} الساعة {time} ✅',
  LATE:             'نبغة: {student_name} تأخر عن حصة {subject} اليوم {date} ⏰',
  THREE_ABSENCES:   'تنبيه: {student_name} غاب {count} مرات متتالية في {subject} — يرجى التواصل مع المركز',
  PAYMENT_CONFIRM:  'تم استلام {amount} جنيه من {student_name} بتاريخ {date} 🧾 شكراً لثقتكم في {center_name}',
  PAYMENT_DUE:      'تذكير: موعد سداد {student_name} ({amount} جنيه) بعد {days} أيام — {center_name}',
  PAYMENT_OVERDUE:  'تنبيه: تأخر سداد {student_name} بمبلغ {amount} جنيه منذ {days} أيام — يرجى التواصل',
  NEW_STUDENT:      'مرحباً بكم! تم تسجيل {student_name} في {center_name} بنجاح 🎉',
  GROUP_ADDED:      'تم إضافة {student_name} لمجموعة {group_name} — أيام: {days} الساعة {time} 📅',
  GROUP_REMOVED:    'تم إلغاء تسجيل {student_name} من مجموعة {group_name} — {center_name}',
};

export const WA_TEMPLATE_VARIABLES: Record<WaTemplateKey, string[]> = {
  ABSENT:          ['{student_name}', '{subject}', '{date}'],
  PRESENT:         ['{student_name}', '{subject}', '{time}'],
  LATE:            ['{student_name}', '{subject}', '{date}'],
  THREE_ABSENCES:  ['{student_name}', '{subject}', '{count}'],
  PAYMENT_CONFIRM: ['{student_name}', '{amount}', '{date}', '{center_name}'],
  PAYMENT_DUE:     ['{student_name}', '{amount}', '{days}', '{center_name}'],
  PAYMENT_OVERDUE: ['{student_name}', '{amount}', '{days}'],
  NEW_STUDENT:     ['{student_name}', '{center_name}'],
  GROUP_ADDED:     ['{student_name}', '{group_name}', '{days}', '{time}'],
  GROUP_REMOVED:   ['{student_name}', '{group_name}', '{center_name}'],
};

export class WaTemplateEntity {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly key: WaTemplateKey,
    public body: string,
    public isDefault: boolean,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  render(vars: Record<string, string>): string {
    let result = this.body;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replaceAll(`{${key}}`, value);
    }
    return result;
  }

  update(body: string): void {
    this.body = body;
    this.isDefault = false;
    this.updatedAt = new Date();
  }

  resetToDefault(): void {
    this.body = WA_DEFAULT_TEMPLATES[this.key];
    this.isDefault = true;
    this.updatedAt = new Date();
  }

  getMissingVariables(vars: Record<string, string>): string[] {
    const required = WA_TEMPLATE_VARIABLES[this.key];
    return required.filter(v => !Object.keys(vars).includes(v.replace(/{|}/g, '')));
  }
}
