import {
  Controller, Get, Post, Put, Delete,
  Body, Param, UseGuards, Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../shared/infrastructure/guards/jwt-auth.guard';
import { TenantGuard } from '../../../shared/infrastructure/guards/tenant.guard';
import { RolesGuard } from '../../../shared/infrastructure/guards/roles.guard';
import { PermissionGuard } from '../../../shared/infrastructure/guards/permission.guard';
import { RequirePermission } from '../../../shared/infrastructure/guards/permission.decorator';
import { SubjectUseCase } from '../application/use-cases/subject.usecase';
import { AppError } from '../../../core/errors/app.error';
import {
  CreateSubjectSchema,
  UpdateSubjectSchema,
  CreateSubjectGradeSchema,
  UpdateSubjectGradeSchema,
} from '../application/dtos/subject.dto';

@Controller('subjects')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, PermissionGuard)
export class SubjectController {
  constructor(private readonly useCase: SubjectUseCase) {}

  @Get()
  @RequirePermission('settings.view')
  async getAll(@Request() req: any) {
    const data = await this.useCase.getAll(req.user.tenantId);
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermission('settings.view')
  async getById(@Request() req: any, @Param('id') id: string) {
    const data = await this.useCase.getById(req.user.tenantId, id);
    return { success: true, data };
  }

  @Post()
  @RequirePermission('settings.edit')
  async create(@Request() req: any, @Body() body: any) {
    const parsed = CreateSubjectSchema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', parsed.error.errors[0].message, 400);
    const data = await this.useCase.create(req.user.tenantId, parsed.data);
    return { success: true, data };
  }

  @Put(':id')
  @RequirePermission('settings.edit')
  async update(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    const parsed = UpdateSubjectSchema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', parsed.error.errors[0].message, 400);
    const data = await this.useCase.update(req.user.tenantId, id, parsed.data);
    return { success: true, data };
  }

  @Delete(':id')
  @RequirePermission('settings.edit')
  async delete(@Request() req: any, @Param('id') id: string) {
    await this.useCase.delete(req.user.tenantId, id);
    return { success: true };
  }

  @Post(':id/grades')
  @RequirePermission('settings.edit')
  async addGrade(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    const parsed = CreateSubjectGradeSchema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', parsed.error.errors[0].message, 400);
    const data = await this.useCase.addGrade(req.user.tenantId, id, parsed.data);
    return { success: true, data };
  }

  @Put(':id/grades/:gradeId')
  @RequirePermission('settings.edit')
  async updateGrade(
    @Request() req: any,
    @Param('id') id: string,
    @Param('gradeId') gradeId: string,
    @Body() body: any,
  ) {
    const parsed = UpdateSubjectGradeSchema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', parsed.error.errors[0].message, 400);
    const data = await this.useCase.updateGrade(req.user.tenantId, id, gradeId, parsed.data);
    return { success: true, data };
  }

  @Delete(':id/grades/:gradeId')
  @RequirePermission('settings.edit')
  async deleteGrade(
    @Request() req: any,
    @Param('id') id: string,
    @Param('gradeId') gradeId: string,
  ) {
    await this.useCase.deleteGrade(req.user.tenantId, id, gradeId);
    return { success: true };
  }
}
