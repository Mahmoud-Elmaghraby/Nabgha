import { Injectable, Logger, Inject } from '@nestjs/common';
import { SendNotificationUseCase } from '../../../whatsapp/application/use-cases/send-notification.usecase';
import { StorageService } from '../../../../shared/infrastructure/storage/storage.service';
import { IWaBulkJobRepository, WA_BULK_JOB_REPOSITORY } from '../../../whatsapp/domain/repositories/wa.repository.interface';
import { BrandingService } from '../../../settings/application/services/branding.service';
import { KyselyService } from '../../../../shared/infrastructure/database/kysely.service';
import { sql } from 'kysely';
import { SessionRepository } from '../../infrastructure/session.repository';
import { SessionEntity, AttendanceEntity } from '../../domain/entities/session.entity';
import { AppError } from '../../../../core/errors/app.error';
import type {
  CreateSessionDto, UpdateSessionDto, ListSessionsDto,
  UpdateAttendanceDto, BulkUpdateAttendanceDto, ScanQrDto,
} from '../dtos/session.dto';

@Injectable()
export class SessionUseCase {
  private readonly logger = new Logger(SessionUseCase.name);

  constructor(
    private readonly repo: SessionRepository,
    private readonly sendNotification: SendNotificationUseCase,
    private readonly kysely: KyselyService,
    private readonly branding: BrandingService,
    private readonly storage: StorageService,
    @Inject(WA_BULK_JOB_REPOSITORY) private readonly bulkJobRepo: IWaBulkJobRepository,
  ) {}

  async list(tenantId: string, params: ListSessionsDto) {
    return this.repo.findAll(tenantId, params);
  }

  async getById(tenantId: string, id: string): Promise<SessionEntity> {
    const session = await this.repo.findById(tenantId, id);
    if (!session) throw new AppError('NOT_FOUND', 'الحصة غير موجودة', 404);
    return session;
  }

  async create(tenantId: string, data: CreateSessionDto, userId: string): Promise<SessionEntity> {
    const session = await this.repo.create(tenantId, data, userId);
    let studentIds: string[] = [];
    if (data.type === 'grade_exam') {
      studentIds = await this.repo.getStudentsByGrade(tenantId, data.grade!);
    } else if (data.groupId) {
      studentIds = await this.repo.getStudentsByGroup(tenantId, data.groupId);
    }
    await this.repo.initAttendance(tenantId, session.id, studentIds);
    this.logger.log(`Session created: ${session.id} — type: ${session.type} — ${studentIds.length} students`);
    return session;
  }

  async update(tenantId: string, id: string, data: UpdateSessionDto): Promise<SessionEntity> {
    const session = await this.getById(tenantId, id);
    if (!session.isOpen) throw new AppError('INVALID_STATUS', 'لا يمكن تعديل حصة منتهية أو ملغاة', 400);
    session.update(data as any);
    await this.repo.save(tenantId, session);
    return session;
  }

  async start(tenantId: string, id: string): Promise<SessionEntity> {
    const session = await this.getById(tenantId, id);
    if (session.status !== 'scheduled') throw new AppError('INVALID_STATUS', 'الحصة ليست في حالة مجدولة', 400);
    session.start();
    await this.repo.save(tenantId, session);
    return session;
  }

  async complete(tenantId: string, id: string): Promise<SessionEntity> {
    const session = await this.getById(tenantId, id);
    if (session.status !== 'ongoing') throw new AppError('INVALID_STATUS', 'الحصة ليست جارية', 400);
    session.complete();
    await this.repo.save(tenantId, session);

    // فحص رصيد التعويض لكل الغيابات الافتراضية (اللي محدش لمسها يدوي) قبل إقفال الحصة نهائياً
    if (session.groupId) {
      const absentRecords = await this.repo.findAbsentAttendanceForSession(tenantId, id);
      for (const record of absentRecords) {
        await this.tryExcuseWithCredit(tenantId, session, record).catch(err =>
          this.logger.error(`Credit sweep failed for student ${record.studentId}: ${err.message}`),
        );
      }
    }

    return session;
  }

