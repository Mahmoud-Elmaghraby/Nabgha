import { WaSessionEntity } from '../entities/wa-session.entity';
import { WaSettingsEntity } from '../entities/wa-settings.entity';
import { WaTemplateEntity, WaTemplateKey } from '../entities/wa-template.entity';
import { WaMessageEntity, WaMessageStatus } from '../entities/wa-message.entity';
import { WaBulkJobEntity } from '../entities/wa-bulk-job.entity';
import { WaInboundMessageEntity } from '../entities/wa-inbound-message.entity';

export interface IWaSessionRepository {
  findByTenantId(tenantId: string): Promise<WaSessionEntity | null>;
  upsert(tenantId: string, data: Partial<WaSessionEntity>): Promise<WaSessionEntity>;
  save(session: WaSessionEntity): Promise<void>;
}

export interface IWaSettingsRepository {
  findByTenantId(tenantId: string): Promise<WaSettingsEntity | null>;
  upsert(tenantId: string, data: Partial<WaSettingsEntity>): Promise<WaSettingsEntity>;
  save(settings: WaSettingsEntity): Promise<void>;
}

export interface IWaTemplateRepository {
  findAllByTenantId(tenantId: string): Promise<WaTemplateEntity[]>;
  findByKey(tenantId: string, key: WaTemplateKey): Promise<WaTemplateEntity | null>;
  upsert(tenantId: string, key: WaTemplateKey, body: string): Promise<WaTemplateEntity>;
  save(template: WaTemplateEntity): Promise<void>;
}

export interface IWaMessageRepository {
  create(data: {
    tenantId: string;
    phone: string;
    templateKey: string | null;
    body: string;
    status: WaMessageStatus;
    bulkJobId: string | null;
  }): Promise<WaMessageEntity>;
  save(message: WaMessageEntity): Promise<void>;
  findById(tenantId: string, id: string): Promise<WaMessageEntity | null>;
  findByTenantId(tenantId: string, opts?: {
    status?: WaMessageStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ data: WaMessageEntity[]; total: number }>;
  countTodayByTenantId(tenantId: string): Promise<number>;
}

export interface IWaBulkJobRepository {
  create(data: {
    tenantId: string;
    title: string;
    body: string;
    total: number;
    createdBy: string;
    scheduledAt: Date | null;
  }): Promise<WaBulkJobEntity>;
  save(job: WaBulkJobEntity): Promise<void>;
  findById(tenantId: string, id: string): Promise<WaBulkJobEntity | null>;
  findByTenantId(tenantId: string, limit?: number): Promise<WaBulkJobEntity[]>;
}

export interface IWaInboundRepository {
  create(data: {
    tenantId: string;
    phone: string;
    body: string;
    studentId: string | null;
    isRead: boolean;
    receivedAt: Date;
  }): Promise<WaInboundMessageEntity>;
  save(msg: WaInboundMessageEntity): Promise<void>;
  findByTenantId(tenantId: string, opts?: {
    unreadOnly?: boolean;
    studentId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: WaInboundMessageEntity[]; total: number }>;
  findByPhone(tenantId: string, phone: string): Promise<WaInboundMessageEntity[]>;
}

export const WA_SESSION_REPOSITORY = Symbol('IWaSessionRepository');
export const WA_SETTINGS_REPOSITORY = Symbol('IWaSettingsRepository');
export const WA_TEMPLATE_REPOSITORY = Symbol('IWaTemplateRepository');
export const WA_MESSAGE_REPOSITORY = Symbol('IWaMessageRepository');
export const WA_BULK_JOB_REPOSITORY = Symbol('IWaBulkJobRepository');
export const WA_INBOUND_REPOSITORY = Symbol('IWaInboundRepository');
