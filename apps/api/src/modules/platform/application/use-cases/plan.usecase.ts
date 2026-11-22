import { Injectable } from '@nestjs/common';
import { PlanRepository } from '../../infrastructure/plan.repository';
import { PlanEntity } from '../../domain/entities/plan.entity';
import { AppError } from '../../../../core/errors/app.error';
import type { CreatePlanDto, UpdatePlanDto } from '../dtos/plan.dto';

@Injectable()
export class PlanUseCase {
  constructor(private readonly repo: PlanRepository) {}

  async getAll(): Promise<PlanEntity[]> {
    return this.repo.findAll();
  }

  async getById(id: string): Promise<PlanEntity> {
    const plan = await this.repo.findById(id);
    if (!plan) throw new AppError('الخطة غير موجودة', 'NOT_FOUND', 404);
    return plan;
  }

  async create(data: CreatePlanDto): Promise<PlanEntity> {
    const existing = await this.repo.findBySlug(data.slug);
    if (existing) throw new AppError('الـ slug مستخدم بالفعل', 'CONFLICT', 409);
    return this.repo.create(data);
  }

  async update(id: string, data: UpdatePlanDto): Promise<PlanEntity> {
    const plan = await this.repo.findById(id);
    if (!plan) throw new AppError('الخطة غير موجودة', 'NOT_FOUND', 404);
    plan.update(data);
    await this.repo.save(plan);
    return plan;
  }

  async delete(id: string): Promise<void> {
    const plan = await this.repo.findById(id);
    if (!plan) throw new AppError('الخطة غير موجودة', 'NOT_FOUND', 404);
    const tenantsCount = await this.repo.countTenants(id);
    if (tenantsCount > 0) {
      throw new AppError('لا يمكن حذف خطة مرتبطة بمراكز', 'CONFLICT', 409);
    }
    await this.repo.delete(id);
  }
}
