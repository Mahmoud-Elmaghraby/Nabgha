import { Module } from '@nestjs/common';
import { TenantsController } from './presentation/tenants.controller';
import { PlansController } from './presentation/plans.controller';
import { StatsController } from './presentation/stats.controller';
import { TenantUseCase } from './application/use-cases/tenant.usecase';
import { PlanUseCase } from './application/use-cases/plan.usecase';
import { TenantRepository } from './infrastructure/tenant.repository';
import { PlanRepository } from './infrastructure/plan.repository';

@Module({
  controllers: [TenantsController, PlansController, StatsController],
  providers: [TenantUseCase, PlanUseCase, TenantRepository, PlanRepository],
  exports: [TenantUseCase, PlanUseCase],
})
export class PlatformModule {}
