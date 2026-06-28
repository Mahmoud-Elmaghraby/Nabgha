import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../shared/infrastructure/guards/jwt-auth.guard';
import { TenantGuard } from '../../../shared/infrastructure/guards/tenant.guard';
import { RolesGuard } from '../../../shared/infrastructure/guards/roles.guard';
import { PermissionGuard } from '../../../shared/infrastructure/guards/permission.guard';
import { RequirePermission } from '../../../shared/infrastructure/guards/permission.decorator';
import { TeacherUseCase } from '../application/use-cases/teacher.usecase';
import { AppError } from '../../../core/errors/app.error';
import { CreateTeacherSchema, UpdateTeacherSchema } from '../application/dtos/teacher.dto';

@Controller('teachers')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, PermissionGuard)
export class TeacherController {
  constructor(private readonly teacherUseCase: TeacherUseCase) {}

  @Get()
  @RequirePermission('teachers.view')
  async getAll(@Request() req: any, @Query('search') search?: string) {
    const data = await this.teacherUseCase.getAll(req.user.tenantId, search);
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermission('teachers.view')
  async getById(@Request() req: any, @Param('id') id: string) {
    const data = await this.teacherUseCase.getById(req.user.tenantId, id);
    return { success: true, data };
  }

  @Post()
  @RequirePermission('teachers.create')
  async create(@Request() req: any, @Body() body: unknown) {
    const parsed = CreateTeacherSchema.safeParse(body);
    if (!parsed.success) throw new AppError('بيانات غير صحيحة', 'VALIDATION_ERROR', 400);
    const data = await this.teacherUseCase.create(req.user.tenantId, parsed.data);
    return { success: true, data };
  }

  @Put(':id')
  @RequirePermission('teachers.edit')
  async update(@Request() req: any, @Param('id') id: string, @Body() body: unknown) {
    const parsed = UpdateTeacherSchema.safeParse(body);
    if (!parsed.success) throw new AppError('بيانات غير صحيحة', 'VALIDATION_ERROR', 400);
    const data = await this.teacherUseCase.update(req.user.tenantId, id, parsed.data);
    return { success: true, data };
  }

  @Delete(':id')
  @RequirePermission('teachers.delete')
  async delete(@Request() req: any, @Param('id') id: string) {
    await this.teacherUseCase.delete(req.user.tenantId, id);
    return { success: true, data: { message: 'تم حذف المدرس بنجاح' } };
  }
}
