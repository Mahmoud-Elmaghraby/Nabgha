import { Injectable } from '@nestjs/common';
import { KyselyService } from '../../../shared/infrastructure/database/kysely.service';
import { sql } from 'kysely';
import { WaSessionEntity, WaSessionStatus } from '../domain/entities/wa-session.entity';
import { WaSettingsEntity } from '../domain/entities/wa-settings.entity';
import { WaTemplateEntity, WaTemplateKey, WA_DEFAULT_TEMPLATES } from '../domain/entities/wa-template.entity';
import { WaMessageEntity, WaMessageStatus } from '../domain/entities/wa-message.entity';
import { WaBulkJobEntity, WaBulkJobStatus } from '../domain/entities/wa-bulk-job.entity';
import { WaInboundMessageEntity } from '../domain/entities/wa-inbound-message.entity';
import type {
  IWaSessionRepository,
  IWaSettingsRepository,
  IWaTemplateRepository,
  IWaMessageRepository,
  IWaBulkJobRepository,
  IWaInboundRepository,
} from '../domain/repositories/wa.repository.interface';

@Injectable()
export class WaSessionRepository implements IWaSessionRepository {
  constructor(private readonly kysely: KyselyService) {}

  async findByTenantId(tenantId: string): Promise<WaSessionEntity | null> {
    const db = this.kysely.getTenantDb(tenantId);
    const row = await db.selectFrom('wa_sessions').selectAll()
      .where('tenant_id', '=', sql<string>`${tenantId}::uuid`)
      .limit(1).executeTakeFirst();
    if (!row) return null;
    return this.toEntity(row);
  }

  async upsert(tenantId: string, data: Partial<WaSessionEntity>): Promise<WaSessionEntity> {
    const db = this.kysely.getTenantDb(tenantId);
    const row = await db.insertInto('wa_sessions').values({
      tenant_id: sql`${tenantId}::uuid`,
      phone: data.phone ?? null,
      status: (data.status ?? 'disconnected') as string,
      qr_code: data.qrCode ?? null,
      qr_expires_at: data.qrExpiresAt ?? null,
      connected_at: data.connectedAt ?? null,
      warmup_started_at: data.warmupStartedAt ?? null,
      warmup_day: data.warmupDay ?? 0,
      is_banned: data.isBanned ?? false,
      banned_until: data.bannedUntil ?? null,
      last_health_check: data.lastHealthCheck ?? null,
      updated_at: new Date(),
    } as any)
    .onConflict((oc) => oc.column('tenant_id').doUpdateSet({
      phone: data.phone ?? null,
      status: (data.status ?? 'disconnected') as string,
      updated_at: new Date(),
    } as any))
    .returningAll().executeTakeFirstOrThrow();
    return this.toEntity(row);
  }

  async save(session: WaSessionEntity): Promise<void> {
    const db = this.kysely.getTenantDb(session.tenantId);
    await db.updateTable('wa_sessions').set({
      phone: session.phone,
      status: session.status as string,
      qr_code: session.qrCode,
      qr_expires_at: session.qrExpiresAt,
      connected_at: session.connectedAt,
      warmup_started_at: session.warmupStartedAt,
      warmup_day: session.warmupDay,
      is_banned: session.isBanned,
      banned_until: session.bannedUntil,
      last_health_check: session.lastHealthCheck,
      updated_at: new Date(),
    } as any)
    .where('id', '=', sql<string>`${session.id}::uuid`)
    .execute();
  }

  private toEntity(row: any): WaSessionEntity {
    return new WaSessionEntity(
      row.id, row.tenant_id, row.phone, row.status as WaSessionStatus,
      row.qr_code, row.qr_expires_at, row.connected_at,
      row.warmup_started_at, row.warmup_day, row.is_banned,
      row.banned_until, row.last_health_check, row.created_at, row.updated_at,
    );
  }
}

@Injectable()
export class WaSettingsRepository implements IWaSettingsRepository {
  constructor(private readonly kysely: KyselyService) {}

  async findByTenantId(tenantId: string): Promise<WaSettingsEntity | null> {
    const db = this.kysely.getTenantDb(tenantId);
    const row = await db.selectFrom('wa_settings').selectAll()
      .where('tenant_id', '=', sql<string>`${tenantId}::uuid`)
      .limit(1).executeTakeFirst();
    if (!row) return null;
    return this.toEntity(row);
  }