  async cancel(tenantId: string, id: string): Promise<SessionEntity> {
    const session = await this.getById(tenantId, id);
    if (!session.isOpen) throw new AppError('INVALID_STATUS', 'لا يمكن إلغاء حصة منتهية', 400);
    session.cancel();
    await this.repo.save(tenantId, session);
    return session;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const session = await this.getById(tenantId, id);
    if (session.status === 'ongoing') throw new AppError('INVALID_STATUS', 'لا يمكن حذف حصة جارية', 400);
    session.softDelete();
    await this.repo.save(tenantId, session);
  }

  async setImage(tenantId: string, id: string, imageUrl: string): Promise<SessionEntity> {
    const session = await this.getById(tenantId, id);
    if (!session.hasImage) throw new AppError('INVALID_TYPE', 'هذا النوع لا يدعم الصور', 400);
    // لو فيه صورة قديمة، نمسحها من التخزين قبل ما نستبدلها — تجنباً لتراكم ملفات يتيمة
    if (session.imageUrl) {
      await this.storage.deleteFile(session.imageUrl).catch(() => {});
    }
    session.update({ imageUrl });
    await this.repo.save(tenantId, session);
    return session;
  }

  async removeImage(tenantId: string, id: string): Promise<SessionEntity> {
    const session = await this.getById(tenantId, id);
    if (session.imageUrl) {
      await this.storage.deleteFile(session.imageUrl).catch(() => {});
    }
    session.update({ imageUrl: null });
    await this.repo.save(tenantId, session);
    return session;
  }

  async getAttendance(tenantId: string, sessionId: string): Promise<AttendanceEntity[]> {
    await this.getById(tenantId, sessionId);
    return this.repo.findAttendance(tenantId, sessionId);
  }

  async updateAttendance(
    tenantId: string, sessionId: string, studentId: string, data: UpdateAttendanceDto,
  ): Promise<AttendanceEntity> {
    const session = await this.getById(tenantId, sessionId);
    // ملاحظة: رصد/تصحيح الدرجة مسموح حتى لو الحصة "منتهية" — التصحيح غالباً بيحصل
    // بعد انتهاء الامتحان فعلياً (تصحيح الأوراق ياخد وقت). تحديث حالة الحضور نفسها
    // (حاضر/غايب/متأخر) بس اللي بيتطلب حصة لسه مفتوحة (مجدولة/جارية).
    if (!session.isOpen && data.status !== undefined) {
      throw new AppError('INVALID_STATUS', 'الحصة مغلقة', 400);
    }
    const record = await this.repo.findAttendanceRecord(tenantId, sessionId, studentId);
    if (!record) throw new AppError('NOT_FOUND', 'الطالب غير مسجل في هذه الحصة', 404);

    // ─── تحديث حالة الحضور (لو صراحة اتبعتت) ───
    // منفصل تماماً عن رصد الدرجة — عشان تعديل درجة طالب مايبعتش رسالة "حضور" مكررة كل مرة.
    if (data.status !== undefined) {
      // لو التسجيل الصريح "غايب"، افحص رصيد التعويض الأول قبل ما تثبته غياب فعلي
      if (data.status === 'absent' && session.groupId) {
        const excused = await this.tryExcuseWithCredit(tenantId, session, record);
        if (excused) return record;
      }

      if (data.status === 'present') record.markPresent();
      else if (data.status === 'absent') record.markAbsent();
      else record.markLate();

      await this.repo.saveAttendance(tenantId, record);

      // WhatsApp notification — fire and forget
      this.sendAttendanceNotification(tenantId, session, record, data.status)
        .catch(err => this.logger.error('WA notification failed: ' + err.message));
    }

    // ─── رصد الدرجة (تسجيل صامت فقط — الإرسال قرار صريح من المدرّس لاحقاً،
    // إما فردي (زرار "إرسال" لكل طالب) أو جماعي (زرار "إرسال الكل" بعد المراجعة) ───
    if (data.degree !== undefined && session.hasGrades) {
      if (!session.outOf) {
        throw new AppError('INVALID_SESSION', 'هذه الحصة لا تحتوي على درجة قصوى محددة', 400);
      }
      if (data.degree > session.outOf) {
        throw new AppError('INVALID_DEGREE', `الدرجة لا تتجاوز ${session.outOf}`, 400);
      }
      record.setDegree(data.degree);
      await this.repo.saveAttendance(tenantId, record);
    }

    if (data.notes !== undefined) {
      record.notes = data.notes;
      await this.repo.saveAttendance(tenantId, record);
    }

    return record;
  }

