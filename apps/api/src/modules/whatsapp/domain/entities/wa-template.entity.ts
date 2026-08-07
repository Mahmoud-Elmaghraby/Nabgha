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
  'ABSENCE_EXCUSED',
  'GRADE_RECORDED',
] as const;

export type WaTemplateKey = typeof WA_TEMPLATE_KEYS[number];

export const WA_DEFAULT_TEMPLATES: Record<WaTemplateKey, string> = {
  ABSENT:           '{center_name}: نحيطكم علماً بغياب الطالب {student_name} عن حصة {subject} بتاريخ {date}',
  PRESENT:          '{center_name}: تم تسجيل حضور الطالب {student_name} لحصة {subject} في تمام الساعة {time}',
  LATE:             '{center_name}: تم تسجيل تأخر الطالب {student_name} عن حصة {subject} بتاريخ {date}',
  THREE_ABSENCES:   '{center_name}: نلفت انتباهكم إلى غياب الطالب {student_name} {count} مرات متتالية في مادة {subject}. يُرجى التواصل مع إدارة المركز',
  PAYMENT_CONFIRM:  '{center_name}: نفيدكم بأنه تم استلام مبلغ {amount} جنيه من الطالب {student_name} بتاريخ {date}. شكراً لتعاملكم معنا',
  PAYMENT_DUE:      '{center_name}: نذكّركم بأن موعد استحقاق سداد الطالب {student_name} ({amount} جنيه) يحل بعد {days} يوم',
  PAYMENT_OVERDUE:  '{center_name}: نحيطكم علماً بتأخر سداد مستحقات الطالب {student_name} البالغة {amount} جنيه منذ {days} يوم. يُرجى التواصل مع الإدارة',
  NEW_STUDENT:      '{center_name}: تم تسجيل الطالب {student_name} بنجاح. نتمنى له تجربة تعليمية مثمرة',
  GROUP_ADDED:      '{center_name}: تم إلحاق الطالب {student_name} بمجموعة {group_name} — الأيام: {days}، الساعة: {time}',
  GROUP_REMOVED:    '{center_name}: تم إخراج الطالب {student_name} من مجموعة {group_name}',
  ABSENCE_EXCUSED:  '{center_name}: تم اعتبار غياب الطالب {student_name} عن حصة {subject} بتاريخ {date} معذوراً نظراً لحضوره حصة بديلة',
  GRADE_RECORDED:   '{center_name}: درجة الطالب {student_name} في {subject} بتاريخ {date}: {degree} من {out_of}',
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
  GROUP_ADDED:     ['{student_name}', '{group_name}', '{days}', '{time}', '{center_name}'],
  GROUP_REMOVED:   ['{student_name}', '{group_name}', '{center_name}'],
  ABSENCE_EXCUSED: ['{student_name}', '{subject}', '{date}'],
  GRADE_RECORDED: ['{student_name}', '{subject}', '{date}', '{degree}', '{out_of}'],
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
