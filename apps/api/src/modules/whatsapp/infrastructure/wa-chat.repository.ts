import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { KyselyService } from '../../../shared/infrastructure/database/kysely.service';
import { phoneVariants } from '../../../shared/utils/phone.util';

export interface ChatMessageRow {
  id: string;
  phone: string;
  direction: 'in' | 'out';
  source: 'parent' | 'app' | 'phone';
  body: string;
  media_type: string | null;
  media_path: string | null;
  media_mime: string | null;
  media_seconds: number | null;
  media_size: number | null;
  media_status: string | null;
  wa_message_id: string | null;
  status: 'pending' | 'sent' | 'failed';
  error_message: string | null;
  sent_by: string | null;
  is_read: boolean;
  created_at: Date;
}

export interface NewChatMessage {
  phone: string;
  direction: 'in' | 'out';
  source: 'parent' | 'app' | 'phone';
  body: string;
  mediaType?: string | null;
  mediaPath?: string | null;
  mediaMime?: string | null;
  mediaSeconds?: number | null;
  mediaSize?: number | null;
  mediaStatus?: string | null;
  waMessageId?: string | null;
  status?: 'pending' | 'sent' | 'failed';
  sentBy?: string | null;
  isRead: boolean;
  createdAt?: Date;
}

export interface ConversationRow {
  phone: string;
  lastAt: Date;
  lastDirection: 'in' | 'out';
  lastBody: string;
  lastMediaType: string | null;
  unread: number;
}

export interface StudentContact {
  id: string;
  fullName: string;
  studentCode: string | null;
  isActive: boolean;
  parentPhone: string;
  studentPhone: string | null;
}

/** صندوق وارد الواتساب (WA-110) — جدول wa_chat_messages + الإشعارات من wa_messages_log */
@Injectable()
export class WaChatRepository {
  constructor(private readonly kysely: KyselyService) {}

  private db(tenantId: string) {
    return this.kysely.getTenantDb(tenantId);
  }

  /** بيرجّع null لو الرسالة متسجلة قبل كده (نفس wa_message_id) */
  async insert(tenantId: string, m: NewChatMessage): Promise<ChatMessageRow | null> {
    const row = await this.db(tenantId).insertInto('wa_chat_messages').values({
      phone: m.phone,
      direction: m.direction,
      source: m.source,
      body: m.body,
      media_type: m.mediaType ?? null,
      media_path: m.mediaPath ?? null,
      media_mime: m.mediaMime ?? null,
      media_seconds: m.mediaSeconds ?? null,
      media_size: m.mediaSize ?? null,
      media_status: m.mediaStatus ?? null,
      wa_message_id: m.waMessageId ?? null,
      status: m.status ?? 'sent',
      sent_by: m.sentBy ?? null,
      is_read: m.isRead,
      ...(m.createdAt ? { created_at: m.createdAt } : {}),
    } as any)
      .onConflict((oc) => oc.column('wa_message_id').where('wa_message_id', 'is not', null).doNothing())
      .returningAll()
      .executeTakeFirst();
    return (row as any) ?? null;
  }

  async findById(tenantId: string, id: string): Promise<ChatMessageRow | null> {
    const row = await this.db(tenantId).selectFrom('wa_chat_messages').selectAll()
      .where('id', '=', sql<string>`${id}::uuid`).executeTakeFirst();
    return (row as any) ?? null;
  }

  async markSent(tenantId: string, id: string, waMessageId: string | null): Promise<void> {
    await this.db(tenantId).updateTable('wa_chat_messages')
      .set({ status: 'sent', wa_message_id: waMessageId, error_message: null } as any)
      .where('id', '=', sql<string>`${id}::uuid`).execute();
  }

  async markFailed(tenantId: string, id: string, error: string): Promise<void> {
    await this.db(tenantId).updateTable('wa_chat_messages')
      .set({ status: 'failed', error_message: error.slice(0, 300) } as any)
      .where('id', '=', sql<string>`${id}::uuid`).execute();
  }

  async markPending(tenantId: string, id: string): Promise<void> {
    await this.db(tenantId).updateTable('wa_chat_messages')
      .set({ status: 'pending', error_message: null } as any)
      .where('id', '=', sql<string>`${id}::uuid`).execute();
  }