  private mapWaErrorToArabic(error?: string): string {
    const map: Record<string, string> = {
      not_connected: 'الواتساب غير متصل حالياً',
      wa_disabled: 'خدمة الواتساب معطّلة',
      outside_send_hours: 'خارج ساعات الإرسال المسموحة',
      session_banned: 'حساب الواتساب محظور مؤقتاً',
      phone_not_on_whatsapp: 'رقم ولي الأمر غير مسجّل على واتساب',
      daily_limit_reached: 'تم الوصول للحد الأقصى اليومي للرسائل',
      template_not_found: 'قالب الرسالة غير موجود',
      notification_disabled: 'هذا النوع من الإشعارات معطّل من الإعدادات',
      no_phone: 'لا يوجد رقم هاتف مسجّل لولي الأمر',
    };
    return map[error ?? ''] ?? 'فشل الإرسال لسبب غير معروف';
  }

  /** إرسال فردي — يرجع فوراً (fire-and-forget)، الإرسال الفعلي (بتأخيره الأمني) بيحصل في الخلفية */
  async resendGradeNotification(tenantId: string, sessionId: string, studentId: string): Promise<void> {
    const session = await this.getById(tenantId, sessionId);
    const record = await this.repo.findAttendanceRecord(tenantId, sessionId, studentId);
    if (!record) throw new AppError('NOT_FOUND', 'الطالب غير مسجل في هذه الحصة', 404);
    if (record.degree === null) throw new AppError('VALIDATION_ERROR', 'لم يتم رصد درجة لهذا الطالب بعد', 400);

    this.sendGradeNotification(tenantId, session, record)
      .then(async (result) => {
        if (result.success) {
          await this.repo.markGradeNotified(tenantId, record.id);
        } else {
          this.logger.warn(`Grade notification failed for ${record.studentId}: ${this.mapWaErrorToArabic(result.error)}`);
        }
      })
      .catch((err) => this.logger.error(`Grade notification error: ${err.message}`));
  }

  /** إرسال جماعي — بيرجع Job ID فوراً، الإرسال الفعلي بيحصل في الخلفية مع تتبّع تقدّم حقيقي */
  async sendAllGradeNotifications(tenantId: string, sessionId: string, createdBy: string): Promise<{ jobId: string }> {
    const session = await this.getById(tenantId, sessionId);
    const allAttendance = await this.repo.findAttendance(tenantId, sessionId);
    const pending = allAttendance.filter(r =>
      r.degree !== null && (!r.gradeNotifiedAt || r.updatedAt > r.gradeNotifiedAt)
    );

    const job = await this.bulkJobRepo.create({
      tenantId,
      title: 'إرسال الدرجات',
      body: `الحصة: ${session.title}`,
      total: pending.length,
      createdBy,
      scheduledAt: null,
    });

    this.processGradeNotificationsInBackground(tenantId, session, pending, job.id)
      .catch((err) => this.logger.error(`Bulk grade job failed: ${err.message}`));

    return { jobId: job.id };
  }

  private async processGradeNotificationsInBackground(
    tenantId: string, session: SessionEntity, pending: AttendanceEntity[], jobId: string,
  ): Promise<void> {
    const job = await this.bulkJobRepo.findById(tenantId, jobId);
    if (!job) return;
    job.start();
    await this.bulkJobRepo.save(job);

    for (const record of pending) {
      try {
        const result = await this.sendGradeNotification(tenantId, session, record);
        if (result.success) {
          await this.repo.markGradeNotified(tenantId, record.id);
          job.incrementSent();
        } else {
          job.incrementFailed();
        }
      } catch (err: any) {
        this.logger.error(`Bulk grade notify failed for ${record.studentId}: ${err.message}`);
        job.incrementFailed();
      }
      await this.bulkJobRepo.save(job);
    }
  }

