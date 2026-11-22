import { Injectable } from '@nestjs/common';
import { KyselyService } from '../../../shared/infrastructure/database/kysely.service';

export type TelegramEntityType = 'student';

@Injectable()
export class TelegramLinksRepository {
  constructor(private readonly kysely: KyselyService) {}

  async findChatId(tenantId: string, entityType: TelegramEntityType, entityId: string): Promise<string | null> {
    const db = this.kysely.getTenantDb(tenantId);
    const row = await db
      .selectFrom('telegram_links')
      .select(['chat_id'])
      .where('entity_type', '=', entityType)
      .where('entity_id', '=', entityId as any)
      .executeTakeFirst();
    return row?.chat_id ?? null;
  }

  /** بيرجع Set بالـ entity_id اللي مربوطة بالفعل — استعلام واحد بدل ما نسأل عن كل طالب لوحده */
  async findLinkedEntityIds(tenantId: string, entityType: TelegramEntityType, entityIds: string[]): Promise<Set<string>> {
    if (entityIds.length === 0) return new Set();
    const db = this.kysely.getTenantDb(tenantId);
    const rows = await db
      .selectFrom('telegram_links')
      .select(['entity_id'])
      .where('entity_type', '=', entityType)
      .where('entity_id', 'in', entityIds as any)
      .execute();
    return new Set(rows.map((r) => r.entity_id as string));
  }

  /** بيرجع تفاصيل الربط الكاملة (chat_id + تاريخ الربط) لمجموعة entities دفعة
   * واحدة — عكس findLinkedEntityIds اللي بترجع Set من الـ IDs بس من غير تفاصيل.
   * مستخدمة في شاشة "حالة الربط" عشان نعرض تاريخ ربط كل طالب، مش بس هل هو
   * مربوط ولا لأ. */
  async findLinksForEntities(
    tenantId: string,
    entityType: TelegramEntityType,
    entityIds: string[],
  ): Promise<Map<string, { chatId: string; linkedAt: Date }>> {
    if (entityIds.length === 0) return new Map();
    const db = this.kysely.getTenantDb(tenantId);
    const rows = await db
      .selectFrom('telegram_links')
      .select(['entity_id', 'chat_id', 'linked_at'])
      .where('entity_type', '=', entityType)
      .where('entity_id', 'in', entityIds as any)
      .execute();
    const map = new Map<string, { chatId: string; linkedAt: Date }>();
    for (const row of rows) {
      map.set(row.entity_id as string, {
        chatId: row.chat_id as string,
        linkedAt: row.linked_at as Date,
      });
    }
    return map;
  }

  /** الاتجاه العكسي عن findChatId — مطلوبة لما رسالة توصل من ولي الأمر (chat_id)
   * ونحتاج نعرف هي لأي طالب، من غير ما نلمس أي method موجودة. */
  async findEntityByChatId(tenantId: string, chatId: string): Promise<{ entityType: TelegramEntityType; entityId: string } | null> {
    const db = this.kysely.getTenantDb(tenantId);
    const row = await db
      .selectFrom('telegram_links')
      .select(['entity_type', 'entity_id'])
      .where('chat_id', '=', chatId)
      .executeTakeFirst();
    if (!row) return null;
    return { entityType: row.entity_type as TelegramEntityType, entityId: row.entity_id as string };
  }

  /** upsert — لو الجهة دي كانت مربوطة بشات قديم (مثلاً ولي الأمر عمل Start تاني من موبايل جديد) بيتحدّث */
  async upsertLink(tenantId: string, entityType: TelegramEntityType, entityId: string, chatId: string): Promise<void> {
    const db = this.kysely.getTenantDb(tenantId);
    await db
      .insertInto('telegram_links')
      .values({
        entity_type: entityType,
        entity_id: entityId as any,
        chat_id: chatId,
        linked_at: new Date(),
      } as any)
      .onConflict((oc) =>
        oc.columns(['entity_type', 'entity_id']).doUpdateSet({
          chat_id: chatId,
          linked_at: new Date(),
        } as any),
      )
      .execute();
  }
}
