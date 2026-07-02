import { Injectable } from '@nestjs/common';
import { KyselyService } from '../../../shared/infrastructure/database/kysely.service';
import { sql } from 'kysely';
import { CenterSettingsEntity } from '../domain/entities/center-settings.entity';

@Injectable()
export class CenterSettingsRepository {
  constructor(private readonly kysely: KyselyService) {}

  async findByTenantId(tenantId: string): Promise<CenterSettingsEntity | null> {
    const db = await this.kysely.getTenantDb(tenantId);
    const row = await db.selectFrom('center_settings').selectAll()
      .limit(1).executeTakeFirst();
    if (!row) return null;
    return this.toEntity(row);
  }

  async upsert(tenantId: string, data: Partial<CenterSettingsEntity>): Promise<CenterSettingsEntity> {
    const db = await this.kysely.getTenantDb(tenantId);
    const row = await db.insertInto('center_settings').values({
      center_name: data.centerName ?? 'المركز التعليمي',
      center_logo_url: data.centerLogoUrl ?? null,
      center_phone: data.centerPhone ?? null,
      center_phone_2: data.centerPhone2 ?? null,
      center_address: data.centerAddress ?? null,
      currency: data.currency ?? 'EGP',
      currency_symbol: data.currencySymbol ?? 'ج.م',
      academic_year: data.academicYear ?? null,
      updated_at: new Date(),
    } as any)
    .onConflict((oc) => oc.column('id').doUpdateSet({
      center_name: data.centerName ?? 'المركز التعليمي',
      center_logo_url: data.centerLogoUrl ?? null,
      center_phone: data.centerPhone ?? null,
      center_phone_2: data.centerPhone2 ?? null,
      center_address: data.centerAddress ?? null,
      currency: data.currency ?? 'EGP',
      currency_symbol: data.currencySymbol ?? 'ج.م',
      academic_year: data.academicYear ?? null,
      updated_at: new Date(),
    } as any))
    .returningAll().executeTakeFirstOrThrow();
    return this.toEntity(row);
  }

  async save(tenantId: string, settings: CenterSettingsEntity): Promise<void> {
    const db = await this.kysely.getTenantDb(tenantId);
    await db.updateTable('center_settings').set({
      center_name: settings.centerName,
      center_logo_url: settings.centerLogoUrl,
      center_phone: settings.centerPhone,
      center_phone_2: settings.centerPhone2,
      center_address: settings.centerAddress,
      currency: settings.currency,
      currency_symbol: settings.currencySymbol,
      academic_year: settings.academicYear,
      updated_at: new Date(),
    } as any)
    .where('id', '=', sql<string>`${settings.id}::uuid`)
    .execute();
  }

  private toEntity(row: any): CenterSettingsEntity {
    return new CenterSettingsEntity(
      row.id, row.center_name, row.center_logo_url,
      row.center_phone, row.center_phone_2, row.center_address,
      row.currency, row.currency_symbol,
      row.academic_year, row.created_at, row.updated_at,
    );
  }
}

@Injectable()
export class ModuleSettingsRepository {
  constructor(private readonly kysely: KyselyService) {}

  async get(tenantId: string, key: string): Promise<string | null> {
    const db = await this.kysely.getTenantDb(tenantId);
    const row = await db.selectFrom('tenant_settings').selectAll()
      .where('key', '=', key)
      .executeTakeFirst();
    return row?.value ?? null;
  }

  async set(tenantId: string, key: string, value: string): Promise<void> {
    const db = await this.kysely.getTenantDb(tenantId);
    await db.insertInto('tenant_settings').values({
      key, value, updated_at: new Date(),
    } as any)
    .onConflict((oc) => oc.column('key').doUpdateSet({ value, updated_at: new Date() } as any))
    .execute();
  }

  async getMany(tenantId: string, keys: string[]): Promise<Record<string, string>> {
    const db = await this.kysely.getTenantDb(tenantId);
    const rows = await db.selectFrom('tenant_settings').selectAll()
      .where('key', 'in', keys).execute();
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  }

  async setMany(tenantId: string, data: Record<string, string>): Promise<void> {
    for (const [key, value] of Object.entries(data)) {
      await this.set(tenantId, key, value);
    }
  }
}
