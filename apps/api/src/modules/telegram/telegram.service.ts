import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { KyselyService } from '../../shared/infrastructure/database/kysely.service';
import { ModuleSettingsRepository } from '../settings/infrastructure/settings.repository';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private readonly kysely: KyselyService,
    private readonly settingsRepo: ModuleSettingsRepository,
  ) {}

  private async getBotToken(tenantId: string): Promise<string | null> {
    return this.settingsRepo.get(tenantId, 'telegram_bot_token');
  }

  async sendMessage(tenantId: string, chatId: string, text: string): Promise<boolean> {
    const token = await this.getBotToken(tenantId);
    if (!token) return false;
    try {
      await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      });
      return true;
    } catch (err: any) {
      this.logger.warn(`Telegram send failed: ${err.message}`);
      return false;
    }
  }

  async sendNotification(tenantId: string, studentId: string, text: string): Promise<boolean> {
    const db = this.kysely.getTenantDb(tenantId);
    const student = await db
      .selectFrom('students')
      .select(['telegram_chat_id'])
      .where('id', '=', studentId as any)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    const chatId = (student as any)?.telegram_chat_id;
    if (!chatId) return false;

    return this.sendMessage(tenantId, chatId, text);
  }

  async saveChatId(tenantId: string, studentCode: string, chatId: string): Promise<boolean> {
    const db = this.kysely.getTenantDb(tenantId);
    const student = await db
      .selectFrom('students')
      .select(['id'])
      .where('student_code', '=', studentCode)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (!student) return false;

    await db
      .updateTable('students')
      .set({ telegram_chat_id: chatId } as any)
      .where('id', '=', (student as any).id as any)
      .execute();

    return true;
  }

  async getBotInfo(tenantId: string): Promise<{ username: string; name: string } | null> {
    const token = await this.getBotToken(tenantId);
    if (!token) return null;
    try {
      const res = await axios.get(`https://api.telegram.org/bot${token}/getMe`);
      return {
        username: res.data.result.username,
        name: res.data.result.first_name,
      };
    } catch {
      return null;
    }
  }

  async setWebhook(tenantId: string, webhookUrl: string): Promise<boolean> {
    const token = await this.getBotToken(tenantId);
    if (!token) return false;
    try {
      await axios.post(`https://api.telegram.org/bot${token}/setWebhook`, {
        url: webhookUrl,
        allowed_updates: ['message'],
      });
      return true;
    } catch {
      return false;
    }
  }

  async getDeepLink(tenantId: string, studentCode: string): Promise<string | null> {
    const botInfo = await this.getBotInfo(tenantId);
    if (!botInfo) return null;
    return `https://t.me/${botInfo.username}?start=${studentCode}`;
  }
}
