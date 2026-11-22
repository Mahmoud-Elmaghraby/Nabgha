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
    return { lanIp: pickLanIp(os.networkInterfaces()) };
  }
}

// كروت الشبكة الافتراضية (VPN, VMware, VirtualBox, Docker/WSL, Hyper-V) بتاخد
// IP خاص بيها من غير أي وصول حقيقي للشبكة اللي باقي الأجهزة عليها. كان الكود
// القديم بياخد أول كارت IPv4 غير داخلي يلاقيه من غير أي فلترة — لو جهاز
// المستخدم فيه أي كارت افتراضي، ترتيب Object.keys() مش مضمون، فكان ممكن يطلع
// IP مش قابل للوصول خالص من موبايل/تابلت على نفس الشبكة، والعرض ERR_CONNECTION_TIMED_OUT
// من غير أي رسالة خطأ واضحة تدل على السبب.
const VIRTUAL_ADAPTER_PATTERN = /virtualbox|vmware|vmnet|hyper-v|virtual|docker|wsl|npcap|tap-?windows|\btun\b|\bppp\b|bluetooth|isatap|loopback|vethernet/i;
const PHYSICAL_ADAPTER_HINT = /wi-?fi|wireless|ethernet|local area connection|lan\b/i;

function pickLanIp(interfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]>): string {
  const candidates: { name: string; address: string }[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        candidates.push({ name, address: iface.address });
      }
    }
  }
  if (candidates.length === 0) return 'localhost';

  const real = candidates.filter((c) => !VIRTUAL_ADAPTER_PATTERN.test(c.name));
  const pool = real.length > 0 ? real : candidates;
  const preferred = pool.find((c) => PHYSICAL_ADAPTER_HINT.test(c.name));
  return (preferred ?? pool[0]).address;
}