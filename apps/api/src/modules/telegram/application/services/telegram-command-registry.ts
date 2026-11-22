import { Injectable, Logger } from '@nestjs/common';
import { TelegramService } from '../../telegram.service';
import { TelegramLinksRepository } from '../../infrastructure/telegram-links.repository';
import { HandleTelegramInboundUseCase } from '../use-cases/handle-telegram-inbound.usecase';

export interface TelegramMessage {
  chatId: string;
  text: string;
}

export type TelegramCommandHandler = (tenantId: string, chatId: string, args: string[]) => Promise<void>;

/**
 * Registry بسيط للأوامر — نفس روح Registry/Strategy المستخدم في ReportRegistryService
 * (modules/reports). كل أمر جديد (/grades, /balance...) بيتسجل هنا من غير ما يلمس
 * منطق الـ polling نفسه في TelegramPollingService.
 */
@Injectable()
export class TelegramCommandRegistry {
  private readonly logger = new Logger(TelegramCommandRegistry.name);
  private readonly handlers = new Map<string, TelegramCommandHandler>();

  constructor(
    private readonly telegram: TelegramService,
    private readonly links: TelegramLinksRepository,
    private readonly handleInbound: HandleTelegramInboundUseCase,
  ) {
    this.register('/start', this.handleStart.bind(this));
  }

  register(command: string, handler: TelegramCommandHandler): void {
    this.handlers.set(command, handler);
  }

  async dispatch(tenantId: string, message: TelegramMessage): Promise<void> {
    const text = message.text.trim();

    // مش أمر (مش بادئ بـ /) — يبقى رد عادي من ولي الأمر، مش أمر نظام. قبل كده
    // كان بيتجاهل بصمت؛ دلوقتي بنسجله كرسالة واردة (الميزة الجديدة: محادثة
    // ثنائية فعلية) بدل ما نضيّعه.
    if (!text.startsWith('/')) {
      try {
        await this.handleInbound.execute({ tenantId, chatId: message.chatId, body: text });
      } catch (err: any) {
        this.logger.error(`Failed to handle inbound text for tenant ${tenantId}: ${err.message}`);
      }
      return;
    }

    const [command, ...args] = text.split(' ');
    const handler = this.handlers.get(command);
    if (!handler) return;

    try {
      await handler(tenantId, message.chatId, args);
    } catch (err: any) {
      this.logger.error(`Command ${command} failed for tenant ${tenantId}: ${err.message}`);
    }
  }

  private async handleStart(tenantId: string, chatId: string, args: string[]): Promise<void> {
    const studentCode = args[0]?.trim();
    if (!studentCode) return;

    const linked = await this.telegram.linkChat(tenantId, 'student', studentCode, chatId);
    if (linked) {
      await this.telegram.sendMessage(
        tenantId,
        chatId,
        `✅ <b>تم الربط بنجاح!</b>\nستصلك إشعارات الطالب على هذا الحساب.`,
      );
    } else {
      await this.telegram.sendMessage(tenantId, chatId, `❌ لم يتم العثور على الطالب. تأكد من الرابط.`);
    }
  }
}