  async getGradeNotificationJobProgress(tenantId: string, jobId: string) {
    const job = await this.bulkJobRepo.findById(tenantId, jobId);
    if (!job) return null;
    return {
      jobId: job.id, total: job.total, sent: job.sent,
      failed: job.failed, progress: job.progress, status: job.status,
    };
  }

  private async sendGradeNotification(
    tenantId: string, session: SessionEntity, record: AttendanceEntity,
  ): Promise<{ success: boolean; error?: string }> {
    if (!record.parentPhone || record.degree === null) return { success: false, error: 'no_phone' };

    const branding = await this.branding.getBrandingInfo(tenantId, { groupId: session.groupId ?? undefined });
    const subject = session.groupName || session.grade || session.title;
    const date = new Date(session.startDate).toLocaleDateString('ar-EG');

    let imageBuffer: Buffer | undefined;
    if (session.imageUrl) {
      const buffer = await this.storage.getFileBuffer(session.imageUrl);
      if (buffer) imageBuffer = buffer;
    }

    const result = await this.sendNotification.execute({
      tenantId,
      phone: record.parentPhone,
      templateKey: 'GRADE_RECORDED',
      vars: {
        student_name: record.studentName || '',
        subject,
        date,
        degree: String(record.degree),
        out_of: String(session.outOf ?? ''),
        center_name: branding.name,
      },
      imageBuffer,
    });
    return result;
  }

  // ─── نظام رصيد التعويض (حضور بديل في مادة أخرى) ────────────

  async addExternalAttendance(
    tenantId: string, sessionId: string, identifier: { studentId?: string; studentCode?: string },
  ): Promise<{ attendance: AttendanceEntity; excusedAbsence: boolean; creditCreated: boolean }> {
    const session = await this.getById(tenantId, sessionId);
    if (!session.isOpen) throw new AppError('SESSION_CLOSED', 'الحصة مغلقة', 400);
    if (!session.groupId) throw new AppError('INVALID_SESSION_TYPE', 'هذه الميزة متاحة فقط لحصص المجموعات', 400);

    let studentId = identifier.studentId;
    if (!studentId && identifier.studentCode) {
      const resolved = await this.repo.resolveStudentIdByCode(tenantId, identifier.studentCode);
      if (!resolved) throw new AppError('NOT_FOUND', 'كود الطالب غير موجود', 404);
      studentId = resolved;
    }
    if (!studentId) throw new AppError('VALIDATION_ERROR', 'بيانات الطالب غير كافية', 400);

    const already = await this.repo.isStudentInAttendance(tenantId, sessionId, studentId);
    if (already) throw new AppError('CONFLICT', 'الطالب مسجل بالفعل في حضور هذه الحصة', 409);

    const subjectGradeId = await this.repo.getGroupSubjectGradeId(tenantId, session.groupId);
    if (!subjectGradeId) throw new AppError('INVALID_GROUP', 'المجموعة غير مرتبطة بمادة', 400);

    const record = await this.repo.addExternalAttendance(tenantId, sessionId, studentId);
    const { weekStart, weekEnd } = this.getWeekBounds(session.startDate);

    const pendingAbsence = await this.repo.findPendingAbsenceForSubject(
      tenantId, studentId, subjectGradeId, weekStart, weekEnd,
    );

    if (pendingAbsence) {
      pendingAbsence.markExcused();
      pendingAbsence.notes = `معذور — حضر بديل في حصة "${session.title}" بتاريخ ${session.startDate.toLocaleDateString('ar-EG')}`;
      await this.repo.saveAttendance(tenantId, pendingAbsence);

      this.sendExcusedNotification(tenantId, pendingAbsence, session)
        .catch(err => this.logger.error('ABSENCE_EXCUSED notification failed: ' + err.message));

      return { attendance: record, excusedAbsence: true, creditCreated: false };
    }

    await this.repo.createAttendanceCredit(tenantId, {
      studentId, subjectGradeId,
      sourceSessionId: sessionId, sourceAttendanceId: record.id,
      weekStart, weekEnd,
    });

    return { attendance: record, excusedAbsence: false, creditCreated: true };
  }

