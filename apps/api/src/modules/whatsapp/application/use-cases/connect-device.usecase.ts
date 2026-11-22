import { Inject, Injectable, Logger } from '@nestjs/common';
import { IWaProvider, WA_PROVIDER } from '../../domain/interfaces/wa-provider.interface';
import { IWaSessionRepository, WA_SESSION_REPOSITORY } from '../../domain/repositories/wa.repository.interface';
import { IWaSettingsRepository, WA_SETTINGS_REPOSITORY } from '../../domain/repositories/wa.repository.interface';
import { IWaTemplateRepository, WA_TEMPLATE_REPOSITORY } from '../../domain/repositories/wa.repository.interface';
import { WA_DEFAULT_TEMPLATES, WA_TEMPLATE_KEYS } from '../../domain/entities/wa-template.entity';
import { HandleInboundUseCase } from './handle-inbound.usecase';

@Injectable()
export class ConnectDeviceUseCase {
  private readonly logger = new Logger(ConnectDeviceUseCase.name);

  constructor(
    @Inject(WA_PROVIDER) private readonly provider: IWaProvider,
    @Inject(WA_SESSION_REPOSITORY) private readonly sessionRepo: IWaSessionRepository,
    @Inject(WA_SETTINGS_REPOSITORY) private readonly settingsRepo: IWaSettingsRepository,
    @Inject(WA_TEMPLATE_REPOSITORY) private readonly templateRepo: IWaTemplateRepository,
    private readonly handleInbound: HandleInboundUseCase,
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

    // الـ callbacks بتجلب الـ session من DB في كل مرة بدل ما تعتمد على المتغير القديم
    // (closure stale كانت تُسبب تحديث entity قديمة بعد restart السيرفر أو إعادة الاتصال)
    this.provider.onQrCode(tenantId, async (qrCode) => {
      const s = await this.sessionRepo.findByTenantId(tenantId);
      if (!s) return;
      s.setQrCode(qrCode);
      await this.sessionRepo.save(s);
      this.logger.log(`QR generated for tenant ${tenantId}`);
    });

    this.provider.onConnected(tenantId, async (phone) => {
      const s = await this.sessionRepo.findByTenantId(tenantId);
      if (!s) return;
      s.markConnected(phone);
      await this.sessionRepo.save(s);
      this.logger.log(`Tenant ${tenantId} connected — ${phone}`);
    });

    this.provider.onDisconnected(tenantId, async (reason) => {
      const s = await this.sessionRepo.findByTenantId(tenantId);
      if (!s) return;

      if (reason === 'banned') {
        // واتساب حظر الرقم (403) — نسجّل الحظر في DB فوراً
        s.markBanned();
        this.logger.error(`🚫 Tenant ${tenantId} marked as BANNED in DB`);
      } else {
        s.markDisconnected();
        this.logger.warn(`Tenant ${tenantId} disconnected — reason: ${reason}`);
      }

      await this.sessionRepo.save(s);
    });

    // ── Inbound Messages — الآن كل رسالة واردة بتتخزن تلقائياً ──
    this.provider.onMessage(tenantId, async (phone, body) => {
      try {
        await this.handleInbound.execute({ tenantId, phone, body });
      } catch (err: any) {
        this.logger.error(`Failed to handle inbound message from ${phone}: ${err.message}`);
      }
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

  /** تسجيل خروج كامل — يحذف ملفات الجلسة ويحتاج إعادة مسح QR */
  async logout(tenantId: string): Promise<void> {
    await this.provider.logout(tenantId);
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
      dailyLimit: session ? session.getCurrentDailyLimit(settings?.dailyLimit ?? 50, settings?.warmupEnabled ?? true) : undefined,
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
