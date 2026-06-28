import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IWaProvider, WA_PROVIDER } from '../../domain/interfaces/wa-provider.interface';
import { IWaSessionRepository, WA_SESSION_REPOSITORY } from '../../domain/repositories/wa.repository.interface';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';

@Injectable()
export class WaHealthMonitorUseCase {
  private readonly logger = new Logger(WaHealthMonitorUseCase.name);

  constructor(
    @Inject(WA_PROVIDER) private readonly provider: IWaProvider,
    @Inject(WA_SESSION_REPOSITORY) private readonly sessionRepo: IWaSessionRepository,
    private readonly prisma: PrismaService,
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
      if (session?.isConnected && session.isWarmingUp) {
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

      if (session.status === 'disconnected' || session.status === 'banned') return;

      const state = await this.provider.getConnectionState(tenantId);

      session.lastHealthCheck = new Date();

      if (state.status === 'disconnected' && session.status === 'connected') {
        this.logger.warn(`Health check failed for tenant ${tenantId} — marking disconnected`);
        session.markDisconnected();
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
    const state = await this.provider.getConnectionState(tenantId);

    return {
      status: state.status,
      phone: state.phone ?? session?.phone ?? undefined,
      warmupDay: session?.warmupDay ?? 0,
      dailyLimit: session?.currentDailyLimit ?? 10,
      lastHealthCheck: session?.lastHealthCheck ?? undefined,
      isBanned: session?.isBanned ?? false,
    };
  }
}
