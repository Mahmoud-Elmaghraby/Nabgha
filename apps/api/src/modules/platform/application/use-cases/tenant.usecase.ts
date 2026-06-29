import { Injectable } from '@nestjs/common';
import { TenantRepository } from '../../infrastructure/tenant.repository';
import { PlanRepository } from '../../infrastructure/plan.repository';
import { TenantEntity } from '../../domain/entities/tenant.entity';
import { AppError } from '../../../../core/errors/app.error';
import type { CreateTenantDto, UpdateTenantDto } from '../dtos/tenant.dto';
import * as bcrypt from 'bcrypt';
import * as path from 'path';

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
    if (!tenant) throw new AppError('المركز غير موجود', 'NOT_FOUND', 404);
    return tenant;
  }

  async create(data: CreateTenantDto): Promise<TenantEntity> {
    const existing = await this.tenantRepo.findBySlug(data.slug);
    if (existing) throw new AppError('الـ slug مستخدم بالفعل', 'CONFLICT', 409);

    const plan = await this.planRepo.findById(data.planId);
    if (!plan) throw new AppError('الخطة غير موجودة', 'NOT_FOUND', 404);

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
    if (!tenant) throw new AppError('المركز غير موجود', 'NOT_FOUND', 404);

    if (data.planId) {
      const plan = await this.planRepo.findById(data.planId);
      if (!plan) throw new AppError('الخطة غير موجودة', 'NOT_FOUND', 404);
    }

    tenant.update(data);
    await this.tenantRepo.save(tenant);
    return tenant;
  }

  async toggleActive(id: string): Promise<TenantEntity> {
    const tenant = await this.tenantRepo.findById(id);
    if (!tenant) throw new AppError('المركز غير موجود', 'NOT_FOUND', 404);
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
    tenantId: string,
    schemaName: string,
    data: CreateTenantDto,
  ): Promise<void> {
    // استخدام الـ migration runner
    const { Pool } = require('pg');
    const fs = require('fs');

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const client = await pool.connect();

    try {
      const migrationsDir = path.join(
        __dirname, '..', '..', '..', '..', '..', '..', 
        'packages', 'db', 'src', 'migrations', 'tenant'
      );

      // إنشاء الـ schema
      await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

      // إنشاء migrations tracking table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".schema_migrations (
          version    VARCHAR(255) PRIMARY KEY,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      // تشغيل كل الـ migration files
      const files = fs.readdirSync(migrationsDir)
        .filter((f: string) => f.endsWith('.sql'))
        .sort();

      for (const file of files) {
        const version = `tenant/${file}`;
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        await client.query(`SET search_path TO "${schemaName}"`);
        await client.query(sql);
        await client.query(
          `INSERT INTO "${schemaName}".schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING`,
          [version]
        );
      }

      // إنشاء admin user
      const passwordHash = await bcrypt.hash(data.adminPassword, 10);
      await client.query(`SET search_path TO "${schemaName}"`);
      await client.query(`
        INSERT INTO users (username, password_hash, name, role, permissions)
        VALUES ($1, $2, $3, 'tenant_admin', '[]')
        ON CONFLICT (username) DO NOTHING
      `, [data.adminUsername, passwordHash, data.adminName]);

      await client.query(`
        INSERT INTO center_settings (center_name)
        VALUES ($1)
      `, [data.name]);

    } finally {
      client.release();
      await pool.end();
    }
  }
}
