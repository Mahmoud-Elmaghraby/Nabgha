import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { IWaProvider, WA_PROVIDER } from '../../domain/interfaces/wa-provider.interface';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class RestoreSessionsUseCase implements OnModuleInit {
  private readonly logger = new Logger(RestoreSessionsUseCase.name);

  constructor(
    @Inject(WA_PROVIDER) private readonly provider: IWaProvider,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    setTimeout(() => this.restoreAll(), 5000);
  }

  private async restoreAll(): Promise<void> {
    try {
      const tenants = await this.prisma.tenant.findMany({
        where: { isActive: true },
        select: { id: true },
      });

      for (const tenant of tenants) {
        const sessionDir = path.join(process.cwd(), 'wa-sessions', tenant.id);
        if (fs.existsSync(sessionDir)) {
          const files = fs.readdirSync(sessionDir);
          if (files.length > 0) {
            this.logger.log(`Restoring WA session for tenant ${tenant.id}`);
            this.provider.connect(tenant.id).catch(err =>
              this.logger.error(`Failed to restore session for tenant ${tenant.id}: ${err.message}`)
            );
          }
        }
      }
    } catch (err: any) {
      this.logger.error(`Failed to restore sessions: ${err.message}`);
    }
  }
}
