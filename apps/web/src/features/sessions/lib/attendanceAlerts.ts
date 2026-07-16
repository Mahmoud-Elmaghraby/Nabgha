// منطق التنبيه المشترك بين كل مسارات تسكين الحضور (سكانر الباركود، الكاميرا،
// التسكين اليدوي، الطالب البديل) — مكان واحد عشان الصوت والرسالة يفضلوا متطابقين
// بدل ما يتكرروا في كل مكون لوحده.

export type AttendanceAlertLevel = 'success' | 'warning' | 'error';

export interface AttendanceAlertMessage {
  text: string;
  level: AttendanceAlertLevel;
}

export interface AttendanceWarnings {
  isUnpaid: boolean;
  wasPrevAbsent: boolean;
}

export function checkAttendanceWarnings(
  studentId: string | null | undefined,
  previousAbsent: string[],
  unpaidStudents: string[],
): AttendanceWarnings {
  return {
    isUnpaid: !!studentId && unpaidStudents.includes(studentId),
    wasPrevAbsent: !!studentId && previousAbsent.includes(studentId),
  };
}

// نص التحذير لوحده (من غير ايموجي/بادئة) — يُستخدم لبناء رسائل مركّبة
// (زي حالة الطالب البديل اللي ليها نص أساسي مختلف)
export function buildWarningSuffix(warnings: AttendanceWarnings): string | null {
  if (warnings.isUnpaid && warnings.wasPrevAbsent) return 'عليه فلوس لسه، وكان غايب الحصة اللي فاتت';
  if (warnings.isUnpaid) return 'عليه فلوس لسه متدفعتش';
  if (warnings.wasPrevAbsent) return 'كان غايب الحصة اللي فاتت';
  return null;
}

export function buildAttendanceMessage(studentName: string, warnings: AttendanceWarnings): AttendanceAlertMessage {
  const suffix = buildWarningSuffix(warnings);
  if (suffix) return { text: `⚠️ ${studentName} — حاضر، و${suffix}`, level: 'warning' };
  return { text: `✅ ${studentName} — حاضر`, level: 'success' };
}

// نفس نغمتَي الإنذار الموجودتين أصلاً في وضع الكاميرا (440 ثم 330 هرتز) —
// اتنقلوا هنا عشان يبقوا متاحين لكل مسارات التسكين مش بس الكاميرا
export function playAttendanceWarningAlarm(): void {
  try {
    const ctx = new AudioContext();
    const osc1 = ctx.createOscillator();
    osc1.connect(ctx.destination);
    osc1.frequency.value = 440;
    osc1.start();
    osc1.stop(ctx.currentTime + 0.3);
    setTimeout(() => {
      try {
        const osc2 = ctx.createOscillator();
        osc2.connect(ctx.destination);
        osc2.frequency.value = 330;
        osc2.start();
        osc2.stop(ctx.currentTime + 0.3);
      } catch { /* AudioContext ممكن يترفض لو الصفحة مش متفاعل معاها لسه */ }
    }, 350);
  } catch { /* AudioContext ممكن يترفض لو الصفحة مش متفاعل معاها لسه */ }
}
