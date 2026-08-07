import { Injectable, Logger } from '@nestjs/common';
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

  constructor(private readonly repo: SessionRepository) {}

  // ─── Sessions ────────────────────────────────────────────
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

    // تهيئة الحضور — كل الطلاب غايبين افتراضياً
    let studentIds: string[] = [];
    if (data.type === 'grade_exam') {
      studentIds = await this.repo.getStudentsByGrade(tenantId, data.grade!);
    } else if (data.groupId) {
      studentIds = await this.repo.getStudentsByGroup(tenantId, data.groupId);
    }
    await this.repo.initAttendance(tenantId, session.id, studentIds);

    this.logger.log(`Session created: ${session.id} — type: ${session.type} — ${studentIds.length} students initialized`);
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
    if (!session.hasImage) throw new AppError('INVALID_TYPE', 'هذا النوع من الحصص لا يدعم الصور', 400);
    session.update({ imageUrl });
    await this.repo.save(tenantId, session);
    return session;
  }

  // ─── Attendance ──────────────────────────────────────────
  async getAttendance(tenantId: string, sessionId: string): Promise<AttendanceEntity[]> {
    await this.getById(tenantId, sessionId);
    return this.repo.findAttendance(tenantId, sessionId);
  }

  async updateAttendance(
    tenantId: string,
    sessionId: string,
    studentId: string,
    data: UpdateAttendanceDto,
  ): Promise<AttendanceEntity> {
    const session = await this.getById(tenantId, sessionId);
    if (!session.isOpen) throw new AppError('INVALID_STATUS', 'الحصة مغلقة', 400);

    const record = await this.repo.findAttendanceRecord(tenantId, sessionId, studentId);
    if (!record) throw new AppError('NOT_FOUND', 'الطالب غير مسجل في هذه الحصة', 404);

    if (data.status === 'present') record.markPresent();
    else if (data.status === 'absent') record.markAbsent();
    else if (data.status === 'late') record.markLate();

    if (data.degree !== undefined && session.hasGrades) {
      if (session.outOf && data.degree > session.outOf) {
        throw new AppError('INVALID_DEGREE', `الدرجة لا يمكن أن تتجاوز ${session.outOf}`, 400);
      }
      record.setDegree(data.degree);
    }

    if (data.notes !== undefined) record.notes = data.notes;

    await this.repo.saveAttendance(tenantId, record);
    return record;
  }

  async bulkUpdateAttendance(
    tenantId: string,
    sessionId: string,
    data: BulkUpdateAttendanceDto,
  ): Promise<void> {
    const session = await this.getById(tenantId, sessionId);
    if (!session.isOpen) throw new AppError('INVALID_STATUS', 'الحصة مغلقة', 400);

    await Promise.all(data.updates.map(async update => {
      const record = await this.repo.findAttendanceRecord(tenantId, sessionId, update.studentId);
      if (!record) return;

      if (update.status === 'present') record.markPresent();
      else if (update.status === 'absent') record.markAbsent();
      else if (update.status === 'late') record.markLate();

      if (update.degree !== undefined && session.hasGrades) {
        if (session.outOf && update.degree > session.outOf) return;
        record.setDegree(update.degree);
      }
      if (update.notes !== undefined) record.notes = update.notes;

      await this.repo.saveAttendance(tenantId, record);
    }));
  }

  // ─── QR Scan ─────────────────────────────────────────────
  async scanQr(tenantId: string, sessionId: string, data: ScanQrDto): Promise<AttendanceEntity> {
    const session = await this.getById(tenantId, sessionId);
    if (!session.isOpen) throw new AppError('SESSION_CLOSED', 'الحصة مغلقة — لا يمكن تسجيل الحضور', 400);

    const record = await this.repo.findAttendanceByQr(tenantId, sessionId, data.qrCode);
    if (!record) throw new AppError('NOT_FOUND', 'QR غير موجود أو الطالب غير مسجل في هذه الحصة', 404);

    if (record.status === 'present') {
      this.logger.warn(`Student ${record.studentCode} already marked present in session ${sessionId}`);
      return record; // مش بنرجع error — بس بنرجع الـ record الموجود
    }

    record.markPresent(new Date());
    await this.repo.saveAttendance(tenantId, record);

    this.logger.log(`QR scan: ${record.studentCode} → present in session ${sessionId}`);
    return record;
  }
}
