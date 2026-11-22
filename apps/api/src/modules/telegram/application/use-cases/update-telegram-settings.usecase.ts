import { Injectable } from '@nestjs/common';
import { TelegramSettingsRepository } from '../../infrastructure/telegram-settings.repository';
import { TelegramSettingsEntity } from '../../domain/entities/telegram-settings.entity';

// مرآة لـ UpdateSettingsUseCase (whatsapp) — بجدول telegram_settings المستقل،
// من غير فحص delayMin/delayMax لأنه مش موجود هنا أصلاً.
export interface UpdateTelegramSettingsInput {
  tenantId: string;
  telegramEnabled?: boolean;
  sendHoursFrom?: string;
  sendHoursTo?: string;
  notifyAbsent?: boolean;
  notifyPresent?: boolean;
  notifyLate?: boolean;
  notify3Absences?: boolean;
  notifyPaymentConfirm?: boolean;
  notifyPaymentDue7d?: boolean;
  notifyPaymentDue1d?: boolean;
  notifyPaymentOverdue?: boolean;
  notifyNewStudent?: boolean;
  notifyGroupAdded?: boolean;
  notifyGroupRemoved?: boolean;
  notifyAbsenceExcused?: boolean;
  notifyGradeRecorded?: boolean;
}

@Injectable()
export class UpdateTelegramSettingsUseCase {
  constructor(private readonly settingsRepo: TelegramSettingsRepository) {}

  async execute(input: UpdateTelegramSettingsInput): Promise<TelegramSettingsEntity> {
    const { tenantId, ...data } = input;

    let settings = await this.settingsRepo.findByTenantId(tenantId);
    if (!settings) {
      return this.settingsRepo.upsert(tenantId, data);
    }

    settings.update(data);
    await this.settingsRepo.save(settings);
    return settings;
  }

  async getOrCreate(tenantId: string): Promise<TelegramSettingsEntity> {
    const existing = await this.settingsRepo.findByTenantId(tenantId);
    if (existing) return existing;
    return this.settingsRepo.upsert(tenantId, {});
  }
}
