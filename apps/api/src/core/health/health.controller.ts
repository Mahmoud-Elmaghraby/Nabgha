import { Controller, Get, Inject } from '@nestjs/common';
import * as os from 'os';
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

  // بيرجّع الـ IP الحقيقي بتاع الشبكة المحلية — نفس منطق getLanIP() في
  // apps/desktop/src/main.ts. مطلوب لأن الفرونت إند (خصوصاً في وضع Desktop
  // اللي بيفتح على localhost:3001) مالوش وصول مباشر لهذا الحساب، وكان بيبني
  // رابط QR الموبايل من window.location.hostname اللي بيرجع "localhost"
  // حرفياً — رابط مالوش معنى على أي جهاز موبايل تاني غير نفس جهاز السيرفر.
  @Get('network-info')
  getNetworkInfo() {
    const interfaces = os.networkInterfaces();
    let lanIp = 'localhost';
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          lanIp = iface.address;
          break;
        }
      }
    }
    return { lanIp };
  }
}