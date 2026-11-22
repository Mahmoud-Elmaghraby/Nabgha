import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
// Cron removed — session transitions are manual (teacher-controlled)
import { SendNotificationUseCase } from '../../../whatsapp/application/use-cases/send-notification.usecase';
import { TelegramNotifyUseCase } from '../../../telegram/application/use-cases/telegram-notify.usecase';
import { StorageService } from '../../../../shared/infrastructure/storage/storage.service';
import { IWaBulkJobRepository, WA_BULK_JOB_REPOSITORY } from '../../../whatsapp/domain/repositories/wa.repository.interface';
import { BrandingService } from '../../../settings/application/services/branding.service';
import { KyselyService } from '../../../../shared/infrastructure/database/kysely.service';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { sql } from 'kysely';
import { SessionRepository } from '../../infrastructure/session.repository';
import { SessionEntity, AttendanceEntity } from '../../domain/entities/session.entity';
import { AppError } from '../../../../core/errors/app.error';
import { AttendanceCreditService } from '../services/attendance-credit.service';
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
    private readonly telegramNotify: TelegramNotifyUseCase,
    private readonly kysely: KyselyService,
    private readonly branding: BrandingService,
    private readonly storage: StorageService,
    private readonly prisma: PrismaService,
    @Inject(WA_BULK_JOB_REPOSITORY) private readonly bulkJobRepo: IWaBulkJobRepository,
    private readonly credits: AttendanceCreditService,
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

  // ترتيب أيام JS Date.getDay() (0 = الأحد) بالمقابل لقيمة day المخزنة في جدول المجموعات
  private static readonly JS_DAY_TO_DAY_OF_WEEK = [
    'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
  ];

  /**
   * توليد يدوي (بضغطة زرار) لحصص اليوم اللي المفروض تحصل حسب الجدول الأسبوعي
   * المحفوظ في كل مجموعة نشطة — بيتجاهل أي مجموعة عندها حصة بالفعل في نفس
   * التاريخ عشان يمنع التكرار لو اتضغط أكتر من مرة.
   */
  async generateToday(tenantId: string, userId: string, date?: string): Promise<{ created: number; skipped: number; total: number }> {
    const targetDate = date ?? new Date().toISOString().slice(0, 10);
    const jsDay = new Date(`${targetDate}T00:00:00`).getDay();
    const dayOfWeek = SessionUseCase.JS_DAY_TO_DAY_OF_WEEK[jsDay];

    const groups = await this.repo.findGroupsScheduledForDay(tenantId, dayOfWeek);
    let created = 0, skipped = 0;

    for (const group of groups) {
      const exists = await this.repo.groupHasSessionOnDate(tenantId, group.id, targetDate);
      if (exists) { skipped++; continue; }

      await this.create(tenantId, {
        type: 'lesson',
        title: group.name,
        groupId: group.id,
        startDate: targetDate,
        startTime: group.startTime,
        endTime: group.endTime,
      } as CreateSessionDto, userId);
      created++;
    }

    this.logger.log(`generateToday(${targetDate}): ${created} created, ${skipped} skipped out of ${groups.length} scheduled groups`);
    return { created, skipped, total: groups.length };
  }

  /**
   * ⚠️ الكرون معطّل — الحصص تبدأ وتنتهي يدوياً بواسطة المدرّس.
   * الدالة محفوظة للرجوع إليها لو احتجنا التحويل التلقائي مستقبلاً.
   */
  // @Cron(CronExpression.EVERY_MINUTE)
  async autoTransitionSessions(): Promise<void> {
    try {
      const tenants = await this.prisma.tenant.findMany({ where: { isActive: true } });
      for (const tenant of tenants) {
        try {
          const toStart = await this.repo.findSessionsToAutoStart(tenant.id);
          for (const id of toStart) {
            try { await this.start(tenant.id, id); }
            catch (err: any) { this.logger.error(`autoStart failed for session ${id}: ${err.message}`); }
          }

          const toComplete = await this.repo.findSessionsToAutoComplete(tenant.id);
          for (const id of toComplete) {
            try { await this.complete(tenant.id, id); }
            catch (err: any) { this.logger.error(`autoComplete failed for session ${id}: ${err.message}`); }
          }

          if (toStart.length || toComplete.length) {
            this.logger.log(`Tenant ${tenant.id}: auto-started ${toStart.length}, auto-completed ${toComplete.length}`);
          }
        } catch (err: any) {
          this.logger.error(`autoTransitionSessions failed for tenant ${tenant.id}: ${err.message}`);
        }
      }
    } catch (err: any) {
      this.logger.error(`autoTransitionSessions cron failed: ${err.message}`);
    }
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

    // فحص رصيد التعويض لكل الغيابات قبل إقفال الحصة نهائياً — لو الطالب حضر بديل
    // في مجموعة تانية في نفس الأسبوع غيابه هنا يتحسب معذور.
    if (session.groupId) {
      await this.sweepSessionAbsences(tenantId, session);
    }

    return session;
  }

  async cancel(tenantId: string, id: string): Promise<SessionEntity> {
    const session = await this.getById(tenantId, id);
    if (!session.isOpen) throw new AppError('INVALID_STATUS', 'لا يمكن إلغاء حصة منتهية', 400);
    session.cancel();
    await this.repo.save(tenantId, session);
    await this.voidSessionCredits(tenantId, session);
    return session;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const session = await this.getById(tenantId, id);
    if (session.status === 'ongoing') throw new AppError('INVALID_STATUS', 'لا يمكن حذف حصة جارية', 400);
    session.softDelete();
    await this.repo.save(tenantId, session);
    await this.voidSessionCredits(tenantId, session);
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
      const result = await this.changeStatus(tenantId, session, record, data.status, { notify: true });
      // طالب بديل اتسجل غايب = اتشال من الحصة خالص، مفيش درجة أو ملاحظات تتسجل له
      if (result.removed) return record;
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
      duplicate_recent: 'اتبعتت نفس الرسالة من أقل من دقيقتين',
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

    // ملحوظة: زرار تليجرام مستقل تمامًا (resendTelegramGradeNotification /
    // sendAllTelegramGradeNotifications) — الدالة دي بقت واتساب بس، من غير أي
    // نداء جانبي لتليجرام، بناءً على طلب صريح إن الزرارين يبقوا منفصلين تمامًا
    // (مش زرار واتساب يبعت الاتنين تلقائي).
    return this.sendNotification.execute({
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
  }

  // ─── إرسال الدرجات عبر تليجرام — مستقل تمامًا عن واتساب (زرار خاص به، عداد
  // إرسال خاص به عبر telegram_grade_notified_at، ومفيش أي نداء تلقائي بين
  // الاتنين في أي الاتجاهين) ──────────────────────────────────────────────

  /** إرسال فردي عبر تليجرام — fire-and-forget، مرآة لـ resendGradeNotification */
  async resendTelegramGradeNotification(tenantId: string, sessionId: string, studentId: string): Promise<void> {
    const session = await this.getById(tenantId, sessionId);
    const record = await this.repo.findAttendanceRecord(tenantId, sessionId, studentId);
    if (!record) throw new AppError('NOT_FOUND', 'الطالب غير مسجل في هذه الحصة', 404);
    if (record.degree === null) throw new AppError('VALIDATION_ERROR', 'لم يتم رصد درجة لهذا الطالب بعد', 400);

    this.sendGradeNotificationTelegram(tenantId, session, record)
      .then(async (result) => {
        if (result.success) {
          await this.repo.markTelegramGradeNotified(tenantId, record.id);
        } else {
          this.logger.warn(`Telegram grade notification failed for ${record.studentId}: ${result.error}`);
        }
      })
      .catch((err) => this.logger.error(`Telegram grade notification error: ${err.message}`));
  }

  /** إرسال جماعي عبر تليجرام — Job منفصل تمامًا عن job الواتساب، مرآة لـ sendAllGradeNotifications */
  async sendAllTelegramGradeNotifications(tenantId: string, sessionId: string, createdBy: string): Promise<{ jobId: string }> {
    const session = await this.getById(tenantId, sessionId);
    const allAttendance = await this.repo.findAttendance(tenantId, sessionId);
    const pending = allAttendance.filter(r =>
      r.degree !== null && (!r.telegramGradeNotifiedAt || r.updatedAt > r.telegramGradeNotifiedAt)
    );

    const job = await this.bulkJobRepo.create({
      tenantId,
      title: 'إرسال الدرجات (تليجرام)',
      body: `الحصة: ${session.title}`,
      total: pending.length,
      createdBy,
      scheduledAt: null,
    });

    this.processTelegramGradeNotificationsInBackground(tenantId, session, pending, job.id)
      .catch((err) => this.logger.error(`Bulk telegram grade job failed: ${err.message}`));

    return { jobId: job.id };
  }

  private async processTelegramGradeNotificationsInBackground(
    tenantId: string, session: SessionEntity, pending: AttendanceEntity[], jobId: string,
  ): Promise<void> {
    const job = await this.bulkJobRepo.findById(tenantId, jobId);
    if (!job) return;
    job.start();
    await this.bulkJobRepo.save(job);

    for (const record of pending) {
      try {
        const result = await this.sendGradeNotificationTelegram(tenantId, session, record);
        if (result.success) {
          await this.repo.markTelegramGradeNotified(tenantId, record.id);
          job.incrementSent();
        } else {
          job.incrementFailed();
        }
      } catch (err: any) {
        this.logger.error(`Bulk telegram grade notify failed for ${record.studentId}: ${err.message}`);
        job.incrementFailed();
      }
      await this.bulkJobRepo.save(job);
    }
  }

  async getTelegramGradeNotificationJobProgress(tenantId: string, jobId: string) {
    const job = await this.bulkJobRepo.findById(tenantId, jobId);
    if (!job) return null;
    return {
      jobId: job.id, total: job.total, sent: job.sent,
      failed: job.failed, progress: job.progress, status: job.status,
    };
  }

  private async sendGradeNotificationTelegram(
    tenantId: string, session: SessionEntity, record: AttendanceEntity,
  ): Promise<{ success: boolean; error?: string }> {
    if (record.degree === null) return { success: false, error: 'no_degree' };

    const branding = await this.branding.getBrandingInfo(tenantId, { groupId: session.groupId ?? undefined });
    const subject = session.groupName || session.grade || session.title;
    const date = new Date(session.startDate).toLocaleDateString('ar-EG');

    let imageBuffer: Buffer | undefined;
    if (session.imageUrl) {
      const buffer = await this.storage.getFileBuffer(session.imageUrl);
      if (buffer) imageBuffer = buffer;
    }

    return this.telegramNotify.execute({
      tenantId, entityType: 'student', entityId: record.studentId,
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
  }

  // ─── نظام رصيد التعويض (حضور بديل في مجموعة تانية بنفس المادة) ────
  // القواعد كاملة موثقة في AttendanceCreditService.

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

    // لازم الطالب يكون مسجل فعلاً في مجموعة من نفس المادة/الصف عشان يقبل كـ"بديل" —
    // بيمنع إضافة طالب من مرحلة/مادة تانية تمامًا بالغلط (سكانر أو زر يدوي).
    const sameSubject = await this.repo.isStudentEnrolledInSubjectGrade(tenantId, studentId, subjectGradeId);
    if (!sameSubject) {
      throw new AppError('SUBJECT_MISMATCH', 'الطالب غير مسجل في مادة/مرحلة هذه المجموعة، لا يمكن تسجيله كبديل هنا', 400);
    }

    const record = await this.repo.addExternalAttendance(tenantId, sessionId, studentId);
    record.isExternal = true;

    const { excusedAbsenceId } = await this.credits.onExternalAttendance(tenantId, {
      sessionId, sessionDate: session.startDate, sessionTitle: session.title,
      attendanceId: record.id, studentId, subjectGradeId,
    });

    if (excusedAbsenceId) this.notifyExcused(tenantId, [excusedAbsenceId]);

    // ولي الأمر يعرف إن ابنه وصل — زي أي حضور عادي
    this.sendAttendanceNotification(tenantId, session, record, 'present')
      .catch(err => this.logger.error('WA external attendance notification failed: ' + err.message));

    return { attendance: record, excusedAbsence: !!excusedAbsenceId, creditCreated: !excusedAbsenceId };
  }

  /**
   * المكان الوحيد اللي بيغيّر حالة حضور طالب — التسجيل الفردي والجماعي ومسح الـ QR كلهم
   * بيعدّوا من هنا، عشان قواعد رصيد التعويض تتطبق بنفس الشكل في كل الحالات.
   */
  private async changeStatus(
    tenantId: string, session: SessionEntity, record: AttendanceEntity,
    status: 'present' | 'absent' | 'late',
    opts: { notify: boolean; scannedAt?: Date },
  ): Promise<{ removed: boolean }> {
    // ── طالب بديل (من مجموعة تانية) ──
    if (session.groupId && await this.credits.isExternal(tenantId, record.id)) {
      if (status === 'absent') {
        // اتسجل بالغلط: يتشال من الحصة، رصيده يتلغي، وأي غياب اتعذر بيه يرجع غياب
        await this.credits.removeExternalAttendance(tenantId, record.id);
        this.logger.log(`External attendee ${record.studentId} removed from session ${session.id}`);
        return { removed: true };
      }
      if (status === 'present') record.markPresent(opts.scannedAt);
      else record.markLate();
      await this.repo.saveAttendance(tenantId, record);
      if (opts.notify) this.queueAttendanceNotification(tenantId, session, record, status);
      return { removed: false };
    }

    // ── طالب من المجموعة ──
    if (record.status === 'excused') {
      // غيابه متغطي برصيد تعويض فعلاً — "غايب" تاني مش هيغيّر حاجة
      if (status === 'absent') return { removed: false };
      // حضر حصته في الآخر: الرصيد يرجع متاح ويدوّر على غياب تاني
      const reExcused = await this.credits.onExcusedRecordChanged(tenantId, record.id);
      this.notifyExcused(tenantId, reExcused);
      record.notes = null;
    }

    if (status === 'absent' && session.groupId) {
      const subjectGradeId = await this.repo.getGroupSubjectGradeId(tenantId, session.groupId);
      if (subjectGradeId) {
        // حفظ الغياب الأول، وبعدين محاولة صرف رصيد عليه (الصرف بيشترط إن الحالة "غايب")
        record.markAbsent();
        await this.repo.saveAttendance(tenantId, record);
        const excused = await this.credits.excuseAbsenceIfCredit(tenantId, {
          absenceAttendanceId: record.id, studentId: record.studentId,
          subjectGradeId, sessionDate: session.startDate,
        });
        if (excused) {
          record.markExcused();
          record.notes = AttendanceCreditService.DEFAULT_NOTE;
          if (opts.notify) this.sendExcusedNotification(tenantId, record, session)
            .catch(err => this.logger.error('ABSENCE_EXCUSED notification failed: ' + err.message));
          return { removed: false };
        }
        if (opts.notify) this.queueAttendanceNotification(tenantId, session, record, status);
        return { removed: false };
      }
    }

    if (status === 'present') record.markPresent(opts.scannedAt);
    else if (status === 'absent') record.markAbsent();
    else record.markLate();
    await this.repo.saveAttendance(tenantId, record);
    if (opts.notify) this.queueAttendanceNotification(tenantId, session, record, status);
    return { removed: false };
  }

  private queueAttendanceNotification(
    tenantId: string, session: SessionEntity, record: AttendanceEntity, status: string,
  ): void {
    this.sendAttendanceNotification(tenantId, session, record, status)
      .catch(err => this.logger.error('WA notification failed: ' + err.message));
  }

  /** عند إنهاء الحصة: كل غياب فيها ياخد رصيد تعويض لو موجود */
  private async sweepSessionAbsences(tenantId: string, session: SessionEntity): Promise<void> {
    const subjectGradeId = await this.repo.getGroupSubjectGradeId(tenantId, session.groupId!);
    if (!subjectGradeId) return;
    const absentRecords = await this.repo.findAbsentAttendanceForSession(tenantId, session.id);
    const excusedIds: string[] = [];
    // واحد ورا واحد — عدد الأرصدة المتاحة في أي أسبوع صغير جدًا، والتسلسل أبسط وأأمن
    for (const record of absentRecords) {
      try {
        const ok = await this.credits.excuseAbsenceIfCredit(tenantId, {
          absenceAttendanceId: record.id, studentId: record.studentId,
          subjectGradeId, sessionDate: session.startDate,
        });
        if (ok) excusedIds.push(record.id);
      } catch (err: any) {
        this.logger.error(`Credit sweep failed for student ${record.studentId}: ${err.message}`);
      }
    }
    this.notifyExcused(tenantId, excusedIds);
  }

  /** حصة اتلغت أو اتمسحت: الأرصدة المرتبطة بيها بتترتب من جديد */
  private async voidSessionCredits(tenantId: string, session: SessionEntity): Promise<void> {
    if (!session.groupId) return;
    try {
      const reExcused = await this.credits.onSessionVoided(tenantId, session.id);
      this.notifyExcused(tenantId, reExcused);
    } catch (err: any) {
      this.logger.error(`Credit cleanup failed for session ${session.id}: ${err.message}`);
    }
  }

  /** إشعار "غياب معذور" لكل سجل غياب اتعذر — بتاريخ ومادة حصة الغياب نفسها */
  private notifyExcused(tenantId: string, absenceAttendanceIds: string[]): void {
    for (const attendanceId of absenceAttendanceIds) {
      (async () => {
        const ctx = await this.repo.findAttendanceContextById(tenantId, attendanceId);
        if (!ctx) return;
        await this.sendExcusedNotification(tenantId, ctx.record, ctx.session);
      })().catch(err => this.logger.error('ABSENCE_EXCUSED notification failed: ' + err.message));
    }
  }

  // ─── مطابقة يومية لرصيد التعويض ─────────────────────────
  // لو المدرّس مابيدوسش "إنهاء الحصة"، الغياب ماكانش بيتقابل مع رصيد اتعمل قبله.
  // بيصحى كل ساعة بس الشغل الفعلي مرة واحدة في اليوم لكل مركز (نفس أسلوب المالية).
  private static readonly CREDIT_SWEEP_KEY = 'attendance_credit_sweep_last_date';

  @Cron('20 * * * *')
  async dailyCreditSweep(): Promise<void> {
    try {
      const tenants = await this.prisma.tenant.findMany({ where: { isActive: true }, select: { id: true } });
      const today = AttendanceCreditService.toDateStr(new Date());
      for (const tenant of tenants) {
        try {
          const db = this.kysely.getTenantDb(tenant.id);
          const last = await db.selectFrom('tenant_settings').select('value')
            .where('key', '=', SessionUseCase.CREDIT_SWEEP_KEY)
            .executeTakeFirst();
          if (last?.value === today) continue;

          const excused = await this.credits.matchPendingCredits(tenant.id);
          this.notifyExcused(tenant.id, excused);

          await db.insertInto('tenant_settings')
            .values({ key: SessionUseCase.CREDIT_SWEEP_KEY, value: today, updated_at: new Date() } as any)
            .onConflict((oc) => oc.column('key').doUpdateSet({ value: today, updated_at: new Date() } as any))
            .execute();
          if (excused.length) this.logger.log(`Credit sweep tenant ${tenant.id}: ${excused.length} absences excused`);
        } catch (err: any) {
          this.logger.error(`Credit sweep failed for tenant ${tenant.id}: ${err.message}`);
        }
      }
    } catch (err: any) {
      this.logger.error(`dailyCreditSweep failed: ${err.message}`);
    }
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

    this.telegramNotify.execute({
      tenantId, entityType: 'student', entityId: record.studentId,
      templateKey: 'ABSENCE_EXCUSED',
      vars: {
        student_name: record.studentName || '',
        subject,
        date,
        center_name: branding.name,
      },
    }).catch((err) => this.logger.error('Telegram ABSENCE_EXCUSED failed: ' + err.message));
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
      // نفس قواعد التسجيل الفردي (رصيد التعويض، الطالب البديل) — من غير إشعارات زي الأول
      const result = await this.changeStatus(tenantId, session, record, update.status, { notify: false });
      if (result.removed) return;

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
    await this.changeStatus(tenantId, session, record, 'present', { notify: true, scannedAt: new Date() });
    this.logger.log(`QR scan: ${record.studentCode} → present in session ${sessionId}`);
    return record;
  }

  // ─── Private: WhatsApp Notification ──────────────────────
  // ⚠️ تصليح (Oct 2026): الرسالة كانت بتتبعت فورًا مع كل ضغطة. لو المدرس ضغط "غايب" بالغلط
  // وصلّحها لـ "حاضر" بعدها بثواني، ولي الأمر كان بيستلم رسالة غياب غلط + رسالة حضور.
  // دلوقتي بنستنى ATTENDANCE_NOTIFY_DELAY_MS، ولو الحالة اتغيّرت في الفترة دي بنلغي
  // الرسالة القديمة، وبعد المهلة بنعيد قراءة الحالة الفعلية من قاعدة البيانات
  // ونبعت بس لو لسه زي ما هي.
  private readonly pendingAttendanceNotifications = new Map<string, NodeJS.Timeout>();
  private static readonly ATTENDANCE_NOTIFY_DELAY_MS = 90_000;

  private async sendAttendanceNotification(
    tenantId: string,
    session: SessionEntity,
    record: AttendanceEntity,
    status: string,
  ): Promise<void> {
    if (!record.parentPhone) return;

    const key = `${tenantId}:${session.id}:${record.studentId}`;
    const existing = this.pendingAttendanceNotifications.get(key);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      this.pendingAttendanceNotifications.delete(key);
      try {
        const fresh = await this.repo.findAttendanceRecord(tenantId, session.id, record.studentId);
        if (!fresh || fresh.status !== status) {
          this.logger.log(`Skipped stale ${status} notification for student ${record.studentId} (status now: ${fresh?.status})`);
          return;
        }
        await this.deliverAttendanceNotification(tenantId, session, fresh, status);
      } catch (err: any) {
        this.logger.error('Delayed attendance notification failed: ' + err.message);
      }
    }, SessionUseCase.ATTENDANCE_NOTIFY_DELAY_MS);
    // ما نمنعش إغلاق التطبيق بسبب المؤقت
    (timer as any).unref?.();
    this.pendingAttendanceNotifications.set(key, timer);
  }

  private async deliverAttendanceNotification(
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

    this.telegramNotify.execute({
      tenantId, entityType: 'student', entityId: record.studentId,
      templateKey: templateKey as any,
      vars: {
        student_name: record.studentName || '',
        subject,
        date,
        time,
        center_name: branding.name,
      },
    }).catch((err) => this.logger.error(`Telegram ${templateKey} failed: ` + err.message));

    // فحص 3 غيابات متتالية
    if (status === 'absent') {
      await this.checkThreeAbsences(tenantId, record, session, subject, date, branding.name);
    }
  }

  private async checkThreeAbsences(
    tenantId: string,
    record: AttendanceEntity,
    session: SessionEntity,
    subject: string,
    date: string,
    centerName: string,
  ): Promise<void> {
    const db = this.kysely.getTenantDb(tenantId);

    // آخر 4 حصص مسجّل فيها الطالب (أي حالة، لحد الحصة الحالية، ونفس المجموعة)
    // عشان نتأكد إن الغيابات "متتالية فعلًا": آخر 3 كلهم غياب، والحصة اللي قبلهم
    // (الرابعة) مش غياب — كده الرسالة تتبعت مرة واحدة بس عند الغياب الثالث.
    // الغلطة القديمة كانت بتجيب آخر 3 غيابات بغض النظر عن حضوره بينهم.
    let q = db.selectFrom('attendance')
      .innerJoin('sessions', 'sessions.id', 'attendance.session_id')
      .select(['attendance.status'])
      .where('attendance.student_id', '=', record.studentId as any)
      .where('sessions.deleted_at', 'is', null)
      // ⚠️ تصليح: الحصص الملغية/اللي لسه ماتعملتش بيبقى فيها "غياب افتراضي" لكل الطلاب
      // وكانت بتتحسب غيابات حقيقية. نحسب بس الحصص اللي اتعملت فعلًا (جارية/منتهية)
      // واللي حد فيها اتسجّل حضوره (يعني المدرس أخد حضور فعلًا).
      .where('sessions.status', 'in', ['ongoing', 'completed'])
      // ⚠️ تصليح (Nov 2026): كانت sql`EXISTS (SELECT 1 FROM attendance ...)` خام — الـ SQL الخام
      // مابياخدش الـ schema بتاعة المركز، فالاستعلام كان بيدوّر على جدول attendance في public
      // ويفشل، ورسالة "3 غيابات متتالية" عمرها ما اتبعتت. دلوقتي subquery من الـ query builder.
      .where(({ exists, selectFrom }) => exists(
        selectFrom('attendance as a2')
          .select('a2.id')
          .whereRef('a2.session_id', '=', 'sessions.id')
          .where('a2.status', '<>', 'absent'),
      ))
      .where('sessions.start_date', '<=', session.startDate as any);
    if (session.groupId) {
      q = q.where('sessions.group_id', '=', session.groupId as any);
    }
    const recent = await q
      .orderBy('sessions.start_date', 'desc')
      .orderBy('sessions.start_time', 'desc')
      .limit(4)
      .execute();

    const recentAbsences = recent.slice(0, 3);
    const isThirdConsecutive =
      recentAbsences.length === 3 &&
      recentAbsences.every(a => a.status === 'absent') &&
      (recent.length < 4 || recent[3].status !== 'absent');

    if (isThirdConsecutive) {
      await this.sendNotification.execute({
        tenantId,
        phone: record.parentPhone!,
        templateKey: 'THREE_ABSENCES',
        vars: {
          student_name: record.studentName || '',
          subject,
          date,
          count: '3',
          center_name: centerName,
        },
      });
      this.telegramNotify.execute({
        tenantId, entityType: 'student', entityId: record.studentId,
        templateKey: 'THREE_ABSENCES',
        vars: {
          student_name: record.studentName || '',
          subject,
          date,
          count: '3',
          center_name: centerName,
        },
      }).catch((err) => this.logger.error('Telegram THREE_ABSENCES failed: ' + err.message));
      this.logger.warn(`THREE_ABSENCES notification sent for student ${record.studentCode}`);
    }
  }
}