  private async tryExcuseWithCredit(
    tenantId: string, session: SessionEntity, record: AttendanceEntity,
  ): Promise<boolean> {
    if (!session.groupId) return false;
    const subjectGradeId = await this.repo.getGroupSubjectGradeId(tenantId, session.groupId);
    if (!subjectGradeId) return false;

    const { weekStart, weekEnd } = this.getWeekBounds(session.startDate);
    const credit = await this.repo.findAvailableCredit(tenantId, record.studentId, subjectGradeId, weekStart, weekEnd);
    if (!credit) return false;

    record.markExcused();
    record.notes = 'معذور — لديه رصيد تعويض (حضر بديل في مادة أخرى بنفس الأسبوع)';
    await this.repo.saveAttendance(tenantId, record);
    await this.repo.consumeCredit(tenantId, credit.id, record.id);

    this.sendExcusedNotification(tenantId, record, session)
      .catch(err => this.logger.error('ABSENCE_EXCUSED notification failed: ' + err.message));

    return true;
  }

  private getWeekBounds(date: Date): { weekStart: Date; weekEnd: Date } {
    // الأسبوع: من السبت للخميس — الجمعة إجازة وبرة الحساب
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay(); // 0=أحد .. 6=سبت
    const daysSinceSaturday = (day - 6 + 7) % 7;
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - daysSinceSaturday);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 5);
    weekEnd.setHours(0, 0, 0, 0);
    return { weekStart, weekEnd };
  }

  private async sendExcusedNotification(
    tenantId: string, record: AttendanceEntity, session: SessionEntity,
  ): Promise<void> {
    if (!record.parentPhone) return;
    const branding = await this.branding.getBrandingInfo(tenantId, { groupId: session.groupId ?? undefined });
    const subject = session.groupName || session.grade || session.title;
    const date = new Date(session.startDate).toLocaleDateString('ar-EG');

    const result = await this.sendNotification.execute({
      tenantId,
      phone: record.parentPhone,
      templateKey: 'ABSENCE_EXCUSED' as any,
      vars: {
        student_name: record.studentName || '',
        subject,
        date,
        center_name: branding.name,
      },
    });
    this.logger.log('ABSENCE_EXCUSED SendNotification result: ' + JSON.stringify(result));
  }

  async bulkUpdateAttendance(
    tenantId: string, sessionId: string, data: BulkUpdateAttendanceDto,
  ): Promise<{ failed: { studentId: string; reason: string }[] }> {
    const session = await this.getById(tenantId, sessionId);
    if (!session.isOpen) throw new AppError('INVALID_STATUS', 'الحصة مغلقة', 400);

    const failed: { studentId: string; reason: string }[] = [];

    await Promise.all(data.updates.map(async update => {
      const record = await this.repo.findAttendanceRecord(tenantId, sessionId, update.studentId);
      if (!record) return;
      if (update.status === 'present') record.markPresent();
      else if (update.status === 'absent') record.markAbsent();
      else record.markLate();

      if (update.degree !== undefined && session.hasGrades) {
        if (!session.outOf) {
          failed.push({ studentId: update.studentId, reason: 'الحصة لا تحتوي على درجة قصوى محددة' });
        } else if (update.degree > session.outOf) {
          failed.push({ studentId: update.studentId, reason: `الدرجة لا تتجاوز ${session.outOf}` });
        } else {
          record.setDegree(update.degree);
        }
      }
      if (update.notes !== undefined) record.notes = update.notes;
      await this.repo.saveAttendance(tenantId, record);
    }));

    return { failed };
  }

  async getPreviousAbsentStudents(tenantId: string, sessionId: string): Promise<string[]> {
    const session = await this.getById(tenantId, sessionId);
    if (!session.groupId) return [];
    return this.repo.getPreviousAbsentStudents(tenantId, sessionId, session.groupId);
  }

  async getUnpaidStudents(tenantId: string, sessionId: string): Promise<string[]> {
    const session = await this.getById(tenantId, sessionId);
    if (!session.groupId) return [];
    return this.repo.getUnpaidStudentIds(tenantId, session.groupId);
  }

  async getAbsenceReport(tenantId: string, sessionId: string) {
    await this.getById(tenantId, sessionId);
    return this.repo.getAbsenceReport(tenantId, sessionId);
  }

  async scanQr(tenantId: string, sessionId: string, data: ScanQrDto): Promise<AttendanceEntity> {
    const session = await this.getById(tenantId, sessionId);
    if (!session.isOpen) throw new AppError('SESSION_CLOSED', 'الحصة مغلقة', 400);
    // الـ QR ممكن يكون JSON أو student_code مباشرة
    let qrCode = data.qrCode;
    try {
      const parsed = JSON.parse(data.qrCode);
      if (parsed.code) qrCode = parsed.code;
    } catch {}
    const record = await this.repo.findAttendanceByQr(tenantId, sessionId, qrCode);
    if (!record) throw new AppError('NOT_FOUND', 'QR غير موجود أو الطالب غير مسجل', 404);
    if (record.status === 'present') return record;
    record.markPresent(new Date());
    await this.repo.saveAttendance(tenantId, record);
    this.logger.log(`QR scan: ${record.studentCode} → present in session ${sessionId}`);

    // WhatsApp notification — fire and forget
    this.sendAttendanceNotification(tenantId, session, record, 'present')
      .catch(err => this.logger.error('WA scan notification failed: ' + err.message));

    return record;
  }

  // ─── Private: WhatsApp Notification ──────────────────────
  private async sendAttendanceNotification(
    tenantId: string,
    session: SessionEntity,
    record: AttendanceEntity,
    status: string,
  ): Promise<void> {
    if (!record.parentPhone) return;

    const branding = await this.branding.getBrandingInfo(tenantId, { groupId: session.groupId ?? undefined });

    const subject = session.groupName || session.grade || session.title;
    const date = new Date(session.startDate).toLocaleDateString('ar-EG');
    const time = session.startTime || new Date().toLocaleTimeString('ar-EG');

    const templateMap: Record<string, string> = {
      present: 'PRESENT',
      absent:  'ABSENT',
      late:    'LATE',
    };

    const templateKey = templateMap[status];
    if (!templateKey) return;

    await this.sendNotification.execute({
      tenantId,
      phone: record.parentPhone,
      templateKey: templateKey as any,
      vars: {
        student_name: record.studentName || '',
        subject,
        date,
        time,
        center_name: branding.name,
      },
    });

    // فحص 3 غيابات متتالية
    if (status === 'absent') {
      await this.checkThreeAbsences(tenantId, record, subject, date);
    }
  }

  private async checkThreeAbsences(
    tenantId: string,
    record: AttendanceEntity,
    subject: string,
    date: string,
  ): Promise<void> {
    const db = this.kysely.getTenantDb(tenantId);

    const recentAbsences = await db.selectFrom('attendance')
      .innerJoin('sessions', 'sessions.id', 'attendance.session_id')
      .select(['attendance.status'])
      .where('attendance.student_id', '=', record.studentId as any)
      .where('attendance.status', '=', 'absent')
      .where('sessions.deleted_at', 'is', null)
      .orderBy('sessions.start_date', 'desc')
      .limit(3)
      .execute();

    if (recentAbsences.length === 3 && recentAbsences.every(a => a.status === 'absent')) {
      await this.sendNotification.execute({
        tenantId,
        phone: record.parentPhone!,
        templateKey: 'THREE_ABSENCES',
        vars: {
          student_name: record.studentName || '',
          subject,
          date,
          count: '3',
        },
      });
      this.logger.warn(`THREE_ABSENCES notification sent for student ${record.studentCode}`);
    }
  }
}
