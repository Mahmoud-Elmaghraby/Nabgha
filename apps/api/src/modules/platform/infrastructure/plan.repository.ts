import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/database/prisma.service';
import { PlanEntity } from '../domain/entities/plan.entity';
import type { CreatePlanDto } from '../application/dtos/plan.dto';

@Injectable()
export class PlanRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<PlanEntity[]> {
    const rows = await this.prisma.plan.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(this.toEntity);
  }

  async findById(id: string): Promise<PlanEntity | null> {
    const row = await this.prisma.plan.findUnique({ where: { id } });
    return row ? this.toEntity(row) : null;
  }

  async findBySlug(slug: string): Promise<PlanEntity | null> {
    const row = await this.prisma.plan.findUnique({ where: { slug } });
    return row ? this.toEntity(row) : null;
  }

  async create(data: CreatePlanDto): Promise<PlanEntity> {
    const row = await this.prisma.plan.create({
      data: {
        name: data.name,
        slug: data.slug,
        maxStudents: data.maxStudents,
        price: data.price ?? 0,
        features: data.features ?? {},
      },
    });
    return this.toEntity(row);
  }

  async save(plan: PlanEntity): Promise<void> {
    await this.prisma.plan.update({
      where: { id: plan.id },
      data: {
        name: plan.name,
        maxStudents: plan.maxStudents,
        price: plan.price,
        features: plan.features,
        updatedAt: plan.updatedAt,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.plan.delete({ where: { id } });
  }

  async countTenants(planId: string): Promise<number> {
    return this.prisma.tenant.count({ where: { planId } });
  }

  private toEntity(row: any): PlanEntity {
    return new PlanEntity(
      row.id,
      row.name,
      row.slug,
      row.maxStudents,
      row.price,
      row.features ?? {},
      row.createdAt,
      row.updatedAt,
    );
  }
}
