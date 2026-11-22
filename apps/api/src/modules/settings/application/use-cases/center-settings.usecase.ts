import { Injectable } from '@nestjs/common';
import { CenterSettingsRepository } from '../../infrastructure/settings.repository';
import { CenterSettingsEntity } from '../../domain/entities/center-settings.entity';
import type { UpdateCenterSettingsDto } from '../dtos/settings.dto';

@Injectable()
export class CenterSettingsUseCase {
  constructor(private readonly repo: CenterSettingsRepository) {}

  async getOrCreate(tenantId: string): Promise<CenterSettingsEntity> {
    const existing = await this.repo.findByTenantId(tenantId);
    if (existing) return existing;
    return this.repo.upsert(tenantId, {});
  }

  async update(tenantId: string, data: UpdateCenterSettingsDto): Promise<CenterSettingsEntity> {
    const settings = await this.getOrCreate(tenantId);
    settings.update(data);
    await this.repo.save(tenantId, settings);
    return settings;
  }
}