  async upsert(tenantId: string, data: Partial<WaSettingsEntity>): Promise<WaSettingsEntity> {
    const db = this.kysely.getTenantDb(tenantId);
    const row = await db.insertInto('wa_settings').values({
      tenant_id: sql`${tenantId}::uuid`,
      wa_enabled: data.waEnabled ?? false,
      send_hours_from: data.sendHoursFrom ?? '08:00',
      send_hours_to: data.sendHoursTo ?? '22:00',
      daily_limit: data.dailyLimit ?? 50,
      delay_min_seconds: data.delayMinSeconds ?? 3,
      delay_max_seconds: data.delayMaxSeconds ?? 8,
      warmup_enabled: data.warmupEnabled ?? true,
      notify_absent: data.notifyAbsent ?? true,
      notify_present: data.notifyPresent ?? false,
      notify_late: data.notifyLate ?? true,
      notify_3_absences: data.notify3Absences ?? true,
      late_threshold_min: data.lateThresholdMin ?? 15,
      notify_payment_confirm: data.notifyPaymentConfirm ?? true,
      notify_payment_due_7d: data.notifyPaymentDue7d ?? true,
      notify_payment_due_1d: data.notifyPaymentDue1d ?? true,
      notify_payment_overdue: data.notifyPaymentOverdue ?? true,
      notify_new_student: data.notifyNewStudent ?? true,
      notify_group_added: data.notifyGroupAdded ?? true,
      notify_group_removed: data.notifyGroupRemoved ?? false,
      notify_student_card: data.notifyStudentCard ?? false,
      updated_at: new Date(),
    } as any)
    .onConflict((oc) => oc.column('tenant_id').doUpdateSet({ updated_at: new Date() } as any))
    .returningAll().executeTakeFirstOrThrow();
    return this.toEntity(row);
  }

  async save(settings: WaSettingsEntity): Promise<void> {
    const db = this.kysely.getTenantDb(settings.tenantId);
    await db.updateTable('wa_settings').set({
      wa_enabled: settings.waEnabled,
      send_hours_from: settings.sendHoursFrom,
      send_hours_to: settings.sendHoursTo,
      daily_limit: settings.dailyLimit,
      delay_min_seconds: settings.delayMinSeconds,
      delay_max_seconds: settings.delayMaxSeconds,
      warmup_enabled: settings.warmupEnabled,
      notify_absent: settings.notifyAbsent,
      notify_present: settings.notifyPresent,
      notify_late: settings.notifyLate,
      notify_3_absences: settings.notify3Absences,
      late_threshold_min: settings.lateThresholdMin,
      notify_payment_confirm: settings.notifyPaymentConfirm,
      notify_payment_due_7d: settings.notifyPaymentDue7d,
      notify_payment_due_1d: settings.notifyPaymentDue1d,
      notify_payment_overdue: settings.notifyPaymentOverdue,
      notify_new_student: settings.notifyNewStudent,
      notify_group_added: settings.notifyGroupAdded,
      notify_group_removed: settings.notifyGroupRemoved,
      notify_student_card: settings.notifyStudentCard,
      updated_at: new Date(),
    } as any)
    .where('id', '=', sql<string>`${settings.id}::uuid`)
    .execute();
  }

  private toEntity(row: any): WaSettingsEntity {
    return new WaSettingsEntity(
      row.id, row.tenant_id, row.wa_enabled, row.send_hours_from,
      row.send_hours_to, row.daily_limit, row.delay_min_seconds,
      row.delay_max_seconds, row.warmup_enabled, row.notify_absent,
      row.notify_present, row.notify_late, row.notify_3_absences,
      row.late_threshold_min, row.notify_payment_confirm,
      row.notify_payment_due_7d, row.notify_payment_due_1d,
      row.notify_payment_overdue, row.notify_new_student,
      row.notify_group_added, row.notify_group_removed, row.notify_student_card,
      row.created_at, row.updated_at,
    );
  }
}

@Injectable()
export class WaTemplateRepository implements IWaTemplateRepository {
  constructor(private readonly kysely: KyselyService) {}

  async findAllByTenantId(tenantId: string): Promise<WaTemplateEntity[]> {
    const db = this.kysely.getTenantDb(tenantId);
    const rows = await db.selectFrom('wa_templates').selectAll()
      .where('tenant_id', '=', sql<string>`${tenantId}::uuid`)
      .execute();
    return rows.map(this.toEntity);
  }

  async findByKey(tenantId: string, key: WaTemplateKey): Promise<WaTemplateEntity | null> {
    const db = this.kysely.getTenantDb(tenantId);
    const row = await db.selectFrom('wa_templates').selectAll()
      .where('tenant_id', '=', sql<string>`${tenantId}::uuid`)
      .where('key', '=', key)
      .limit(1).executeTakeFirst();
    if (!row) return null;
    return this.toEntity(row);
  }

