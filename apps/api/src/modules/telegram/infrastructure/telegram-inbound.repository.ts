import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { KyselyService } from '../../../shared/infrastructure/database/kysely.service';
import { TelegramInboundMessageEntity } from '../domain/entities/telegram-inbound-message.entity';

// مرآة لـ WaInboundRepository — بجدول telegram_inbound_messages المستقل.
// entity_type/entity_id بيتملوا فورًا وقت الإنشاء (راجع الكيان نفسه لتفاصيل السبب).
@Injectable()
export class TelegramInboundRepository {
  constructor(private readonly kysely: KyselyService) {}

  async create(data: {
    tenantId: string; chatId: string; body: string;
    entityType: string | null; entityId: string | null;
  }): Promise<TelegramInboundMessageEntity> {
    const db = this.kysely.getTenantDb(data.tenantId);
    const row = await db.insertInto('telegram_inbound_messages').values({
      tenant_id: sql`${data.tenantId}::uuid`,
      chat_id: data.chatId,
      body: data.body,
      entity_type: data.entityType,
      entity_id: data.entityId ? sql`${data.entityId}::uuid` : null,
      is_read: false,
      received_at: new Date(),
    } as any).returningAll().executeTakeFirstOrThrow();
    return this.toEntity(row);
  }

  async save(msg: TelegramInboundMessageEntity): Promise<void> {
    const db = this.kysely.getTenantDb(msg.tenantId);
    await db.updateTable('telegram_inbound_messages').set({
      is_read: msg.isRead,
    } as any)
    .where('id', '=', sql<string>`${msg.id}::uuid`)
    .execute();
  }

  async findById(tenantId: string, id: string): Promise<TelegramInboundMessageEntity | null> {
    const db = this.kysely.getTenantDb(tenantId);
    const row = await db.selectFrom('telegram_inbound_messages').selectAll()
      .where('tenant_id', '=', sql<string>`${tenantId}::uuid`)
      .where('id', '=', sql<string>`${id}::uuid`)
      .executeTakeFirst();
    return row ? this.toEntity(row) : null;
  }

  async findByTenantId(tenantId: string, opts?: {
    unreadOnly?: boolean; entityId?: string; limit?: number; offset?: number;
  }): Promise<{ data: (TelegramInboundMessageEntity & { entityName: string | null })[]; total: number }> {
    const db = this.kysely.getTenantDb(tenantId);
    let query = db.selectFrom('telegram_inbound_messages').selectAll()
      .where('tenant_id', '=', sql<string>`${tenantId}::uuid`)
      .orderBy('received_at', 'desc');
    if (opts?.unreadOnly) query = query.where('is_read', '=', false) as any;
    if (opts?.entityId) query = query.where('entity_id', '=', sql<string>`${opts.entityId}::uuid`) as any;

    let countQuery = db.selectFrom('telegram_inbound_messages')
      .select(db.fn.count('id').as('total'))
      .where('tenant_id', '=', sql<string>`${tenantId}::uuid`);
    if (opts?.unreadOnly) countQuery = countQuery.where('is_read', '=', false) as any;
    if (opts?.entityId) countQuery = countQuery.where('entity_id', '=', sql<string>`${opts.entityId}::uuid`) as any;

    const [countRow, rows] = await Promise.all([
      countQuery.executeTakeFirst(),
      query.limit(opts?.limit ?? 20).offset(opts?.offset ?? 0).execute(),
    ]);

    // إثراء الاسم عن طريق استعلام دفعي واحد على جدول students — من غير ما موديول
    // التيليجرام يستورد StudentsModule (ده كان هيعمل دائرية: StudentsModule
    // نفسه بيستورد TelegramModule أصلاً). استعلام SQL مباشر عبر KyselyService
    // بس، بدون أي تبعية DI بين الموديولين.
    const studentIds = [...new Set(
      rows.filter((r) => r.entity_type === 'student' && r.entity_id).map((r) => r.entity_id as string),
    )];
    const namesById = new Map<string, string>();
    if (studentIds.length > 0) {
      const students = await db.selectFrom('students')
        .select(['id', 'full_name'])
        .where('id', 'in', studentIds)
        .execute();
      for (const s of students) namesById.set(s.id as string, s.full_name as string);
    }

    const data = rows.map((row) => Object.assign(
      this.toEntity(row),
      { entityName: row.entity_id ? namesById.get(row.entity_id as string) ?? null : null },
    ));
    return { data, total: Number(countRow?.total ?? 0) };
  }

  private toEntity(row: any): TelegramInboundMessageEntity {
    return new TelegramInboundMessageEntity(
      row.id, row.tenant_id, row.chat_id, row.body,
      row.entity_type, row.entity_id, row.is_read, row.received_at, row.created_at,
    );
  }
}
