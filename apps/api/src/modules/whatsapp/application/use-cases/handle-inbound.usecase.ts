import { Inject, Injectable, Logger } from '@nestjs/common';
import { IWaInboundRepository, WA_INBOUND_REPOSITORY } from '../../domain/repositories/wa.repository.interface';
import { WaInboundMessageEntity } from '../../domain/entities/wa-inbound-message.entity';
import { KyselyService } from '../../../../shared/infrastructure/database/kysely.service';
import { phoneVariants } from '../../../../shared/utils/phone.util';

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
    private readonly kysely: KyselyService,
  ) {}

  /**
   * واتساب بيبعت الرقم دايمًا بصيغة دولية (2010...) والطلاب متخزنين غالبًا بـ 010... —
   * فقبل كده ولا رسالة واردة كانت بتتربط بطالب. لو الرقم ده لولي أمر أكتر من طالب
   * (إخوات) بنربط بأول واحد، والرسالة بتظهر بالرقم في الحالتين.
   */
  private async findStudentByPhone(tenantId: string, phone: string): Promise<string | null> {
    const variants = phoneVariants(phone);
    const row = await this.kysely.getTenantDb(tenantId)
      .selectFrom('students')
      .select('id')
      .where('deleted_at', 'is', null)
      .where((eb) => eb.or([eb('parent_phone', 'in', variants), eb('student_phone', 'in', variants)]))
      .orderBy('is_active', 'desc')
      .limit(1)
      .executeTakeFirst();
    return (row?.id as string) ?? null;
  }

  async execute(input: HandleInboundInput): Promise<WaInboundMessageEntity> {
    const { tenantId, phone, body } = input;

    const studentId = await this.findStudentByPhone(tenantId, phone).catch(() => null);
    const message = await this.inboundRepo.create({
      tenantId, phone, body,
      studentId,
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
    const msg = await this.inboundRepo.findById(tenantId, messageId);
    if (msg) {
      msg.markRead();
      await this.inboundRepo.save(msg);
    }
  }

  async getMessagesByPhone(tenantId: string, phone: string): Promise<WaInboundMessageEntity[]> {
    return this.inboundRepo.findByPhone(tenantId, phone);
  }
}
