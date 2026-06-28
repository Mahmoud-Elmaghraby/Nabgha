import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../shared/infrastructure/database/prisma.service';
import { KyselyService } from '../../shared/infrastructure/database/kysely.service';
import { AppError } from '../../core/errors/app.error';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private kysely: KyselyService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async checkDesktopSetup(): Promise<number> {
    const tenants = await this.prisma.tenant.count();
    return tenants;
  }

  async initDesktopSetup(data: {
    centerName: string;
    slug: string;
    username: string;
    password: string;
  }): Promise<void> {
    const bcrypt = require('bcrypt');
    const { v4: uuidv4 } = require('uuid');

    const tenantId = uuidv4();
    const schemaName = `tenant_${tenantId.replace(/-/g, '_')}`;

    // إنشاء الـ default plan لو مش موجود
    let plan = await this.prisma.plan.findFirst();
    if (!plan) {
      plan = await this.prisma.plan.create({
        data: { name: 'Basic', slug: 'basic', maxStudents: 1000, price: 0 },
      });
    }

    await this.prisma.tenant.create({
      data: {
        id: tenantId,
        name: data.centerName,
        slug: data.slug,
        isActive: true,
        schemaName: schemaName,
        planId: plan.id,
      },
    });

    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    await pool.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'tenant_admin',
        permissions JSONB DEFAULT '[]',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS "${schemaName}".center_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        center_name VARCHAR(255) NOT NULL,
        center_logo_url TEXT,
        center_phone VARCHAR(20),
        center_address TEXT,
        currency VARCHAR(10) DEFAULT 'EGP',
        currency_symbol VARCHAR(5) DEFAULT 'ج.م',
        academic_year VARCHAR(20) DEFAULT '2025/2026',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "${schemaName}".tenant_settings (
        key VARCHAR(255) PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    const passwordHash = await bcrypt.hash(data.password, 10);
    await pool.query(`
      INSERT INTO "${schemaName}".users (username, password_hash, name, role, permissions)
      VALUES ($1, $2, $3, 'tenant_admin', '[]'::jsonb)
    `, [data.username, passwordHash, data.centerName]);

    await pool.query(`
      INSERT INTO "${schemaName}".center_settings (center_name)
      VALUES ($1)
    `, [data.centerName]);

    await pool.end();
  }

  async tenantLogin(slug: string, username: string, password: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug, isActive: true },
    });
    if (!tenant) {
      throw AppError.unauthorized('المركز غير موجود أو غير نشط', 'TENANT_NOT_FOUND');
    }
    const db = await this.kysely.getTenantDb(tenant.id);
    const user = await db
      .selectFrom('users')
      .selectAll()
      .where('username', '=', username)
      .where('is_active', '=', true)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    if (!user) {
      throw AppError.unauthorized('اسم المستخدم أو كلمة المرور غير صحيحة', 'INVALID_CREDENTIALS');
    }
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw AppError.unauthorized('اسم المستخدم أو كلمة المرور غير صحيحة', 'INVALID_CREDENTIALS');
    }
    const permissions = Array.isArray(user.permissions) ? user.permissions : [];
    const payload = { sub: user.id, tenantId: tenant.id, role: user.role, permissions, type: 'tenant' };
    const secret = this.config.get<string>('JWT_SECRET') as string;
    const accessToken = this.jwt.sign(payload, { secret, expiresIn: '15m' });
    const refreshToken = this.jwt.sign(payload, { secret, expiresIn: '30d' });
    return { accessToken, refreshToken, user: { id: user.id, name: user.name, username: user.username, role: user.role } };
  }

  async platformLogin(email: string, password: string) {
    const admin = await this.prisma.platformUser.findUnique({ where: { email } });
    if (!admin) {
      throw AppError.unauthorized('البريد الإلكتروني أو كلمة المرور غير صحيحة', 'INVALID_CREDENTIALS');
    }
    const isValid = await bcrypt.compare(password, admin.passwordHash);
    if (!isValid) {
      throw AppError.unauthorized('البريد الإلكتروني أو كلمة المرور غير صحيحة', 'INVALID_CREDENTIALS');
    }
    const payload = { sub: admin.id, tenantId: null as unknown as string, role: 'super_admin', type: 'platform' };
    const secret = this.config.get<string>('PLATFORM_JWT_SECRET') as string;
    const accessToken = this.jwt.sign(payload, { secret, expiresIn: '15m' });
    const refreshToken = this.jwt.sign(payload, { secret, expiresIn: '30d' });
    return { accessToken, refreshToken, user: { id: admin.id, name: admin.name, email: admin.email, role: 'super_admin' } };
  }

  async refreshToken(token: string) {
    try {
      const secret = this.config.get<string>('JWT_SECRET') as string;
      const payload = this.jwt.verify(token, { secret }) as any;
      const newAccessToken = this.jwt.sign(
        { sub: payload.sub, tenantId: payload.tenantId, role: payload.role, type: payload.type },
        { secret, expiresIn: '15m' },
      );
      return { accessToken: newAccessToken };
    } catch {
      throw AppError.unauthorized('الجلسة منتهية — سجل دخولك مرة أخرى', 'TOKEN_EXPIRED');
    }
  }
}