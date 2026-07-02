import { Inject, Injectable, Logger } from '@nestjs/common';
import { IWaProvider, WA_PROVIDER } from '../../domain/interfaces/wa-provider.interface';
import { IWaSessionRepository, WA_SESSION_REPOSITORY } from '../../domain/repositories/wa.repository.interface';
import { IWaSettingsRepository, WA_SETTINGS_REPOSITORY } from '../../domain/repositories/wa.repository.interface';
import { IWaTemplateRepository, WA_TEMPLATE_REPOSITORY } from '../../domain/repositories/wa.repository.interface';
import { WA_DEFAULT_TEMPLATES, WA_TEMPLATE_KEYS } from '../../domain/entities/wa-template.entity';

@Injectable()
export class ConnectDeviceUseCase {
  private readonly logger = new Logger(ConnectDeviceUseCase.name);

  constructor(
    @Inject(WA_PROVIDER) private readonly provider: IWaProvider,
    @Inject(WA_SESSION_REPOSITORY) private readonly sessionRepo: IWaSessionRepository,
    @Inject(WA_SETTINGS_REPOSITORY) private readonly settingsRepo: IWaSettingsRepository,
    @Inject(WA_TEMPLATE_REPOSITORY) private readonly templateRepo: IWaTemplateRepository,
  ) {}

  async execute(tenantId: string): Promise<{ status: string; qrCode?: string }> {
    await this.ensureSettingsExist(tenantId);
    await this.ensureTemplatesExist(tenantId);

    let session = await this.sessionRepo.findByTenantId(tenantId);
    if (!session) {
      session = await this.sessionRepo.upsert(tenantId, { status: 'disconnected' });
    }

    if (session.isConnected) {
      return { status: 'already_connected' };
    }

    this.provider.onQrCode(tenantId, async (qrCode) => {
      session!.setQrCode(qrCode);
      await this.sessionRepo.save(session!);
      this.logger.log(`QR generated for tenant ${tenantId}`);
    });

    this.provider.onConnected(tenantId, async (phone) => {
      session!.markConnected(phone);
      await this.sessionRepo.save(session!);
      this.logger.log(`Tenant ${tenantId} connected — ${phone}`);
    });

    this.provider.onDisconnected(tenantId, async (reason) => {
      session!.markDisconnected();
      await this.sessionRepo.save(session!);
      this.logger.warn(`Tenant ${tenantId} disconnected — ${reason}`);
    });

    await this.provider.connect(tenantId);

    const state = await this.provider.getConnectionState(tenantId);
    return { status: state.status, qrCode: state.qrCode };
  }

  async disconnect(tenantId: string): Promise<void> {
    await this.provider.disconnect(tenantId);
    const session = await this.sessionRepo.findByTenantId(tenantId);
    if (session) {
      session.markDisconnected();
      session.clearQrCode();
      await this.sessionRepo.save(session);
    }
  }

  async getStatus(tenantId: string): Promise<{ status: string; phone?: string; qrCode?: string; warmupDay?: number; dailyLimit?: number }> {
    const state = await this.provider.getConnectionState(tenantId);
    const session = await this.sessionRepo.findByTenantId(tenantId);
    const settings = await this.settingsRepo.findByTenantId(tenantId);
    return {
      status: state.status,
      phone: state.phone ?? session?.phone ?? undefined,
      qrCode: session?.qrCode ?? undefined,
      warmupDay: session?.warmupDay,
      dailyLimit: session ? session.getCurrentDailyLimit(settings?.dailyLimit ?? 50) : undefined,
    };
  }

  private async ensureSettingsExist(tenantId: string): Promise<void> {
    const existing = await this.settingsRepo.findByTenantId(tenantId);
    if (!existing) {
      await this.settingsRepo.upsert(tenantId, {});
    }
  }

  private async ensureTemplatesExist(tenantId: string): Promise<void> {
    const existing = await this.templateRepo.findAllByTenantId(tenantId);
    const existingKeys = existing.map((t) => t.key);
    for (const key of WA_TEMPLATE_KEYS) {
      if (!existingKeys.includes(key)) {
        await this.templateRepo.upsert(tenantId, key, WA_DEFAULT_TEMPLATES[key]);
      }
    }
  }
}
