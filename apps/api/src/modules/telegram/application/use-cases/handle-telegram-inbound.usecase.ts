import { Injectable, Logger } from '@nestjs/common';
import { TelegramInboundRepository } from '../../infrastructure/telegram-inbound.repository';
import { TelegramLinksRepository } from '../../infrastructure/telegram-links.repository';
import { TelegramInboundMessageEntity } from '../../domain/entities/telegram-inbound-message.entity';

export interface HandleTelegramInboundInput {
  tenantId: string;
  chatId: string;
  body: string;
}

/**
 * مرآة لـ HandleInboundUseCase (whatsapp) — الميزة التنافسية الجديدة: محادثة
 * ثنائية فعلية. الفرق المهم عن نظيرتها في الواتساب: بنعرف entity_id فورًا عن
 * طريق findEntityByChatId (الربط دقيق 100% عبر chat_id)، عكس الواتساب اللي
 * بيسيب student_id فاضي لحد ما حد يربطه يدويًا بمطابقة رقم تليفون.
 */
@Injectable()
export class HandleTelegramInboundUseCase {
  private readonly logger = new Logger(HandleTelegramInboundUseCase.name);

  constructor(
    private readonly inboundRepo: TelegramInboundRepository,
    private readonly links: TelegramLinksRepository,
  ) {}

  async execute(input: HandleTelegramInboundInput): Promise<TelegramInboundMessageEntity> {
    const { tenantId, chatId, body } = input;

    const linked = await this.links.findEntityByChatId(tenantId, chatId);

    const message = await this.inboundRepo.create({
      tenantId, chatId, body,
      entityType: linked?.entityType ?? null,
      entityId: linked?.entityId ?? null,
    });

    this.logger.log(`Telegram inbound from ${chatId} — linked entity: ${linked?.entityId ?? 'none'}`);
    return message;
  }

  async getInboundMessages(tenantId: string, opts?: {
    unreadOnly?: boolean; entityId?: string; limit?: number; offset?: number;
  }) {
    return this.inboundRepo.findByTenantId(tenantId, opts);
  }

  async markRead(tenantId: string, messageId: string): Promise<void> {
    const msg = await this.inboundRepo.findById(tenantId, messageId);
    if (msg) {
      msg.markRead();
      await this.inboundRepo.save(msg);
    }
  }
}
