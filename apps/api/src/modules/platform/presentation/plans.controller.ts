import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { PlatformJwtAuthGuard } from '../../../shared/infrastructure/guards/jwt-auth.guard';
import { PlanUseCase } from '../application/use-cases/plan.usecase';
import { AppError } from '../../../core/errors/app.error';
import { CreatePlanSchema, UpdatePlanSchema } from '../application/dtos/plan.dto';

@Controller('platform/plans')
@UseGuards(PlatformJwtAuthGuard)
export class PlansController {
  constructor(private readonly planUseCase: PlanUseCase) {}

  @Get()
  async getAll() {
    const data = await this.planUseCase.getAll();
    return { success: true, data };
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    const data = await this.planUseCase.getById(id);
    return { success: true, data };
  }

  @Post()
  async create(@Body() body: unknown) {
    const parsed = CreatePlanSchema.safeParse(body);
    if (!parsed.success) throw new AppError('بيانات غير صحيحة', 'VALIDATION_ERROR', 400);
    const data = await this.planUseCase.create(parsed.data);
    return { success: true, data };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: unknown) {
    const parsed = UpdatePlanSchema.safeParse(body);
    if (!parsed.success) throw new AppError('بيانات غير صحيحة', 'VALIDATION_ERROR', 400);
    const data = await this.planUseCase.update(id, parsed.data);
    return { success: true, data };
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.planUseCase.delete(id);
    return { success: true, data: { message: 'تم حذف الخطة بنجاح' } };
  }
}
