import { Controller, Get, Inject } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/database/prisma.service';
import { Redis } from 'ioredis';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  @Get()
  async check() {
    const checks = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.redis.ping(),
    ]);

    const db = checks[0].status === 'fulfilled' ? 'up' : 'down';
    const cache = checks[1].status === 'fulfilled' ? 'up' : 'down';
    const healthy = db === 'up' && cache === 'up';

    return {
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: { db, cache },
    };
  }
}
