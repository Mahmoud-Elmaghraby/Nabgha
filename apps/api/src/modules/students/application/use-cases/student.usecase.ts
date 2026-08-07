import { Injectable, Logger } from '@nestjs/common';
import { StudentRepository } from '../../infrastructure/student.repository';
import { StudentEntity } from '../../domain/entities/student.entity';
import { AppError } from '../../../../core/errors/app.error';
import type { CreateStudentDto, UpdateStudentDto, ListStudentsDto } from '../dtos/student.dto';
import { randomUUID } from 'crypto';
import { SendNotificationUseCase } from '../../../whatsapp/application/use-cases/send-notification.usecase';
import { BrandingService } from '../../../settings/application/services/branding.service';

@Injectable()
export class StudentUseCase {
  private readonly logger = new Logger(StudentUseCase.name);

  constructor(
    private readonly repo: StudentRepository,
    private readonly sendNotification: SendNotificationUseCase,
    private readonly branding: BrandingService,
  ) {}

  async list(
    tenantId: string,
    params: ListStudentsDto,
  ): Promise<{ data: StudentEntity[]; total: number; page: number; limit: number }> {
    return this.repo.findAll(tenantId, params);
  }

  async listForExport(
    tenantId: string,
    params: Omit<ListStudentsDto, 'page' | 'limit'>,
  ): Promise<StudentEntity[]> {
    return this.repo.findAllForExport(tenantId, params);
  }

  async getById(tenantId: string, id: string): Promise<StudentEntity> {
    const student = await this.repo.findById(tenantId, id);
    if (!student) throw new AppError('NOT_FOUND', 'الطالب غير موجود', 404);
    return student;
  }

  async create(tenantId: string, data: CreateStudentDto): Promise<StudentEntity> {
    const qrCode = `STU-${randomUUID()}`;
    const studentCode = await this.repo.generateStudentCode(tenantId);
    const student = await this.repo.create(tenantId, { ...data, qrCode, studentCode });

    // إرسال إشعار واتس آب لولي الأمر عند تسجيل الطالب
    if (student.parentPhone) {
      this.sendNewStudentNotification(tenantId, student)
        .then(() => this.logger.log(`NEW_STUDENT notification sent for ${student.fullName}`))
        .catch(err => this.logger.error('Failed to send NEW_STUDENT notification: ' + err.message, err.stack));
    }

    return student;
  }

  async update(tenantId: string, id: string, data: UpdateStudentDto): Promise<StudentEntity> {
    const student = await this.repo.findById(tenantId, id);
    if (!student) throw new AppError('NOT_FOUND', 'الطالب غير موجود', 404);
    student.update({
      ...data,
      studentPhone: data.studentPhone !== undefined
        ? (data.studentPhone || null)
        : undefined,
      dateOfBirth: data.dateOfBirth !== undefined
        ? (data.dateOfBirth ? new Date(data.dateOfBirth) : null)
        : undefined,
    });
    await this.repo.save(tenantId, student);
    return student;
  }

  async toggleActive(tenantId: string, id: string): Promise<StudentEntity> {
    const student = await this.repo.findById(tenantId, id);
    if (!student) throw new AppError('NOT_FOUND', 'الطالب غير موجود', 404);
    student.update({ isActive: !student.isActive });
    await this.repo.save(tenantId, student);
    return student;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const student = await this.repo.findById(tenantId, id);
    if (!student) throw new AppError('NOT_FOUND', 'الطالب غير موجود', 404);

    const { hasData, details } = await this.repo.hasRelatedData(tenantId, id);
    if (hasData) {
      const parts: string[] = [];
      if (details.groups > 0) parts.push(`${details.groups} مجموعة`);
      if (details.payments > 0) parts.push(`${details.payments} دفعة`);
      if (details.attendance > 0) parts.push(`${details.attendance} سجل حضور`);
      throw new AppError(
        'CANNOT_DELETE',
        `لا يمكن حذف الطالب — لديه بيانات مرتبطة: ${parts.join('، ')}`,
        409,
      );
    }

    student.softDelete();
    await this.repo.save(tenantId, student);
  }

  async getGroups(tenantId: string, studentId: string): Promise<any[]> {
    await this.getById(tenantId, studentId);
    return this.repo.findGroups(tenantId, studentId);
  }

  async getAttendance(tenantId: string, studentId: string): Promise<any[]> {
    await this.getById(tenantId, studentId);
    return this.repo.findAttendanceHistory(tenantId, studentId);
  }

  async getQrCode(tenantId: string, id: string): Promise<string> {
    const student = await this.getById(tenantId, id);
    return student.qrCode;
  }

  private async sendNewStudentNotification(tenantId: string, student: StudentEntity): Promise<void> {
    // مفيش مدرس مرتبط بلحظة تسجيل الطالب (لسه مش متسجل في أي مادة) — هترجع بيانات المركز دايماً
    const branding = await this.branding.getBrandingInfo(tenantId, {});

    const result = await this.sendNotification.execute({
      tenantId,
      phone: student.parentPhone!,
      templateKey: 'NEW_STUDENT',
      vars: {
        student_name: student.fullName,
        center_name: branding.name,
      },
    });

    this.logger.log('NEW_STUDENT SendNotification result: ' + JSON.stringify(result));
  }
}
