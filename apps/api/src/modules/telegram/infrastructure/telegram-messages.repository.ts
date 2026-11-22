import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { KyselyService } from '../../../shared/infrastructure/database/kysely.service';
import { TelegramMessageEntity } from '../domain/entities/telegram-message.entity';

// مرآة مبسّطة لـ WaMessageRepository — سجل رسايل تليجرام الصادرة، للتتبع والتاريخ.
@Injectable()
export class TelegramMessagesRepository {
  constructor(private readonly kysely: KyselyService) {}

  async create(data: {
    tenantId: string; chatId: string; entityType: string; entityId: string;
    templateKey: string | null; body: string;
  }): Promise<TelegramMessageEntity> {
    const db = this.kysely.getTenantDb(data.tenantId);
    const row = await db.insertInto('telegram_messages').values({
      tenant_id: sql`${data.tenantId}::uuid`,
      chat_id: data.chatId,
      entity_type: data.entityType,
      entity_id: sql`${data.entityId}::uuid`,
      template_key: data.templateKey,
      body: data.body,
      status: 'pending',
    } as any).returningAll().executeTakeFirstOrThrow();
    return this.toEntity(row);
  }

  async save(message: TelegramMessageEntity): Promise<void> {
    const db = this.kysely.getTenantDb(message.tenantId);
    await db.updateTable('telegram_messages').set({
      status: message.status,
      error_message: message.errorMessage,
      sent_at: message.sentAt,
    } as any)
    .where('id', '=', sql<string>`${message.id}::uuid`)
    .execute();
  }

  async findByTenantId(tenantId: string, limit = 50): Promise<TelegramMessageEntity[]> {
    const db = this.kysely.getTenantDb(tenantId);
    const rows = await db.selectFrom('telegram_messages').selectAll()
      .where('tenant_id', '=', sql<string>`${tenantId}::uuid`)
      .orderBy('created_at', 'desc').limit(limit).execute();
    return rows.map(this.toEntity);
  }

  private toEntity(row: any): TelegramMessageEntity {
    return new TelegramMessageEntity(
      row.id, row.tenant_id, row.chat_id, row.entity_type, row.entity_id,
      row.template_key, row.body, row.status, row.error_message, row.sent_at, row.created_at,
    );
  }
}
