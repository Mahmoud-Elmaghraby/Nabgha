import { Module } from '@nestjs/common';
import { TenantCapabilitiesService } from './tenant-capabilities.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [TenantCapabilitiesService],
  exports: [TenantCapabilitiesService],
})
export class TenantCapabilitiesModule {}
