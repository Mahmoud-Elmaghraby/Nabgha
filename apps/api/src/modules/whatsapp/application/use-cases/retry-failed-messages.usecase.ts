import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Inject } from '@nestjs/common';
import { IWaProvider, WA_PROVIDER } from '../../domain/interfaces/wa-provider.interface';
import { IWaMessageRepository, WA_MESSAGE_REPOSITORY } from '../../domain/repositories/wa.repository.interface';
import { IWaSettingsRepository, WA_SETTINGS_REPOSITORY } from '../../domain/repositories/wa.repository.interface';
import { IWaSessionRepository, WA_SESSION_REPOSITORY } from '../../domain/repositories/wa.repository.interface';
import { IWaTemplateRepository, WA_TEMPLATE_REPOSITORY } from '../../domain/repositories/wa.repository.interface';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { KyselyService } from '../../../../shared/infrastructure/database/kysely.service';
import { sql } from 'kysely';

const MAX_RETRIES = 3;
const RETRYABLE_ERRORS = ['not_connected', 'outside_send_hours', 'daily_limit_reached'];

@Injectable()
export class RetryFailedMessagesUseCase {
  private readonly logger = new Logger(RetryFailedMessagesUseCase.name);

  constructor(
    @Inject(WA_PROVIDER) private readonly provider: IWaProvider,
    @Inject(WA_MESSAGE_REPOSITORY) private readonly messageRepo: IWaMessageRepository,
    @Inject(WA_SETTINGS_REPOSITORY) private readonly settingsRepo: IWaSettingsRepository,
    @Inject(WA_SESSION_REPOSITORY) private readonly sessionRepo: IWaSessionRepository,
    @Inject(WA_TEMPLATE_REPOSITORY) private readonly templateRepo: IWaTemplateRepository,
    private readonly prisma: PrismaService,
    private readonly kysely: KyselyService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async retryAll(): Promise<void> {
    // desktop mode — الـ WhatsApp شغال عادي
    try {
      const tenants = await this.prisma.tenant.findMany({
        where: { isActive: true },
        select: { id: true },
      });

      for (const tenant of tenants) {
        await this.retryForTenant(tenant.id);
      }
    } catch (err: any) {
      this.logger.error(`Retry job error: ${err.message}`);
    }
  }

  private async retryForTenant(tenantId: string): Promise<void> {
    const settings = await this.settingsRepo.findByTenantId(tenantId);
    if (!settings?.waEnabled) return;
    if (!settings.isWithinSendHours()) return;

    const session = await this.sessionRepo.findByTenantId(tenantId);
    if (!session?.isConnected) return;

    const db = this.kysely.getTenantDb(tenantId);

    let sentToday = await this.messageRepo.countTodayByTenantId(tenantId);
    const dailyLimit = session.getCurrentDailyLimit(settings.dailyLimit);
    if (sentToday >= dailyLimit) return; // الحد اليومي مستهلك بالفعل — هننتظر بكرة

    // جيب الرسائل الفاشلة اللي ممكن نعيد إرسالها
    const failedMessages = await db
      .selectFrom('wa_messages_log')
      .selectAll()
      .where('status', '=', 'failed')
      .where('error_message', 'in', RETRYABLE_ERRORS)
      .where('retry_count', '<', MAX_RETRIES)
      .where('created_at', '>=', sql<Date>`NOW() - INTERVAL '24 hours'`)
      .orderBy('created_at', 'asc')
      .limit(10)
      .execute();

    if (failedMessages.length === 0) return;

    this.logger.log(`Retrying ${failedMessages.length} failed messages for tenant ${tenantId}`);

    for (const msg of failedMessages) {
      if (sentToday >= dailyLimit) {
        this.logger.log(`Daily limit reached mid-retry for tenant ${tenantId} — stopping until tomorrow`);
        break;
      }

      try {
        const result = await this.provider.sendMessage(tenantId, msg.phone, msg.body);

        if (result.success) {
          await db.updateTable('wa_messages_log')
            .set({
              status: 'sent',
              sent_at: new Date(),
              error_message: null,
            } as any)
            .where('id', '=', sql<string>`${msg.id}::uuid`)
            .execute();
          sentToday++;
          this.logger.log(`Retry succeeded for message ${msg.id}`);
        } else {
          await db.updateTable('wa_messages_log')
            .set({
              error_message: result.error,
              retry_count: sql`retry_count + 1`,
            } as any)
            .where('id', '=', sql<string>`${msg.id}::uuid`)
            .execute();
        }
      } catch (err: any) {
        this.logger.error(`Retry failed for message ${msg.id}: ${err.message}`);
      }

      // delay بين كل رسالة
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}
