import { Injectable, Logger } from '@nestjs/common';
import { AttendanceCreditRepository, CreditRow } from '../../infrastructure/attendance-credit.repository';

/**
 * رصيد التعويض (الحضور البديل) — القواعد:
 *
 * 1. أي حضور لطالب في مجموعة غير مجموعته (نفس المادة والصف) = رصيد واحد.
 * 2. الرصيد بيتصرف على غياب واحد للطالب في نفس المادة/الصف ونفس الأسبوع (سبت → جمعة)،
 *    في حصة حصلت فعلاً (منتهية، أو يومها عدّى واتاخد فيها حضور). أقدم غياب الأول.
 * 3. الترتيب مش مهم: لو حضر البديل قبل الغياب، الرصيد بيستنى ويتصرف أول ما الغياب
 *    يحصل (عند إنهاء الحصة، أو تسجيله غايب صراحةً، أو المطابقة اليومية).
 * 4. أي تراجع بيترجع صح:
 *    - الغياب المعذور اتعدّل لحاضر/متأخر → الرصيد يرجع متاح ويدوّر على غياب تاني.
 *    - الحضور البديل اتشال (اتسجل غايب/اتمسح بالغلط) → الرصيد يتلغي، والغياب اللي
 *      كان اتعذر بيه يرجع غايب (أو ياخد رصيد تاني لو موجود).
 *    - حصة اتلغت أو اتمسحت → نفس اللي فوق لكل الأرصدة اللي ليها علاقة بيها.
 */
@Injectable()
export class AttendanceCreditService {
  private readonly logger = new Logger(AttendanceCreditService.name);

  static readonly DEFAULT_NOTE = 'معذور — حضر حصة بديلة في مجموعة أخرى بنفس الأسبوع';

  constructor(private readonly repo: AttendanceCreditRepository) {}

  // ─── الأسبوع: من السبت للجمعة ─────────────────────────────
  static toDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  static weekBounds(date: Date | string): { weekStart: string; weekEnd: string } {
    const d = typeof date === 'string' ? new Date(`${date.slice(0, 10)}T00:00:00`) : new Date(date);
    d.setHours(0, 0, 0, 0);
    const daysSinceSaturday = (d.getDay() + 1) % 7; // السبت=0 .. الجمعة=6
    const start = new Date(d);
    start.setDate(d.getDate() - daysSinceSaturday);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { weekStart: this.toDateStr(start), weekEnd: this.toDateStr(end) };
  }

  private static weekEndOf(weekStart: string): string {
    const d = new Date(`${weekStart}T00:00:00`);
    d.setDate(d.getDate() + 6);
    return this.toDateStr(d);
  }

  // ─── السيناريوهات ─────────────────────────────────────────

  /**
   * طالب حضر في مجموعة غير مجموعته: يتعمل له رصيد، ولو عنده غياب حصل فعلاً في نفس
   * الأسبوع يتصرف عليه على طول. بيرجع رقم سجل الغياب اللي اتعذر (لو حصل).
   */
  async onExternalAttendance(tenantId: string, args: {
    sessionId: string; sessionDate: Date; sessionTitle: string;
    attendanceId: string; studentId: string; subjectGradeId: string;
  }): Promise<{ excusedAbsenceId: string | null }> {
    const { weekStart, weekEnd } = AttendanceCreditService.weekBounds(args.sessionDate);
    const credit = await this.repo.createForExternal(tenantId, {
      studentId: args.studentId,
      subjectGradeId: args.subjectGradeId,
      sourceSessionId: args.sessionId,
      sourceAttendanceId: args.attendanceId,
      weekStart, weekEnd,
    });
    const note = `معذور — حضر بديل في حصة "${args.sessionTitle}" يوم ${new Date(args.sessionDate).toLocaleDateString('ar-EG')}`;
    const excusedAbsenceId = await this.matchCredit(tenantId, credit, note);
    return { excusedAbsenceId };
  }

  /** غياب (صريح أو عند إنهاء الحصة): لو فيه رصيد متاح في نفس الأسبوع يتصرف عليه */
  async excuseAbsenceIfCredit(tenantId: string, args: {
    absenceAttendanceId: string; studentId: string; subjectGradeId: string; sessionDate: Date;
  }): Promise<boolean> {
    const { weekStart } = AttendanceCreditService.weekBounds(args.sessionDate);
    const creditId = await this.repo.consumeOnAbsence(tenantId, {
      absenceAttendanceId: args.absenceAttendanceId,
      note: AttendanceCreditService.DEFAULT_NOTE,
      studentId: args.studentId, subjectGradeId: args.subjectGradeId, weekStart,
    });
    return !!creditId;
  }

