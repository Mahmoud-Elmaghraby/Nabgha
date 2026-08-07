import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/database/prisma.service';
import { TenantEntity } from '../domain/entities/tenant.entity';
import type { CreateTenantDto, UpdateTenantDto } from '../application/dtos/tenant.dto';

@Injectable()
export class TenantRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(search?: string): Promise<TenantEntity[]> {
    const rows = await this.prisma.tenant.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { slug: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(this.toEntity);
  }

  async findById(id: string): Promise<TenantEntity | null> {
    const row = await this.prisma.tenant.findUnique({
      where: { id },
      include: { plan: true },
    });
    return row ? this.toEntity(row) : null;
  }

  async findBySlug(slug: string): Promise<TenantEntity | null> {
    const row = await this.prisma.tenant.findUnique({
      where: { slug },
      include: { plan: true },
    });
    return row ? this.toEntity(row) : null;
  }

  async create(data: {
    id: string;
    name: string;
    slug: string;
    planId: string;
    schemaName: string;
  }): Promise<TenantEntity> {
    const row = await this.prisma.tenant.create({
      data: {
        id: data.id,
        name: data.name,
        slug: data.slug,
        planId: data.planId,
        schemaName: data.schemaName,
        isActive: true,
        limits: {},
      },
      include: { plan: true },
    });
    return this.toEntity(row);
  }

  async save(tenant: TenantEntity): Promise<void> {
    await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        name: tenant.name,
        planId: tenant.planId,
        isActive: tenant.isActive,
        limits: tenant.limits,
        updatedAt: tenant.updatedAt,
      },
    });
  }

  async countAll(): Promise<number> {
    return this.prisma.tenant.count();
  }

  async countActive(): Promise<number> {
    return this.prisma.tenant.count({ where: { isActive: true } });
  }

  private toEntity(row: any): TenantEntity {
    return new TenantEntity(
      row.id,
      row.name,
      row.slug,
      row.planId,
      row.isActive,
      row.schemaName,
      row.limits ?? {},
      row.createdAt,
      row.updatedAt,
    );
  }
}
