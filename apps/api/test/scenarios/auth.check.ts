import 'reflect-metadata';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../../src/modules/auth/auth.service';
import { JwtStrategy, PlatformJwtStrategy } from '../../src/shared/infrastructure/auth/jwt.strategy';

(async () => {
  const hash = await bcrypt.hash('secret123', 10);
  let userActive = true;
  const tenants: any = { tcronix: { id: 'aaaaaaaa-1111-2222-3333-444444444444', slug: 'tcronix', isActive: true } };
  const prisma: any = {
    tenant: {
      findUnique: async ({ where }: any) => where.slug ? (tenants[where.slug]?.isActive === where.isActive ? tenants[where.slug] : null) : Object.values(tenants).find((t: any) => t.id === where.id) ?? null,
    },
    platformUser: { findUnique: async ({ where }: any) => (where.email === 'admin@nabgha.com' || where.id === 'p1') ? { id: 'p1', email: 'admin@nabgha.com', name: 'A', passwordHash: hash } : null },
  };
  const row = () => userActive ? { id: 'u1', name: 'U', username: 'demo', role: 'tenant_admin', permissions: ['x'], password_hash: hash } : undefined;
  const qb: any = { selectAll: () => qb, select: () => qb, where: () => qb, executeTakeFirst: async () => row() };
  const kysely: any = { getTenantDb: () => ({ selectFrom: () => qb }) };
  const cfg: any = { get: (k: string) => ({ JWT_SECRET: 's1', PLATFORM_JWT_SECRET: 's2' } as any)[k] };
  const jwt = new JwtService({});
  const svc = new AuthService(prisma, kysely, jwt, cfg);
  let ok = 0, bad = 0;
  const check = (n: string, c: boolean) => { c ? ok++ : bad++; console.log(c ? '✅' : '❌', n); };
  const err = async (p: Promise<any>) => { try { await p; return null; } catch (e: any) { return e; } };

  const l = await svc.tenantLogin('  Tcronix ', 'demo', 'secret123');
  check('كود مركز بحروف كابيتال ومسافات بيدخل', !!l.accessToken);
  const e1 = await err(svc.tenantLogin('nope', 'demo', 'secret123'));
  check('مركز غلط → رسالة عربي + كود', e1?.code === 'TENANT_NOT_FOUND' && /كود المركز/.test(e1?.message) && e1?.statusCode === 401);
  const e2 = await err(svc.tenantLogin('tcronix', 'demo', 'x'));
  check('باسورد غلط → INVALID_CREDENTIALS عربي', e2?.code === 'INVALID_CREDENTIALS' && /غير صحيحة/.test(e2?.message));
  const e3 = await err(svc.refreshToken(l.accessToken));
  check('access token مينفعش يتستخدم refresh', e3?.code === 'TOKEN_EXPIRED');
  const strat = new JwtStrategy(cfg);
  const refreshPayload = jwt.decode(l.refreshToken) as any;
  const e4 = await err(strat.validate(refreshPayload));
  check('refresh token مينفعش يتستخدم للدخول على الـ API', !!e4);
  check('access token عادي مقبول', !!(await strat.validate(jwt.decode(l.accessToken) as any)));
  const r = await svc.refreshToken(l.refreshToken);
  check('التجديد بيرجع access + refresh جديد', !!r.accessToken && !!r.refreshToken);
  userActive = false;
  const e5 = await err(svc.refreshToken(l.refreshToken));
  check('مستخدم اتوقف → التجديد بيفشل', e5?.code === 'TOKEN_EXPIRED');
  userActive = true; tenants.tcronix.isActive = false;
  const e6 = await err(svc.refreshToken(l.refreshToken));
  check('مركز اتقفل → التجديد بيفشل', e6?.code === 'TOKEN_EXPIRED');
  const p = await svc.platformLogin(' Admin@Nabgha.com ', 'secret123');
  const pr = await svc.refreshToken(p.refreshToken);
  check('تجديد جلسة لوحة المنصة شغال', !!pr.accessToken);
  const ps = new PlatformJwtStrategy(cfg);
  check('platform refresh مرفوض كـ access', !!(await err(ps.validate(jwt.decode(p.refreshToken) as any))));
  console.log(`\n${ok} نجح، ${bad} فشل`); process.exit(bad ? 1 : 0);
})();
