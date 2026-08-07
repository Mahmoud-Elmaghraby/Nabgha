import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { PlatformJwtAuthGuard } from '../../../shared/infrastructure/guards/jwt-auth.guard';
import { TenantUseCase } from '../application/use-cases/tenant.usecase';
import { AppError } from '../../../core/errors/app.error';
import { CreateTenantSchema, UpdateTenantSchema } from '../application/dtos/tenant.dto';

@Controller('platform/tenants')
@UseGuards(PlatformJwtAuthGuard)
export class TenantsController {
  constructor(private readonly tenantUseCase: TenantUseCase) {}

  @Get()
  async getAll(@Query('search') search?: string) {
    const data = await this.tenantUseCase.getAll(search);
    return { success: true, data };
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    const data = await this.tenantUseCase.getById(id);
    return { success: true, data };
  }

  @Post()
  async create(@Body() body: unknown) {
    const parsed = CreateTenantSchema.safeParse(body);
    if (!parsed.success) throw new AppError('بيانات غير صحيحة', 'VALIDATION_ERROR', 400);
    const data = await this.tenantUseCase.create(parsed.data);
    return { success: true, data };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: unknown) {
    const parsed = UpdateTenantSchema.safeParse(body);
    if (!parsed.success) throw new AppError('بيانات غير صحيحة', 'VALIDATION_ERROR', 400);
    const data = await this.tenantUseCase.update(id, parsed.data);
    return { success: true, data };
  }

  @Patch(':id/toggle-active')
  async toggleActive(@Param('id') id: string) {
    const data = await this.tenantUseCase.toggleActive(id);
    return { success: true, data };
  }
}
