import { Inject, Injectable, Logger } from '@nestjs/common';
import { IWaInboundRepository, WA_INBOUND_REPOSITORY } from '../../domain/repositories/wa.repository.interface';
import { WaInboundMessageEntity } from '../../domain/entities/wa-inbound-message.entity';

export interface HandleInboundInput {
  tenantId: string;
  phone: string;
  body: string;
}

@Injectable()
export class HandleInboundUseCase {
  private readonly logger = new Logger(HandleInboundUseCase.name);

  constructor(
    @Inject(WA_INBOUND_REPOSITORY)
    private readonly inboundRepo: IWaInboundRepository,
  ) {}

  async execute(input: HandleInboundInput): Promise<WaInboundMessageEntity> {
    const { tenantId, phone, body } = input;

    const message = await this.inboundRepo.create({
      tenantId, phone, body,
      studentId: null,
      isRead: false,
      receivedAt: new Date(),
    });

    this.logger.log(`Inbound message from ${phone} — intent: ${message.intentType}`);
    return message;
  }

  async getInboundMessages(tenantId: string, opts?: {
    unreadOnly?: boolean;
    studentId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: WaInboundMessageEntity[]; total: number }> {
    return this.inboundRepo.findByTenantId(tenantId, opts);
  }

  async markRead(tenantId: string, messageId: string): Promise<void> {
    const messages = await this.inboundRepo.findByTenantId(tenantId, { limit: 1 });
    const msg = messages.data.find((m) => m.id === messageId);
    if (msg) {
      msg.markRead();
      await this.inboundRepo.save(msg);
    }
  }

  async getMessagesByPhone(tenantId: string, phone: string): Promise<WaInboundMessageEntity[]> {
    return this.inboundRepo.findByPhone(tenantId, phone);
  }
}
