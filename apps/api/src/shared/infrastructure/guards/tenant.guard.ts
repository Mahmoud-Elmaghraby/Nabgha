import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { KyselyService } from '../database/kysely.service';
import { Redis } from 'ioredis';

const TENANT_CACHE_TTL = 300; // 5 دقايق

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private kysely: KyselyService,
    @Inject('REDIS_CLIENT') private redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.tenantId) {
      throw new UnauthorizedException('Tenant not found');
    }

    const cacheKey = `tenant:${user.tenantId}`;

    // جرب الـ cache الأول
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        request.tenant = JSON.parse(cached);
        request.db = this.kysely.getTenantDb(user.tenantId);
        return true;
      }
    } catch {
      // لو Redis فشل، كمّل على الـ DB
    }

    // fallback للـ DB
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId, isActive: true },
    });

    if (!tenant) {
      throw new UnauthorizedException('Tenant is inactive or not found');
    }

    // خزّن في cache
    try {
      await this.redis.setex(cacheKey, TENANT_CACHE_TTL, JSON.stringify(tenant));
    } catch {
      // مش blocking لو Redis فشل
    }

    request.tenant = tenant;
    request.db = this.kysely.getTenantDb(user.tenantId);

    return true;
  }
}
