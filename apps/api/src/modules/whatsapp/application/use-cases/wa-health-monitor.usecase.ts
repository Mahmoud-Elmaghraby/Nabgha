import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IWaSessionRepository, WA_SESSION_REPOSITORY } from '../../domain/repositories/wa.repository.interface';
import { IWaSettingsRepository, WA_SETTINGS_REPOSITORY } from '../../domain/repositories/wa.repository.interface';
import { IWaProvider, WA_PROVIDER } from '../../domain/interfaces/wa-provider.interface';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { ConnectDeviceUseCase } from './connect-device.usecase';

@Injectable()
export class WaHealthMonitorUseCase {
  private readonly logger = new Logger(WaHealthMonitorUseCase.name);

  constructor(
    @Inject(WA_PROVIDER) private readonly provider: IWaProvider,
    @Inject(WA_SESSION_REPOSITORY) private readonly sessionRepo: IWaSessionRepository,
    @Inject(WA_SETTINGS_REPOSITORY) private readonly settingsRepo: IWaSettingsRepository,
    private readonly prisma: PrismaService,
    private readonly connectDeviceUseCase: ConnectDeviceUseCase,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkAllSessions(): Promise<void> {
    const tenants = await this.prisma.tenant.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    for (const tenant of tenants) {
      await this.checkSession(tenant.id);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async incrementWarmupDays(): Promise<void> {
    const tenants = await this.prisma.tenant.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    for (const tenant of tenants) {
      const session = await this.sessionRepo.findByTenantId(tenant.id);
      const settings = await this.settingsRepo.findByTenantId(tenant.id);
      // لا تزيد أيام الـ warmup لو المستخدم عطّله من الإعدادات
      if (session?.isConnected && session.isWarmingUp && (settings?.warmupEnabled ?? true)) {
        session.incrementWarmupDay();
        await this.sessionRepo.save(session);
        this.logger.log(`Tenant ${tenant.id} warmup day: ${session.warmupDay}`);
      }
    }
  }

  private async checkSession(tenantId: string): Promise<void> {
    try {
      const session = await this.sessionRepo.findByTenantId(tenantId);
      if (!session) return;

      if (session.status === 'banned') return;

      const state = await this.provider.getConnectionState(tenantId);

      session.lastHealthCheck = new Date();

      if (state.status === 'disconnected' && session.status === 'connected') {
        this.logger.warn(`Health check: tenant ${tenantId} disconnected — attempting reconnect`);
        session.markDisconnected();
        await this.sessionRepo.save(session);
        // أعد تشغيل ConnectDeviceUseCase لتسجيل الـ callbacks وإعادة الاتصال
        this.connectDeviceUseCase.execute(tenantId).catch(err =>
          this.logger.error(`Auto-reconnect failed for tenant ${tenantId}: ${err.message}`)
        );
        return;
      }

      await this.sessionRepo.save(session);
    } catch (err: any) {
      this.logger.error(`Health check error for tenant ${tenantId}: ${err.message}`);
    }
  }

  async getHealthStatus(tenantId: string): Promise<{
    status: string;
    phone?: string;
    warmupDay: number;
    dailyLimit: number;
    lastHealthCheck?: Date;
    isBanned: boolean;
  }> {
    const session = await this.sessionRepo.findByTenantId(tenantId);
    const settings = await this.settingsRepo.findByTenantId(tenantId);
    const state = await this.provider.getConnectionState(tenantId);

    return {
      status: state.status,
      phone: state.phone ?? session?.phone ?? undefined,
      warmupDay: session?.warmupDay ?? 0,
      dailyLimit: session ? session.getCurrentDailyLimit(settings?.dailyLimit ?? 50, settings?.warmupEnabled ?? true) : 10,
      lastHealthCheck: session?.lastHealthCheck ?? undefined,
      isBanned: session?.isBanned ?? false,
    };
  }
}