  /** آخر رسالة + عدد غير المقروء لكل رقم، الأحدث الأول */
  async listConversations(tenantId: string, max = 2000): Promise<ConversationRow[]> {
    const rows = await this.db(tenantId)
      .with('last_msg', (qb) => qb.selectFrom('wa_chat_messages')
        .distinctOn('phone')
        .select(['phone', 'direction', 'body', 'media_type', 'created_at'])
        .orderBy('phone').orderBy('created_at', 'desc'))
      .with('unread', (qb) => qb.selectFrom('wa_chat_messages')
        .select(['phone', (eb) => eb.fn.countAll<string>().as('c')])
        .where('direction', '=', 'in').where('is_read', '=', false)
        .groupBy('phone'))
      .selectFrom('last_msg')
      .leftJoin('unread', 'unread.phone', 'last_msg.phone')
      .select([
        'last_msg.phone as phone', 'last_msg.direction as direction', 'last_msg.body as body',
        'last_msg.media_type as media_type', 'last_msg.created_at as created_at', 'unread.c as c',
      ])
      .orderBy('last_msg.created_at', 'desc')
      .limit(max)
      .execute();
    return rows.map((r: any) => ({
      phone: r.phone,
      lastAt: r.created_at,
      lastDirection: r.direction,
      lastBody: r.body,
      lastMediaType: r.media_type,
      unread: Number(r.c ?? 0),
    }));
  }

  async unreadTotals(tenantId: string): Promise<{ messages: number; conversations: number }> {
    const row = await this.db(tenantId).selectFrom('wa_chat_messages')
      .select([
        (eb) => eb.fn.countAll<string>().as('messages'),
        (eb) => eb.fn.count<string>('phone').distinct().as('conversations'),
      ])
      .where('direction', '=', 'in').where('is_read', '=', false)
      .executeTakeFirst();
    return { messages: Number(row?.messages ?? 0), conversations: Number(row?.conversations ?? 0) };
  }

  /** رسايل المحادثة (الأحدث الأول) — before للتحميل لورا */
  async listMessages(tenantId: string, phone: string, limit: number, before?: Date): Promise<ChatMessageRow[]> {
    let q = this.db(tenantId).selectFrom('wa_chat_messages').selectAll()
      .where('phone', '=', phone);
    if (before) q = q.where('created_at', '<', before);
    return (await q.orderBy('created_at', 'desc').limit(limit).execute()) as any;
  }

  /** الإشعارات التلقائية اللي اتبعتت للرقم ده (بكل صيغه المتخزنة) — بتتعرض جوّه المحادثة */
  async listNotifications(tenantId: string, phone: string, limit: number, before?: Date, after?: Date) {
    let q = this.db(tenantId).selectFrom('wa_messages_log')
      .select(['id', 'template_key', 'body', 'status', 'sent_at', 'created_at'])
      .where('phone', 'in', phoneVariants(phone));
    if (before) q = q.where('created_at', '<', before);
    if (after) q = q.where('created_at', '>=', after);
    return q.orderBy('created_at', 'desc').limit(limit).execute();
  }

  async markConversationRead(tenantId: string, phone: string): Promise<number> {
    const res = await this.db(tenantId).updateTable('wa_chat_messages')
      .set({ is_read: true } as any)
      .where('phone', '=', phone).where('direction', '=', 'in').where('is_read', '=', false)
      .executeTakeFirst();
    return Number(res.numUpdatedRows ?? 0);
  }

  /** كل الطلاب (مش المحذوفين) بأرقامهم — الربط بالمحادثات بيتعمل في الذاكرة بالرقم الموحّد */
  async listStudentContacts(tenantId: string): Promise<StudentContact[]> {
    const rows = await this.db(tenantId).selectFrom('students')
      .select(['id', 'full_name', 'student_code', 'is_active', 'parent_phone', 'student_phone'])
      .where('deleted_at', 'is', null)
      .execute();
    return rows.map((r: any) => ({
      id: r.id, fullName: r.full_name, studentCode: r.student_code, isActive: r.is_active,
      parentPhone: r.parent_phone, studentPhone: r.student_phone,
    }));
  }
}
