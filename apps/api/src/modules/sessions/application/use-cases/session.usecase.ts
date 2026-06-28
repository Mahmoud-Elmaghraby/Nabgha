import { Injectable, Logger } from '@nestjs/common';
import { SendNotificationUseCase } from '../../../whatsapp/application/use-cases/send-notification.usecase';
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
    session.update({ imageUrl });
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
    if (!session.isOpen) throw new AppError('INVALID_STATUS', 'الحصة مغلقة', 400);
    const record = await this.repo.findAttendanceRecord(tenantId, sessionId, studentId);
    if (!record) throw new AppError('NOT_FOUND', 'الطالب غير مسجل في هذه الحصة', 404);
    if (data.status === 'present') record.markPresent();
    else if (data.status === 'absent') record.markAbsent();
    else record.markLate();
    if (data.degree !== undefined && session.hasGrades) {
      if (session.outOf && data.degree > session.outOf)
        throw new AppError('INVALID_DEGREE', `الدرجة لا تتجاوز ${session.outOf}`, 400);
      record.setDegree(data.degree);
    }
    if (data.notes !== undefined) record.notes = data.notes;
    await this.repo.saveAttendance(tenantId, record);

    // WhatsApp notification — fire and forget
    this.sendAttendanceNotification(tenantId, session, record, data.status)
      .catch(err => this.logger.error('WA notification failed: ' + err.message));

    return record;
  }

  async bulkUpdateAttendance(
    tenantId: string, sessionId: string, data: BulkUpdateAttendanceDto,
  ): Promise<void> {
    const session = await this.getById(tenantId, sessionId);
    if (!session.isOpen) throw new AppError('INVALID_STATUS', 'الحصة مغلقة', 400);
    await Promise.all(data.updates.map(async update => {
      const record = await this.repo.findAttendanceRecord(tenantId, sessionId, update.studentId);
      if (!record) return;
      if (update.status === 'present') record.markPresent();
      else if (update.status === 'absent') record.markAbsent();
      else record.markLate();
      if (update.degree !== undefined && session.hasGrades) {
        if (!session.outOf || update.degree <= session.outOf) record.setDegree(update.degree);
      }
      if (update.notes !== undefined) record.notes = update.notes;
      await this.repo.saveAttendance(tenantId, record);
    }));
  }

  async getPreviousAbsentStudents(tenantId: string, sessionId: string): Promise<string[]> {
    const session = await this.getById(tenantId, sessionId);
    if (!session.groupId) return [];
    return this.repo.getPreviousAbsentStudents(tenantId, sessionId, session.groupId);
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

    const db = this.kysely.getTenantDb(tenantId);
    const centerSettings = await db.selectFrom('center_settings')
      .select(['center_name'])
      .executeTakeFirst();

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
        center_name: centerSettings?.center_name || 'المركز',
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
