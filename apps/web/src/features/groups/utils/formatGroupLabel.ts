import { DAY_LABELS, type DayOfWeek } from '../types/group.types';

interface ScheduleLike {
  day: string;
  startTime: string;
}

interface GroupLike {
  name: string;
  subjectGradeLabel?: string | null;
  schedule?: ScheduleLike[] | null;
}

/** يحوّل جدول المواعيد لنص مقروء، مثال: "الاثنين 4:00 · الخميس 4:00" */
export function formatSchedule(schedule?: ScheduleLike[] | null, separator = ' · '): string {
  if (!schedule || schedule.length === 0) return '';
  return schedule
    .map((s) => `${DAY_LABELS[s.day as DayOfWeek] ?? s.day} ${s.startTime}`)
    .join(separator);
}

/**
 * الشكل الكامل الموحّد لعرض مجموعة في أي قائمة اختيار (dropdown)
 * بيفرّق حتى بين مجموعتين بنفس الاسم ونفس المادة، عن طريق المعاد الدقيق.
 * مثال: "الاتنين والخميس — رياضيات — أول ثانوي — الاثنين 4:00 · الخميس 4:00"
 */
export function getGroupSelectLabel(group: GroupLike): string {
  const parts = [group.name];
  if (group.subjectGradeLabel) parts.push(group.subjectGradeLabel);
  const scheduleStr = formatSchedule(group.schedule);
  if (scheduleStr) parts.push(scheduleStr);
  return parts.join(' — ');
}
