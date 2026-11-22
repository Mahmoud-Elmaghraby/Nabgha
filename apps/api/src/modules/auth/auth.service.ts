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

  // hash ثابت بنقارن بيه لما المستخدم مش موجود — عشان وقت الرد يبقى زي وقت
  // الباسورد الغلط بالظبط، ومايبانش من سرعة الرد إن اسم المستخدم موجود ولا لأ
  private static readonly DUMMY_HASH = bcrypt.hashSync('nabgha-timing-equalizer', 10);

  /**
   * access token قصير + refresh token طويل. الـ refresh عليه tokenUse: 'refresh'
   * والـ strategies بترفضه كـ access token — قبل كده الاتنين كانوا نفس الشكل بالظبط،
   * فالـ refresh token (30 يوم) كان ينفع يتستخدم مباشرة كتوكن دخول.
   */
  private issueTokens(payload: Record<string, unknown>, secret: string) {
    const accessToken = this.jwt.sign(payload, { secret, expiresIn: this.accessExpiry() } as any);
    const refreshToken = this.jwt.sign({ ...payload, tokenUse: 'refresh' }, { secret, expiresIn: this.refreshExpiry() } as any);
    return { accessToken, refreshToken };
  }

  async tenantLogin(slug: string, username: string, password: string) {
    // كود المركز بيتكتب أحيانًا بحروف كابيتال أو بمسافة (Tcronix بدل tcronix)
    const normalizedSlug = slug.trim().toLowerCase();
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: normalizedSlug, isActive: true },
    });
    if (!tenant) {
      throw AppError.unauthorized('TENANT_NOT_FOUND', 'كود المركز غير صحيح أو المركز موقوف — راجع الكود مع إدارة المركز');
    }
    const db = this.kysely.getTenantDb(tenant.id);
    const user = await db
      .selectFrom('users')
      .selectAll()
      .where('username', '=', username.trim())
      .where('is_active', '=', true)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    const isValid = await bcrypt.compare(password, user?.password_hash ?? AuthService.DUMMY_HASH);
    if (!user || !isValid) {
      throw AppError.unauthorized('INVALID_CREDENTIALS', 'اسم المستخدم أو كلمة المرور غير صحيحة');
    }
    const permissions = Array.isArray(user.permissions) ? user.permissions : [];
    const payload = { sub: user.id, tenantId: tenant.id, role: user.role, permissions, type: 'tenant' };
    const secret = this.config.get<string>('JWT_SECRET') as string;
    return {
      ...this.issueTokens(payload, secret),
      user: { id: user.id, name: user.name, username: user.username, role: user.role, permissions },
    };
  }

  async platformLogin(email: string, password: string) {
    const admin = await this.prisma.platformUser.findUnique({ where: { email: email.trim().toLowerCase() } });
    const isValid = await bcrypt.compare(password, admin?.passwordHash ?? AuthService.DUMMY_HASH);
    if (!admin || !isValid) {
      throw AppError.unauthorized('INVALID_CREDENTIALS', 'البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }
    // platform tokens مالهاش tenantId (كان null متحوّل بالعافية لـ string — AUTH-008)
    const payload = { sub: admin.id, role: 'super_admin', type: 'platform' };
    const secret = this.config.get<string>('PLATFORM_JWT_SECRET') as string;
    return {
      ...this.issueTokens(payload, secret),
      user: { id: admin.id, name: admin.name, email: admin.email, role: 'super_admin' },
    };
  }

  /**
   * تجديد الجلسة. بيعيد قراية المستخدم من قاعدة البيانات في كل مرة:
   * - لو المستخدم اتوقف أو المركز اتقفل → الجلسة تنتهي (قبل كده كانت بتفضل شغالة 30 يوم).
   * - لو صلاحياته اتغيرت → التوكن الجديد بيشيل الصلاحيات الجديدة (قبل كده كانت بتفضل
   *   القديمة لحد ما يعمل خروج ودخول).
   * - لوحة المنصة ليها سر مختلف — قبل كده التجديد كان بيستخدم سر المراكز دايمًا،
   *   فأدمن المنصة كان بيطلع برة كل 8 ساعات.
   * بيرجع refresh token جديد كمان (rotation)، فالمستخدم النشط مابيطلعش برة أبدًا.
   */
  async refreshToken(token: string) {
    const expired = () => AppError.unauthorized('TOKEN_EXPIRED', 'الجلسة منتهية — سجّل دخولك مرة تانية');
    const decoded = this.jwt.decode(token) as any;
    if (!decoded || decoded.tokenUse !== 'refresh') throw expired();

    if (decoded.type === 'platform') {
      const secret = this.config.get<string>('PLATFORM_JWT_SECRET') as string;
      let payload: any;
      try { payload = this.jwt.verify(token, { secret }); } catch { throw expired(); }
      const admin = await this.prisma.platformUser.findUnique({ where: { id: payload.sub } });
      if (!admin) throw expired();
      return this.issueTokens({ sub: admin.id, role: 'super_admin', type: 'platform' }, secret);
    }

    if (decoded.type === 'tenant') {
      const secret = this.config.get<string>('JWT_SECRET') as string;
      let payload: any;
      try { payload = this.jwt.verify(token, { secret }); } catch { throw expired(); }
      const tenant = await this.prisma.tenant.findUnique({ where: { id: payload.tenantId } });
      if (!tenant?.isActive) throw expired();
      const user = await this.kysely.getTenantDb(tenant.id)
        .selectFrom('users')
        .select(['id', 'role', 'permissions'])
        .where('id', '=', payload.sub)
        .where('is_active', '=', true)
        .where('deleted_at', 'is', null)
        .executeTakeFirst();
      if (!user) throw expired();
      const permissions = Array.isArray(user.permissions) ? user.permissions : [];
      return this.issueTokens(
        { sub: user.id, tenantId: tenant.id, role: user.role, permissions, type: 'tenant' },
        secret,
      );
    }

    throw expired();
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