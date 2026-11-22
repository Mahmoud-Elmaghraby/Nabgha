import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { KyselyService } from '../../../../shared/infrastructure/database/kysely.service';

// مرآة لـ GetMessagesUseCase (whatsapp/application/use-cases/get-messages.usecase.ts)
// — سجل رسايل تليجرام الصادرة، بحث/فلترة/صفحات، بالضبط زي سجل رسايل الواتساب.
// فرق مهم بيسهّل الجوين هنا: telegram_messages.entity_id هو UUID الطالب مباشرة
// (بيتملى وقت الإرسال من telegram_links)، فالجوين بـ id=id مباشر — مفيش حاجة
// زي مطابقة رقم الهاتف المزدوجة (student_phone / parent_phone) المستخدمة في
// نسخة الواتساب.
@Injectable()
export class GetTelegramMessagesUseCase {
  constructor(private readonly kysely: KyselyService) {}

  async execute(
    tenantId: string,
    params: { page: number; limit: number; status?: string; search?: string; from?: string; to?: string },
  ) {
    const db = this.kysely.getTenantDb(tenantId);
    const { page, limit, status, search, from, to } = params;
    const offset = (page - 1) * limit;

    let query = db
      .selectFrom('telegram_messages as m')
      .leftJoin('students as s', (join) =>
        join.onRef('s.id', '=', 'm.entity_id').on('s.deleted_at', 'is', null),
      )
      .select([
        'm.id',
        'm.chat_id',
        'm.template_key',
        'm.body',
        'm.status',
        'm.error_message',
        'm.sent_at',
        'm.created_at',
        's.full_name as student_name',
        's.student_code as student_code',
      ])
      .where('m.tenant_id', '=', sql<string>`${tenantId}::uuid`);

    if (status) {
      query = query.where('m.status', '=', status) as any;
    }
    if (search) {
      const term = `%${search}%`;
      query = query.where((eb) =>
        eb.or([eb('s.full_name', 'ilike', term), eb('s.student_code', 'ilike', term)]),
      ) as any;
    }
    if (from) {
      query = query.where(sql`(m.created_at AT TIME ZONE 'Africa/Cairo')::date`, '>=', sql`${from}::date`) as any;
    }
    if (to) {
      query = query.where(sql`(m.created_at AT TIME ZONE 'Africa/Cairo')::date`, '<=', sql`${to}::date`) as any;
    }

    let countQuery = db
      .selectFrom('telegram_messages as m')
      .leftJoin('students as s', (join) =>
        join.onRef('s.id', '=', 'm.entity_id').on('s.deleted_at', 'is', null),
      )
      .select(sql<string>`COUNT(*)`.as('count'))
      .where('m.tenant_id', '=', sql<string>`${tenantId}::uuid`) as any;

    if (status) countQuery = countQuery.where('m.status', '=', status);
    if (search) {
      const term = `%${search}%`;
      countQuery = countQuery.where((eb: any) =>
        eb.or([eb('s.full_name', 'ilike', term), eb('s.student_code', 'ilike', term)]),
      );
    }
    if (from) countQuery = countQuery.where(sql`(m.created_at AT TIME ZONE 'Africa/Cairo')::date`, '>=', sql`${from}::date`);
    if (to) countQuery = countQuery.where(sql`(m.created_at AT TIME ZONE 'Africa/Cairo')::date`, '<=', sql`${to}::date`);

    const countRow = await countQuery.executeTakeFirst();
    const total = Number(countRow?.count || 0);

    const rows = await query.orderBy('m.created_at', 'desc').limit(limit).offset(offset).execute();

    return {
      data: rows.map((r: any) => ({
        id: r.id,
        chatId: r.chat_id,
        templateKey: r.template_key,
        body: r.body,
        status: r.status,
        errorMessage: r.error_message,
        sentAt: r.sent_at,
        createdAt: r.created_at,
        studentName: r.student_name || null,
        studentCode: r.student_code || null,
      })),
      total,
      page,
      limit,
    };
  }
}
