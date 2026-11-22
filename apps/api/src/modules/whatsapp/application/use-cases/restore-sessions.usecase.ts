import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { IWaSessionRepository, WA_SESSION_REPOSITORY } from '../../domain/repositories/wa.repository.interface';
import { IWaSettingsRepository, WA_SETTINGS_REPOSITORY } from '../../domain/repositories/wa.repository.interface';
import { ConnectDeviceUseCase } from './connect-device.usecase';
import * as path from 'path';
import * as fs from 'fs';

const MIN_SAFE_DELAY_MIN = 30;
const MIN_SAFE_DELAY_MAX = 60;

@Injectable()
export class RestoreSessionsUseCase implements OnModuleInit {
  private readonly logger = new Logger(RestoreSessionsUseCase.name);

  constructor(
    @Inject(WA_SESSION_REPOSITORY) private readonly sessionRepo: IWaSessionRepository,
    @Inject(WA_SETTINGS_REPOSITORY) private readonly settingsRepo: IWaSettingsRepository,
    private readonly prisma: PrismaService,
    private readonly connectDeviceUseCase: ConnectDeviceUseCase,
  ) {}

  async onModuleInit(): Promise<void> {
    // أولاً: migration فوري لتحديث delay لكل الـ tenants
    await this.migrateDelaySettings();
    // ثانياً: انتظر 5 ثوانٍ عشان الباك إند يكمل التهيئة قبل ما نحاول نتصل
    setTimeout(() => this.restoreAll(), 5000);
  }

  /**
   * يحدّث delay_min_seconds و delay_max_seconds لكل tenant
   * عنده قيمة أقل من الحد الآمن (30 ثانية minimum).
   * بيشتغل مرة واحدة عند كل startup — آمن لأنه idempotent.
   */
  private async migrateDelaySettings(): Promise<void> {
    try {
      const tenants = await this.prisma.tenant.findMany({
        where: { isActive: true },
        select: { id: true },
      });

      let migrated = 0;
      for (const tenant of tenants) {
        const settings = await this.settingsRepo.findByTenantId(tenant.id);
        if (!settings) continue;

        const needsUpdate =
          settings.delayMinSeconds < MIN_SAFE_DELAY_MIN ||
          settings.delayMaxSeconds < MIN_SAFE_DELAY_MAX;

        if (needsUpdate) {
          settings.update({
            delayMinSeconds: Math.max(settings.delayMinSeconds, MIN_SAFE_DELAY_MIN),
            delayMaxSeconds: Math.max(settings.delayMaxSeconds, MIN_SAFE_DELAY_MAX),
          });
          await this.settingsRepo.save(settings);
          migrated++;
          this.logger.log(
            `Delay migrated for tenant ${tenant.id}: ` +
            `${settings.delayMinSeconds}s–${settings.delayMaxSeconds}s`,
          );
        }
      }

      if (migrated > 0) {
        this.logger.log(`✅ Delay migration complete — ${migrated} tenant(s) updated`);
      }
    } catch (err: any) {
      this.logger.error(`Delay migration error: ${err.message}`);
    }
  }

  private async restoreAll(): Promise<void> {
    try {
      const tenants = await this.prisma.tenant.findMany({
        where: { isActive: true },
        select: { id: true },
      });

      for (const tenant of tenants) {
        // تحقق من وجود ملفات الجلسة أولاً
        const baseDir = path.join(process.env.APPDATA ?? process.cwd(), 'Nabgha', 'wa-sessions');
        const sessionDir = path.join(baseDir, tenant.id);
        if (!fs.existsSync(sessionDir)) continue;

        const files = fs.readdirSync(sessionDir);
        if (files.length === 0) continue;

        // تحقق من حالة الجلسة في DB — لا تُعيد الاتصال لو الجلسة banned
        const session = await this.sessionRepo.findByTenantId(tenant.id);
        if (session?.isBanned) {
          this.logger.warn(`Skipping restore for banned tenant ${tenant.id}`);
          continue;
        }

        this.logger.log(`Restoring WA session for tenant ${tenant.id}`);

        // استخدم ConnectDeviceUseCase.execute() بدل provider.connect() مباشرة
        // عشان يُسجّل الـ callbacks (onConnected, onQrCode, onDisconnected) بشكل صحيح
        // وده هو السبب اللي كان بيخلي DB تفضل disconnected حتى لو Baileys اتصل فعلاً
        this.connectDeviceUseCase.execute(tenant.id).catch(err =>
          this.logger.error(`Failed to restore session for tenant ${tenant.id}: ${err.message}`)
        );
      }
    } catch (err: any) {
      this.logger.error(`Failed to restore sessions: ${err.message}`);
    }
  }
}