  async upsert(tenantId: string, key: WaTemplateKey, body: string): Promise<WaTemplateEntity> {
    const db = this.kysely.getTenantDb(tenantId);
    const isDefault = body === WA_DEFAULT_TEMPLATES[key];
    const row = await db.insertInto('wa_templates').values({
      tenant_id: sql`${tenantId}::uuid`,
      key, body, is_default: isDefault, updated_at: new Date(),
    } as any)
    .onConflict((oc) => oc.columns(['tenant_id', 'key']).doUpdateSet({ body, is_default: isDefault, updated_at: new Date() } as any))
    .returningAll().executeTakeFirstOrThrow();
    return this.toEntity(row);
  }

  async save(template: WaTemplateEntity): Promise<void> {
    const db = this.kysely.getTenantDb(template.tenantId);
    await db.updateTable('wa_templates').set({
      body: template.body, is_default: template.isDefault, updated_at: new Date(),
    } as any)
    .where('id', '=', sql<string>`${template.id}::uuid`)
    .execute();
  }

  private toEntity(row: any): WaTemplateEntity {
    return new WaTemplateEntity(
      row.id, row.tenant_id, row.key as WaTemplateKey,
      row.body, row.is_default, row.created_at, row.updated_at,
    );
  }
}

@Injectable()
export class WaMessageRepository implements IWaMessageRepository {
  constructor(private readonly kysely: KyselyService) {}

  async create(data: any): Promise<WaMessageEntity> {
    const db = this.kysely.getTenantDb(data.tenantId);
    const row = await db.insertInto('wa_messages_log').values({
      tenant_id: sql`${data.tenantId}::uuid`,
      phone: data.phone,
      template_key: data.templateKey ?? null,
      body: data.body,
      status: 'pending',
      bulk_job_id: data.bulkJobId ? sql`${data.bulkJobId}::uuid` : null,
    } as any).returningAll().executeTakeFirstOrThrow();
    return this.toEntity(row);
  }

  async save(message: WaMessageEntity): Promise<void> {
    const db = this.kysely.getTenantDb(message.tenantId);
    await db.updateTable('wa_messages_log').set({
      status: message.status, error_message: message.errorMessage,
      sent_at: message.sentAt, delivered_at: message.deliveredAt,
    } as any)
    .where('id', '=', sql<string>`${message.id}::uuid`)
    .execute();
  }

  async findById(tenantId: string, id: string): Promise<WaMessageEntity | null> {
    const db = this.kysely.getTenantDb(tenantId);
    const row = await db.selectFrom('wa_messages_log').selectAll()
      .where('id', '=', sql<string>`${id}::uuid`)
      .limit(1).executeTakeFirst();
    return row ? this.toEntity(row) : null;
  }

  async findByTenantId(tenantId: string, opts?: { status?: WaMessageStatus; limit?: number; offset?: number }) {
    const db = this.kysely.getTenantDb(tenantId);
    let query = db.selectFrom('wa_messages_log').selectAll()
      .where('tenant_id', '=', sql<string>`${tenantId}::uuid`)
      .orderBy('created_at', 'desc');
    if (opts?.status) query = query.where('status', '=', opts.status) as any;
    const countRow = await db.selectFrom('wa_messages_log')
      .select(db.fn.count('id').as('total'))
      .where('tenant_id', '=', sql<string>`${tenantId}::uuid`)
      .executeTakeFirst();
    const data = await query.limit(opts?.limit ?? 20).offset(opts?.offset ?? 0).execute();
    return { data: data.map(this.toEntity), total: Number(countRow?.total ?? 0) };
  }

  async countTodayByTenantId(tenantId: string): Promise<number> {
    const db = this.kysely.getTenantDb(tenantId);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const row = await db.selectFrom('wa_messages_log')
      .select(db.fn.count('id').as('total'))
      .where('tenant_id', '=', sql<string>`${tenantId}::uuid`)
      .where('created_at', '>=', today)
      .where('status', '!=', 'failed')
      .executeTakeFirst();
    return Number(row?.total ?? 0);
  }

  private toEntity(row: any): WaMessageEntity {
    return new WaMessageEntity(
      row.id, row.tenant_id, row.phone, row.template_key,
      row.body, row.status as WaMessageStatus, row.error_message,
      row.sent_at, row.delivered_at, row.bulk_job_id, row.created_at,
    );
  }
}

@Injectable()
export class WaBulkJobRepository implements IWaBulkJobRepository {
  constructor(private readonly kysely: KyselyService) {}

  async create(data: any): Promise<WaBulkJobEntity> {
    const db = this.kysely.getTenantDb(data.tenantId);
    const row = await db.insertInto('wa_bulk_jobs').values({
      tenant_id: sql`${data.tenantId}::uuid`,
      title: data.title, body: data.body,
      status: 'pending', total: data.total,
      sent: 0, failed: 0, queued: data.total,
      created_by: sql`${data.createdBy}::uuid`,
      scheduled_at: data.scheduledAt ?? null,
    } as any).returningAll().executeTakeFirstOrThrow();
    return this.toEntity(row);
  }

