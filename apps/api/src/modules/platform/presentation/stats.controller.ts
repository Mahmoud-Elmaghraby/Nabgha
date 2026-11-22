import { Controller, Get, UseGuards } from '@nestjs/common';
import { PlatformJwtAuthGuard } from '../../../shared/infrastructure/guards/jwt-auth.guard';
import { TenantUseCase } from '../application/use-cases/tenant.usecase';

@Controller('platform/stats')
@UseGuards(PlatformJwtAuthGuard)
export class StatsController {
  constructor(private readonly tenantUseCase: TenantUseCase) {}

  @Get()
  async getStats() {
    const data = await this.tenantUseCase.getStats();
    return { success: true, data };
  }
}
