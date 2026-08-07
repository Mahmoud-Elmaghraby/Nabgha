import { Inject, Injectable } from '@nestjs/common';
import { IWaSettingsRepository, WA_SETTINGS_REPOSITORY } from '../../domain/repositories/wa.repository.interface';
import { WaSettingsEntity } from '../../domain/entities/wa-settings.entity';
import { AppError } from '../../../../core/errors/app.error';

export interface UpdateSettingsInput {
  tenantId: string;
  waEnabled?: boolean;
  sendHoursFrom?: string;
  sendHoursTo?: string;
  dailyLimit?: number;
  delayMinSeconds?: number;
  delayMaxSeconds?: number;
  warmupEnabled?: boolean;
  notifyAbsent?: boolean;
  notifyPresent?: boolean;
  notifyLate?: boolean;
  notify3Absences?: boolean;
  lateThresholdMin?: number;
  notifyPaymentConfirm?: boolean;
  notifyPaymentDue7d?: boolean;
  notifyPaymentDue1d?: boolean;
  notifyPaymentOverdue?: boolean;
  notifyNewStudent?: boolean;
  notifyGroupAdded?: boolean;
  notifyGroupRemoved?: boolean;
  notifyStudentCard?: boolean;
}

@Injectable()
export class UpdateSettingsUseCase {
  constructor(
    @Inject(WA_SETTINGS_REPOSITORY)
    private readonly settingsRepo: IWaSettingsRepository,
  ) {}

  async execute(input: UpdateSettingsInput): Promise<WaSettingsEntity> {
    const { tenantId, ...data } = input;

    let settings = await this.settingsRepo.findByTenantId(tenantId);

    if (!settings) {
      settings = await this.settingsRepo.upsert(tenantId, data);
      return settings;
    }

    if (data.delayMinSeconds !== undefined && data.delayMaxSeconds !== undefined) {
      if (data.delayMinSeconds > data.delayMaxSeconds) {
        throw new AppError('VALIDATION_ERROR', 'الحد الأدنى للتأخير يجب أن يكون أصغر من أو يساوي الحد الأقصى', 400);
      }
    }

    settings.update(data);
    await this.settingsRepo.save(settings);
    return settings;
  }

  async getOrCreate(tenantId: string): Promise<WaSettingsEntity> {
    const existing = await this.settingsRepo.findByTenantId(tenantId);
    if (existing) return existing;
    return this.settingsRepo.upsert(tenantId, {});
  }
}