  /**
   * غياب معذور اتعدّل لحاضر/متأخر: الرصيد يرجع متاح ويدوّر على غياب تاني.
   * بيرجع سجلات الغياب التانية اللي اتعذرت بالرصيد ده (عشان نبعت إشعار).
   */
  async onExcusedRecordChanged(tenantId: string, attendanceId: string): Promise<string[]> {
    const credit = await this.repo.releaseConsumedBy(tenantId, attendanceId);
    if (!credit) return [];
    const excused = await this.matchCredit(tenantId, credit);
    return excused ? [excused] : [];
  }

  isExternal(tenantId: string, attendanceId: string): Promise<boolean> {
    return this.repo.isExternal(tenantId, attendanceId);
  }

  /**
   * حضور بديل اتشال (اتسجل غايب بالغلط): الرصيد يتلغي، والغياب اللي اتعذر بيه
   * يرجع غايب إلا لو فيه رصيد تاني يغطيه. سجل الحضور البديل نفسه بيتمسح من الحصة
   * (الطالب أصلاً مش من المجموعة دي، فمايفضلش "غايب" فيها ويتحسب عليه).
   */
  async removeExternalAttendance(tenantId: string, attendanceId: string): Promise<void> {
    const credit = await this.repo.findBySource(tenantId, attendanceId);
    if (credit) await this.revokeAndRecover(tenantId, credit);
    await this.repo.deleteAttendanceRow(tenantId, attendanceId);
  }

  /**
   * حصة اتلغت أو اتمسحت:
   * - الأرصدة اللي اتصرفت على غيابات فيها ترجع متاحة وتدوّر على غياب تاني.
   * - الأرصدة اللي اتولدت من حضور بديل فيها تتلغي، وغياباتها ترجع.
   * بيرجع سجلات الغياب اللي اتعذرت من جديد (للإشعار).
   */
  async onSessionVoided(tenantId: string, sessionId: string): Promise<string[]> {
    const { sourced, consumedHere } = await this.repo.findForSession(tenantId, sessionId);
    const newlyExcused: string[] = [];

    for (const credit of consumedHere) {
      if (!credit.consumedAttendanceId) continue;
      const released = await this.repo.releaseConsumedBy(tenantId, credit.consumedAttendanceId);
      // الحصة نفسها اتلغت، فالمطابقة هتلاقي بس غيابات في حصص تانية
      if (released) {
        const id = await this.matchCredit(tenantId, released);
        if (id) newlyExcused.push(id);
      }
    }

    for (const credit of sourced) {
      await this.revokeAndRecover(tenantId, credit);
    }

    return newlyExcused;
  }

  /**
   * مطابقة دورية: أرصدة متاحة من آخر أسبوعين على غيابات حصلت بعد ما الرصيد اتعمل
   * (مثلاً حضر البديل الاتنين، وغاب عن حصته الأربع والمدرس ما داسش "إنهاء").
   */
  async matchPendingCredits(tenantId: string): Promise<string[]> {
    const since = new Date();
    since.setDate(since.getDate() - 14);
    const { weekStart } = AttendanceCreditService.weekBounds(since);
    const credits = await this.repo.findAvailableSince(tenantId, weekStart);
    const excused: string[] = [];
    for (const credit of credits) {
      const id = await this.matchCredit(tenantId, credit);
      if (id) excused.push(id);
    }
    return excused;
  }

  // ─── داخلي ────────────────────────────────────────────────

  private async matchCredit(tenantId: string, credit: CreditRow, note?: string): Promise<string | null> {
    if (credit.status !== 'available') return null;
    const weekEnd = AttendanceCreditService.weekEndOf(credit.weekStart);
    // محاولتين: لو الغياب الأول اتغيّر في نفس اللحظة نجرب اللي بعده
    for (let attempt = 0; attempt < 2; attempt++) {
      const absence = await this.repo.findEligibleAbsence(
        tenantId, credit.studentId, credit.subjectGradeId, credit.weekStart, weekEnd,
      );
      if (!absence) return null;
      const consumed = await this.repo.consumeOnAbsence(tenantId, {
        absenceAttendanceId: absence.attendanceId,
        creditId: credit.id,
        note: note ?? AttendanceCreditService.DEFAULT_NOTE,
      });
      if (consumed) return absence.attendanceId;
    }
    return null;
  }

  private async revokeAndRecover(tenantId: string, credit: CreditRow): Promise<void> {
    const { revertedAbsenceId } = await this.repo.revoke(tenantId, credit.id);
    if (!revertedAbsenceId) return;
    // الغياب رجع "غايب" — لو عند الطالب رصيد تاني متاح في نفس الأسبوع يغطيه
    const recovered = await this.repo.consumeOnAbsence(tenantId, {
      absenceAttendanceId: revertedAbsenceId,
      note: AttendanceCreditService.DEFAULT_NOTE,
      studentId: credit.studentId, subjectGradeId: credit.subjectGradeId, weekStart: credit.weekStart,
    });
    if (!recovered) {
      this.logger.log(`Excused absence ${revertedAbsenceId} reverted to absent (credit ${credit.id} revoked)`);
    }
  }
}
