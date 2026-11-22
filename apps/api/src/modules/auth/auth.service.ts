import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../shared/infrastructure/database/prisma.service';
import { KyselyService } from '../../shared/infrastructure/database/kysely.service';
import { AppError } from '../../core/errors/app.error';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { provisionTenantSchema } from '../../shared/infrastructure/database/tenant-provisioner';

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
    // معالج الإعداد مسموح مرة واحدة بس — لو فيه مركز موجود يبقى الإعداد اتعمل قبل كده
    const existing = await this.prisma.tenant.count();
    if (existing > 0) {
      throw new AppError('SETUP_ALREADY_DONE', 'تم إعداد البرنامج بالفعل', 409);
    }

    const tenantId = randomUUID();
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
        schemaName,
        planId: plan.id,
      },
    });

    // نفس مسار تجهيز المراكز من لوحة المنصة: كل الـ tenant migrations بالترتيب
    // بدل جداول SQL يدوية كانت بتفوّت أي migration جديدة على العملاء الجدد
    try {
      await provisionTenantSchema({
        schemaName,
        centerName: data.centerName,
        adminUsername: data.username,
        adminPassword: data.password,
        adminName: data.centerName,
      });
    } catch (err) {
      // لو التجهيز فشل، نشيل سجل المركز عشان المعالج يقدر يتعاد من غير ما يتقفل
      await this.prisma.tenant.delete({ where: { id: tenantId } }).catch(() => undefined);
      throw err;
    }
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
    const accessToken = this.jwt.sign(payload, { secret, expiresIn: this.accessExpiry() } as any);
    const refreshToken = this.jwt.sign(payload, { secret, expiresIn: this.refreshExpiry() } as any);
    return {
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, username: user.username, role: user.role, permissions },
    };
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
    const accessToken = this.jwt.sign(payload, { secret, expiresIn: this.accessExpiry() } as any);
    const refreshToken = this.jwt.sign(payload, { secret, expiresIn: this.refreshExpiry() } as any);
    return { accessToken, refreshToken, user: { id: admin.id, name: admin.name, email: admin.email, role: 'super_admin' } };
  }

  async refreshToken(token: string) {
    try {
      const secret = this.config.get<string>('JWT_SECRET') as string;
      const payload = this.jwt.verify(token, { secret }) as any;
      const newAccessToken = this.jwt.sign(
        {
          sub: payload.sub,
          tenantId: payload.tenantId,
          role: payload.role,
          permissions: payload.permissions ?? [],
          type: payload.type,
        },
        { secret, expiresIn: this.accessExpiry() } as any,
      );
      return { accessToken: newAccessToken };
    } catch {
      throw AppError.unauthorized('الجلسة منتهية — سجل دخولك مرة أخرى', 'TOKEN_EXPIRED');
    }
  }

  /** مدة صلاحية access token — قابلة للتعديل من .env (JWT_ACCESS_EXPIRY) بدون تعديل الكود */
  private accessExpiry(): string {
    return this.config.get<string>('JWT_ACCESS_EXPIRY') || '8h';
  }

  /** مدة صلاحية refresh token — قابلة للتعديل من .env (JWT_REFRESH_EXPIRY) بدون تعديل الكود */
  private refreshExpiry(): string {
    return this.config.get<string>('JWT_REFRESH_EXPIRY') || '30d';
  }
}