import { Injectable } from '@nestjs/common';
import { TeacherRepository } from '../../infrastructure/teacher.repository';
import { TeacherEntity } from '../../domain/entities/teacher.entity';
import { AppError } from '../../../../core/errors/app.error';
import type { CreateTeacherDto, UpdateTeacherDto } from '../dtos/teacher.dto';

@Injectable()
export class TeacherUseCase {
  constructor(private readonly repo: TeacherRepository) {}

  async getAll(tenantId: string, search?: string): Promise<TeacherEntity[]> {
    return this.repo.findAll(tenantId, search);
  }

  async getById(tenantId: string, id: string): Promise<TeacherEntity> {
    const teacher = await this.repo.findById(tenantId, id);
    if (!teacher) throw new AppError('NOT_FOUND', 'المدرس غير موجود', 404);
    return teacher;
  }

  async create(tenantId: string, data: CreateTeacherDto): Promise<TeacherEntity> {
    return this.repo.create(tenantId, data);
  }

  async update(tenantId: string, id: string, data: UpdateTeacherDto): Promise<TeacherEntity> {
    const teacher = await this.repo.findById(tenantId, id);
    if (!teacher) throw new AppError('NOT_FOUND', 'المدرس غير موجود', 404);
    teacher.update(data);
    await this.repo.save(tenantId, teacher);
    return teacher;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const teacher = await this.repo.findById(tenantId, id);
    if (!teacher) throw new AppError('NOT_FOUND', 'المدرس غير موجود', 404);
    teacher.softDelete();
    await this.repo.save(tenantId, teacher);
  }
}
