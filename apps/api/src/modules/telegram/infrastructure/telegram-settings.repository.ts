import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { KyselyService } from '../../../shared/infrastructure/database/kysely.service';
import { TelegramSettingsEntity } from '../domain/entities/telegram-settings.entity';

// مرآة لـ WaSettingsRepository (whatsapp/infrastructure/wa-kysely.repository.ts)
// بس بجدول telegram_settings المستقل.
@Injectable()
export class TelegramSettingsRepository {
  constructor(private readonly kysely: KyselyService) {}

  async findByTenantId(tenantId: string): Promise<TelegramSettingsEntity | null> {
    const db = this.kysely.getTenantDb(tenantId);
    const row = await db.selectFrom('telegram_settings').selectAll()
      .where('tenant_id', '=', sql<string>`${tenantId}::uuid`)
      .limit(1).executeTakeFirst();
    if (!row) return null;
    return this.toEntity(row);
  }

  async upsert(tenantId: string, data: Partial<TelegramSettingsEntity>): Promise<TelegramSettingsEntity> {
    const db = this.kysely.getTenantDb(tenantId);
    const values = {
      telegram_enabled: data.telegramEnabled ?? false,
      send_hours_from: data.sendHoursFrom ?? '08:00',
      send_hours_to: data.sendHoursTo ?? '22:00',
      notify_absent: data.notifyAbsent ?? true,
      notify_present: data.notifyPresent ?? false,
      notify_late: data.notifyLate ?? true,
      notify_3_absences: data.notify3Absences ?? true,
      notify_payment_confirm: data.notifyPaymentConfirm ?? true,
      notify_payment_due_7d: data.notifyPaymentDue7d ?? true,
      notify_payment_due_1d: data.notifyPaymentDue1d ?? true,
      notify_payment_overdue: data.notifyPaymentOverdue ?? true,
      notify_new_student: data.notifyNewStudent ?? true,
      notify_group_added: data.notifyGroupAdded ?? true,
      notify_group_removed: data.notifyGroupRemoved ?? false,
      notify_absence_excused: data.notifyAbsenceExcused ?? true,
      notify_grade_recorded: data.notifyGradeRecorded ?? true,
      updated_at: new Date(),
    };
    const row = await db.insertInto('telegram_settings').values({
      tenant_id: sql`${tenantId}::uuid`,
      ...values,
    } as any)
    .onConflict((oc) => oc.column('tenant_id').doUpdateSet(values as any))
    .returningAll().executeTakeFirstOrThrow();
    return this.toEntity(row);
  }

  async save(settings: TelegramSettingsEntity): Promise<void> {
    const db = this.kysely.getTenantDb(settings.tenantId);
    await db.updateTable('telegram_settings').set({
      telegram_enabled: settings.telegramEnabled,
      send_hours_from: settings.sendHoursFrom,
      send_hours_to: settings.sendHoursTo,
      notify_absent: settings.notifyAbsent,
      notify_present: settings.notifyPresent,
      notify_late: settings.notifyLate,
      notify_3_absences: settings.notify3Absences,
      notify_payment_confirm: settings.notifyPaymentConfirm,
      notify_payment_due_7d: settings.notifyPaymentDue7d,
      notify_payment_due_1d: settings.notifyPaymentDue1d,
      notify_payment_overdue: settings.notifyPaymentOverdue,
      notify_new_student: settings.notifyNewStudent,
      notify_group_added: settings.notifyGroupAdded,
      notify_group_removed: settings.notifyGroupRemoved,
      notify_absence_excused: settings.notifyAbsenceExcused,
      notify_grade_recorded: settings.notifyGradeRecorded,
      updated_at: new Date(),
    } as any)
    .where('id', '=', sql<string>`${settings.id}::uuid`)
    .execute();
  }

  private toEntity(row: any): TelegramSettingsEntity {
    return new TelegramSettingsEntity(
      row.id, row.tenant_id, row.telegram_enabled, row.send_hours_from, row.send_hours_to,
      row.notify_absent, row.notify_present, row.notify_late, row.notify_3_absences,
      row.notify_payment_confirm, row.notify_payment_due_7d, row.notify_payment_due_1d,
      row.notify_payment_overdue, row.notify_new_student, row.notify_group_added,
      row.notify_group_removed, row.notify_absence_excused, row.notify_grade_recorded,
      row.created_at, row.updated_at,
    );
  }
}
