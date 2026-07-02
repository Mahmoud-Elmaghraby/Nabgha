import { Injectable, Logger } from '@nestjs/common';
import { GroupRepository } from '../../infrastructure/group.repository';
import { GroupEntity, GroupStudentEntity } from '../../domain/entities/group.entity';
import { AppError } from '../../../../core/errors/app.error';
import { SendNotificationUseCase } from '../../../whatsapp/application/use-cases/send-notification.usecase';
import { KyselyService } from '../../../../shared/infrastructure/database/kysely.service';
import { BrandingService } from '../../../settings/application/services/branding.service';
import { sql } from 'kysely';
import type { CreateGroupDto, UpdateGroupDto, ListGroupsDto } from '../dtos/group.dto';

@Injectable()
export class GroupUseCase {
  private readonly logger = new Logger(GroupUseCase.name);

  constructor(
    private readonly repo: GroupRepository,
    private readonly sendNotification: SendNotificationUseCase,
    private readonly kysely: KyselyService,
    private readonly branding: BrandingService,
  ) {}

  async list(
    tenantId: string,
    params: ListGroupsDto,
  ): Promise<{ data: GroupEntity[]; total: number; page: number; limit: number }> {
    return this.repo.findAll(tenantId, params);
  }

  async getById(tenantId: string, id: string): Promise<GroupEntity> {
    const group = await this.repo.findById(tenantId, id);
    if (!group) throw new AppError('NOT_FOUND', 'المجموعة غير موجودة', 404);
    return group;
  }

  async create(tenantId: string, data: CreateGroupDto): Promise<GroupEntity> {
    return this.repo.create(tenantId, data);
  }

  async update(tenantId: string, id: string, data: UpdateGroupDto): Promise<GroupEntity> {
    const group = await this.repo.findById(tenantId, id);
    if (!group) throw new AppError('NOT_FOUND', 'المجموعة غير موجودة', 404);
    group.update(data);
    await this.repo.save(tenantId, group);
    return group;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const group = await this.repo.findById(tenantId, id);
    if (!group) throw new AppError('NOT_FOUND', 'المجموعة غير موجودة', 404);
    group.softDelete();
    await this.repo.save(tenantId, group);
  }

  async getStudents(tenantId: string, groupId: string): Promise<GroupStudentEntity[]> {
    await this.getById(tenantId, groupId);
    return this.repo.findGroupStudents(tenantId, groupId);
  }

  async addStudent(
    tenantId: string,
    groupId: string,
    studentId: string,
    discount: number,
  ): Promise<GroupStudentEntity> {
    const group = await this.repo.findById(tenantId, groupId);
    if (!group) throw new AppError('NOT_FOUND', 'المجموعة غير موجودة', 404);

    if (group.isFull) {
      throw new AppError('GROUP_FULL', 'المجموعة وصلت للحد الأقصى من الطلاب', 400);
    }

    const alreadyIn = await this.repo.isStudentInGroup(tenantId, groupId, studentId);
    if (alreadyIn) {
      throw new AppError('CONFLICT', 'الطالب مسجل بالفعل في هذه المجموعة', 409);
    }

    const enrollment = await this.repo.addStudent(tenantId, groupId, studentId, discount);

    // إرسال إشعار واتساب
    this.sendGroupAddedNotification(tenantId, studentId, group)
      .then((result) => {
        if (result?.success) {
          this.logger.log('GROUP_ADDED notification sent successfully');
        } else {
          this.logger.warn('GROUP_ADDED notification NOT sent — reason: ' + (result?.error ?? 'unknown'));
        }
      })
      .catch(err => this.logger.error('Failed to send GROUP_ADDED notification: ' + err.message, err.stack));

    return enrollment;
  }

  async updateStudentDiscount(
    tenantId: string,
    groupId: string,
    studentId: string,
    discount: number,
  ): Promise<void> {
    await this.getById(tenantId, groupId);
    const inGroup = await this.repo.isStudentInGroup(tenantId, groupId, studentId);
    if (!inGroup) throw new AppError('NOT_FOUND', 'الطالب غير مسجل في هذه المجموعة', 404);
    await this.repo.updateStudentDiscount(tenantId, groupId, studentId, discount);
  }

  async removeStudent(tenantId: string, groupId: string, studentId: string): Promise<void> {
    const group = await this.repo.findById(tenantId, groupId);
    if (!group) throw new AppError('NOT_FOUND', 'المجموعة غير موجودة', 404);

    const inGroup = await this.repo.isStudentInGroup(tenantId, groupId, studentId);
    if (!inGroup) throw new AppError('NOT_FOUND', 'الطالب غير مسجل في هذه المجموعة', 404);

    await this.repo.removeStudent(tenantId, groupId, studentId);

    // إرسال إشعار واتساب
    this.sendGroupRemovedNotification(tenantId, studentId, group).catch(err =>
      this.logger.error('Failed to send GROUP_REMOVED notification', err),
    );
  }

  private async sendGroupAddedNotification(
    tenantId: string,
    studentId: string,
    group: GroupEntity,
  ): Promise<{ success: boolean; error?: string } | void> {
    const db = this.kysely.getTenantDb(tenantId);

    const student = await db
      .selectFrom('students')
      .select(['full_name', 'parent_phone'])
      .where('id', '=', sql<string>`${studentId}::uuid`)
      .executeTakeFirst();

    if (!student) return;

    const branding = await this.branding.getBrandingInfo(tenantId, { groupId: group.id });

    const days = Array.isArray(group.schedule)
      ? group.schedule.map((s: any) => {
          const dayMap: Record<string, string> = {
            saturday: 'السبت', sunday: 'الأحد', monday: 'الاثنين',
            tuesday: 'الثلاثاء', wednesday: 'الأربعاء', thursday: 'الخميس', friday: 'الجمعة',
          };
          return dayMap[s.day] || s.day;
        }).join(' - ')
      : '';

    const time = Array.isArray(group.schedule) && group.schedule.length > 0
      ? (group.schedule[0] as any).startTime
      : '';

    const result = await this.sendNotification.execute({
      tenantId,
      phone: student.parent_phone,
      templateKey: 'GROUP_ADDED',
      vars: {
        student_name: student.full_name,
        group_name: group.name,
        days,
        time,
        center_name: branding.name,
      },
    });
    this.logger.log('SendNotification result: ' + JSON.stringify(result));
    return result;
  }

  private async sendGroupRemovedNotification(
    tenantId: string,
    studentId: string,
    group: GroupEntity,
  ): Promise<void> {
    const db = this.kysely.getTenantDb(tenantId);

    const student = await db
      .selectFrom('students')
      .select(['full_name', 'parent_phone'])
      .where('id', '=', sql<string>`${studentId}::uuid`)
      .executeTakeFirst();

    if (!student) return;

    const branding = await this.branding.getBrandingInfo(tenantId, { groupId: group.id });

    await this.sendNotification.execute({
      tenantId,
      phone: student.parent_phone,
      templateKey: 'GROUP_REMOVED',
      vars: {
        student_name: student.full_name,
        group_name: group.name,
        center_name: branding.name,
      },
    });
  }
}
