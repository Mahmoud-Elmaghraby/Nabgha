import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { KyselyService } from '../../../shared/infrastructure/database/kysely.service';
import {
  TelegramTemplateEntity, TelegramTemplateKey, TELEGRAM_DEFAULT_TEMPLATES,
} from '../domain/entities/telegram-template.entity';

// مرآة لـ WaTemplateRepository — نفس النمط بالظبط بس بجدول telegram_templates المستقل.
@Injectable()
export class TelegramTemplatesRepository {
  constructor(private readonly kysely: KyselyService) {}

  // ⚠️ تصليح (Oct 2026): القوالب الافتراضية كانت بتتخزّن في قاعدة بيانات كل عميل مرة واحدة
  // وقت أول تشغيل وبعدين مبتتحدّثش أبدًا، حتى لو النص الافتراضي في الكود اتغيّر — فعملاء كتير
  // فضلوا بنصوص قديمة (فيها كلمة "نبغة" ثابتة وبدون اسم المركز). المنطق هنا: أي قالب لسه
  // معلّم is_default=true (يعني المستخدم عمره ما عدّل عليه) بيتحدّث للنص الافتراضي الحالي.
  // القوالب اللي المستخدم عدّلها (is_default=false) مبتتلمسش. بيتنفّذ مرة واحدة لكل تينانت
  // في كل تشغيل للتطبيق.
  private static readonly syncedTenants = new Set<string>();

  private async refreshStaleDefaults(tenantId: string): Promise<void> {
    const cls = this.constructor as any;
    if (cls.syncedTenants.has(tenantId)) return;
    cls.syncedTenants.add(tenantId);
    try {
      const db = this.kysely.getTenantDb(tenantId);
      for (const [key, body] of Object.entries(TELEGRAM_DEFAULT_TEMPLATES)) {
        await db.updateTable('telegram_templates').set({ body, updated_at: new Date() } as any)
          .where('tenant_id', '=', sql<string>`${tenantId}::uuid`)
          .where('key', '=', key)
          .where('is_default', '=', true)
          .where('body', '<>', body)
          .execute();
      }
    } catch {
      cls.syncedTenants.delete(tenantId); // نحاول تاني المرة الجاية
    }
  }

  async findAllByTenantId(tenantId: string): Promise<TelegramTemplateEntity[]> {
    await this.refreshStaleDefaults(tenantId);
    const db = this.kysely.getTenantDb(tenantId);
    const rows = await db.selectFrom('telegram_templates').selectAll()
      .where('tenant_id', '=', sql<string>`${tenantId}::uuid`)
      .execute();
    return rows.map(this.toEntity);
  }

  async findByKey(tenantId: string, key: TelegramTemplateKey): Promise<TelegramTemplateEntity | null> {
    await this.refreshStaleDefaults(tenantId);
    const db = this.kysely.getTenantDb(tenantId);
    const row = await db.selectFrom('telegram_templates').selectAll()
      .where('tenant_id', '=', sql<string>`${tenantId}::uuid`)
      .where('key', '=', key)
      .limit(1).executeTakeFirst();
    if (!row) return null;
    return this.toEntity(row);
  }

  async upsert(tenantId: string, key: TelegramTemplateKey, body: string): Promise<TelegramTemplateEntity> {
    const db = this.kysely.getTenantDb(tenantId);
    const isDefault = body === TELEGRAM_DEFAULT_TEMPLATES[key];
    const row = await db.insertInto('telegram_templates').values({
      tenant_id: sql`${tenantId}::uuid`,
      key, body, is_default: isDefault, updated_at: new Date(),
    } as any)
    .onConflict((oc) => oc.columns(['tenant_id', 'key']).doUpdateSet({ body, is_default: isDefault, updated_at: new Date() } as any))
    .returningAll().executeTakeFirstOrThrow();
    return this.toEntity(row);
  }

  async save(template: TelegramTemplateEntity): Promise<void> {
    const db = this.kysely.getTenantDb(template.tenantId);
    await db.updateTable('telegram_templates').set({
      body: template.body, is_default: template.isDefault, updated_at: new Date(),
    } as any)
    .where('id', '=', sql<string>`${template.id}::uuid`)
    .execute();
  }

  private toEntity(row: any): TelegramTemplateEntity {
    return new TelegramTemplateEntity(
      row.id, row.tenant_id, row.key as TelegramTemplateKey,
      row.body, row.is_default, row.created_at, row.updated_at,
    );
  }
}
