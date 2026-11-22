import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { TenantDatabase } from '@nabgha/db';

@Injectable()
export class KyselyService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KyselyService.name);
  private pool!: Pool;
  private db!: Kysely<TenantDatabase>;

  constructor(private config: ConfigService) {}

  onModuleInit() {
    this.pool = new Pool({
      connectionString: this.config.get<string>('DATABASE_URL'),
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    this.pool.on('error', (err) => {
      this.logger.error('PostgreSQL pool error', err);
    });

    this.db = new Kysely<TenantDatabase>({
      dialect: new PostgresDialect({ pool: this.pool }),
    });

    this.logger.log('KyselyService initialized');
  }

  async onModuleDestroy() {
    await this.db.destroy();
    this.logger.log('KyselyService destroyed');
  }

  /**
   * اسم الـ schema بتاعة المركز. getTenantDb بيضيفها تلقائي لأي جدول في الـ query builder،
   * لكن مش جوه sql`...` الخام — أي SQL خام بيلمس جداول المركز لازم يشتغل جوه
   * transaction فيها SET LOCAL search_path للـ schema دي (أو يستخدم الـ query builder).
   */
  getTenantSchema(tenantId: string): string {
    if (!tenantId || typeof tenantId !== 'string') {
      throw new Error(`Invalid tenantId: ${tenantId}`);
    }
    return `tenant_${tenantId.replace(/-/g, '_')}`;
  }

  getTenantDb(tenantId: string): Kysely<TenantDatabase> {
    if (!tenantId || typeof tenantId !== 'string') {
      throw new Error(`Invalid tenantId: ${tenantId}`);
    }
    const schemaName = `tenant_${tenantId.replace(/-/g, '_')}`;
    return this.db.withSchema(schemaName) as unknown as Kysely<TenantDatabase>;
  }
}