  async save(job: WaBulkJobEntity): Promise<void> {
    const db = this.kysely.getTenantDb(job.tenantId);
    await db.updateTable('wa_bulk_jobs').set({
      status: job.status, sent: job.sent, failed: job.failed,
      queued: job.queued, started_at: job.startedAt,
      completed_at: job.completedAt, cancelled_at: job.cancelledAt,
      updated_at: new Date(),
    } as any)
    .where('id', '=', sql<string>`${job.id}::uuid`)
    .execute();
  }

  async findById(tenantId: string, id: string): Promise<WaBulkJobEntity | null> {
    const db = this.kysely.getTenantDb(tenantId);
    const row = await db.selectFrom('wa_bulk_jobs').selectAll()
      .where('id', '=', sql<string>`${id}::uuid`)
      .limit(1).executeTakeFirst();
    return row ? this.toEntity(row) : null;
  }

  async findByTenantId(tenantId: string, limit = 20): Promise<WaBulkJobEntity[]> {
    const db = this.kysely.getTenantDb(tenantId);
    const rows = await db.selectFrom('wa_bulk_jobs').selectAll()
      .where('tenant_id', '=', sql<string>`${tenantId}::uuid`)
      .orderBy('created_at', 'desc').limit(limit).execute();
    return rows.map(this.toEntity);
  }

  private toEntity(row: any): WaBulkJobEntity {
    return new WaBulkJobEntity(
      row.id, row.tenant_id, row.title, row.body,
      row.status as WaBulkJobStatus, row.total, row.sent,
      row.failed, row.queued, row.created_by, row.scheduled_at,
      row.started_at, row.completed_at, row.cancelled_at, row.created_at, row.updated_at,
    );
  }
}

@Injectable()
export class WaInboundRepository implements IWaInboundRepository {
  constructor(private readonly kysely: KyselyService) {}

  async create(data: any): Promise<WaInboundMessageEntity> {
    const db = this.kysely.getTenantDb(data.tenantId);
    const row = await db.insertInto('wa_inbound_messages').values({
      tenant_id: sql`${data.tenantId}::uuid`,
      phone: data.phone, body: data.body,
      student_id: data.studentId ?? null,
      is_read: false, received_at: new Date(),
    } as any).returningAll().executeTakeFirstOrThrow();
    return this.toEntity(row);
  }

  async save(msg: WaInboundMessageEntity): Promise<void> {
    const db = this.kysely.getTenantDb(msg.tenantId);
    await db.updateTable('wa_inbound_messages').set({
      is_read: msg.isRead,
      student_id: msg.studentId ?? null,
    } as any)
    .where('id', '=', sql<string>`${msg.id}::uuid`)
    .execute();
  }

  async findByTenantId(tenantId: string, opts?: any) {
    const db = this.kysely.getTenantDb(tenantId);
    let query = db.selectFrom('wa_inbound_messages').selectAll()
      .where('tenant_id', '=', sql<string>`${tenantId}::uuid`)
      .orderBy('received_at', 'desc');
    if (opts?.unreadOnly) query = query.where('is_read', '=', false) as any;
    if (opts?.studentId) query = query.where('student_id', '=', opts.studentId) as any;
    const countRow = await db.selectFrom('wa_inbound_messages')
      .select(db.fn.count('id').as('total'))
      .where('tenant_id', '=', sql<string>`${tenantId}::uuid`)
      .executeTakeFirst();
    const data = await query.limit(opts?.limit ?? 20).offset(opts?.offset ?? 0).execute();
    return { data: data.map(this.toEntity), total: Number(countRow?.total ?? 0) };
  }

  async findByPhone(tenantId: string, phone: string): Promise<WaInboundMessageEntity[]> {
    const db = this.kysely.getTenantDb(tenantId);
    const rows = await db.selectFrom('wa_inbound_messages').selectAll()
      .where('tenant_id', '=', sql<string>`${tenantId}::uuid`)
      .where('phone', '=', phone)
      .orderBy('received_at', 'desc').limit(50).execute();
    return rows.map(this.toEntity);
  }

  async findById(tenantId: string, id: string): Promise<WaInboundMessageEntity | null> {
    const db = this.kysely.getTenantDb(tenantId);
    const row = await db.selectFrom('wa_inbound_messages').selectAll()
      .where('tenant_id', '=', sql<string>`${tenantId}::uuid`)
      .where('id', '=', sql<string>`${id}::uuid`)
      .executeTakeFirst();
    return row ? this.toEntity(row) : null;
  }

  private toEntity(row: any): WaInboundMessageEntity {
    return new WaInboundMessageEntity(
      row.id, row.tenant_id, row.phone, row.body,
      row.student_id, row.is_read, row.received_at, row.created_at,
    );
  }
}
