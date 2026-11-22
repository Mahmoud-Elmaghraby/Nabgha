import { Injectable } from '@nestjs/common';
import { TenantRepository } from '../../infrastructure/tenant.repository';
import { PlanRepository } from '../../infrastructure/plan.repository';
import { TenantEntity } from '../../domain/entities/tenant.entity';
import { AppError } from '../../../../core/errors/app.error';
import type { CreateTenantDto, UpdateTenantDto } from '../dtos/tenant.dto';
import { provisionTenantSchema } from '../../../../shared/infrastructure/database/tenant-provisioner';

@Injectable()
export class TenantUseCase {
  constructor(
    private readonly tenantRepo: TenantRepository,
    private readonly planRepo: PlanRepository,
  ) {}

  async getAll(search?: string): Promise<TenantEntity[]> {
    return this.tenantRepo.findAll(search);
  }

  async getById(id: string): Promise<TenantEntity> {
    const tenant = await this.tenantRepo.findById(id);
    if (!tenant) throw new AppError('NOT_FOUND', 'المركز غير موجود', 404);
    return tenant;
  }

  async create(data: CreateTenantDto): Promise<TenantEntity> {
    const existing = await this.tenantRepo.findBySlug(data.slug);
    if (existing) throw new AppError('CONFLICT', 'الـ slug مستخدم بالفعل', 409);

    const plan = await this.planRepo.findById(data.planId);
    if (!plan) throw new AppError('NOT_FOUND', 'الخطة غير موجودة', 404);

    const { randomUUID } = require('crypto');
    const tenantId = randomUUID();
    const schemaName = `tenant_${tenantId.replace(/-/g, '_')}`;

    const tenant = await this.tenantRepo.create({
      id: tenantId,
      name: data.name,
      slug: data.slug,
      planId: data.planId,
      schemaName,
    });

    await this.provisionTenant(tenantId, schemaName, data);

    return tenant;
  }

  async update(id: string, data: UpdateTenantDto): Promise<TenantEntity> {
    const tenant = await this.tenantRepo.findById(id);
    if (!tenant) throw new AppError('NOT_FOUND', 'المركز غير موجود', 404);

    if (data.planId) {
      const plan = await this.planRepo.findById(data.planId);
      if (!plan) throw new AppError('NOT_FOUND', 'الخطة غير موجودة', 404);
    }

    tenant.update(data);
    await this.tenantRepo.save(tenant);
    return tenant;
  }

  async toggleActive(id: string): Promise<TenantEntity> {
    const tenant = await this.tenantRepo.findById(id);
    if (!tenant) throw new AppError('NOT_FOUND', 'المركز غير موجود', 404);
    if (tenant.isActive) {
      tenant.deactivate();
    } else {
      tenant.activate();
    }
    await this.tenantRepo.save(tenant);
    return tenant;
  }

  async getStats(): Promise<{ total: number; active: number; inactive: number; plans: number }> {
    const [total, active, plans] = await Promise.all([
      this.tenantRepo.countAll(),
      this.tenantRepo.countActive(),
      this.planRepo.findAll(),
    ]);
    return { total, active, inactive: total - active, plans: plans.length };
  }

  private async provisionTenant(
    _tenantId: string,
    schemaName: string,
    data: CreateTenantDto,
  ): Promise<void> {
    await provisionTenantSchema({
      schemaName,
      centerName: data.name,
      adminUsername: data.adminUsername,
      adminPassword: data.adminPassword,
      adminName: data.adminName,
    });
  }
}
