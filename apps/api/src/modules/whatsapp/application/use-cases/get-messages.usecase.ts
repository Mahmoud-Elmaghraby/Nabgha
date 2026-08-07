import { Inject, Injectable } from '@nestjs/common';
import { IWaMessageRepository, WA_MESSAGE_REPOSITORY } from '../../domain/repositories/wa.repository.interface';
import { KyselyService } from '../../../../shared/infrastructure/database/kysely.service';
import { sql } from 'kysely';

@Injectable()
export class GetMessagesUseCase {
  constructor(
    @Inject(WA_MESSAGE_REPOSITORY) private readonly messageRepo: IWaMessageRepository,
    private readonly kysely: KyselyService,
  ) {}

  async execute(tenantId: string, params: { page: number; limit: number; status?: string; search?: string }) {
    const db = this.kysely.getTenantDb(tenantId);
    const { page, limit, status, search } = params;
    const offset = (page - 1) * limit;

    // Use DISTINCT ON to avoid duplicate rows from joining both student_phone and parent_phone
    let query = db
      .selectFrom('wa_messages_log as m')
      .leftJoin('students as s', (join) =>
        join.on((eb) =>
          eb.or([
            eb('s.student_phone', '=', eb.ref('m.phone')),
            eb('s.parent_phone', '=', eb.ref('m.phone')),
          ]),
        ).on('s.deleted_at', 'is', null),
      )
      .select([
        'm.id',
        'm.phone',
        'm.template_key',
        'm.body',
        'm.status',
        'm.error_message',
        'm.sent_at',
        'm.created_at',
        sql<string>`MAX(s.full_name)`.as('student_name'),
        sql<string>`MAX(s.student_code)`.as('student_code'),
      ])
      .where('m.tenant_id', '=', sql<string>`${tenantId}::uuid`)
      .groupBy([
        'm.id', 'm.phone', 'm.template_key', 'm.body',
        'm.status', 'm.error_message', 'm.sent_at', 'm.created_at',
        'm.tenant_id', 'm.bulk_job_id',
      ]);

    if (status) {
      query = query.where('m.status', '=', status) as any;
    }

    if (search) {
      const term = `%${search}%`;
      query = query.having((eb) =>
        eb.or([
          eb('m.phone', 'ilike', term),
          eb(sql<string>`MAX(s.full_name)`, 'ilike', term),
        ]),
      ) as any;
    }

    // Total count — simpler query without GROUP BY / HAVING overhead
    let countQuery = db
      .selectFrom('wa_messages_log as m')
      .leftJoin('students as s', (join) =>
        join.on((eb) =>
          eb.or([
            eb('s.student_phone', '=', eb.ref('m.phone')),
            eb('s.parent_phone', '=', eb.ref('m.phone')),
          ]),
        ).on('s.deleted_at', 'is', null),
      )
      .select(sql<string>`COUNT(DISTINCT m.id)`.as('count'))
      .where('m.tenant_id', '=', sql<string>`${tenantId}::uuid`) as any;

    if (status) {
      countQuery = countQuery.where('m.status', '=', status);
    }

    if (search) {
      const term = `%${search}%`;
      countQuery = countQuery.where((eb: any) =>
        eb.or([
          eb('m.phone', 'ilike', term),
          eb('s.full_name', 'ilike', term),
        ]),
      );
    }

    const countRow = await countQuery.executeTakeFirst();
    const total = Number(countRow?.count || 0);


    const rows = await query
      .orderBy('m.created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .execute();

    return {
      data: rows.map((r: any) => ({
        id: r.id,
        phone: r.phone,
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
