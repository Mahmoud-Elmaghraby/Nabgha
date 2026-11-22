import {
  Controller, Get, Post, Put, Delete, Patch,
  Body, Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../shared/infrastructure/guards/jwt-auth.guard';
import { TenantGuard } from '../../../shared/infrastructure/guards/tenant.guard';
import { RolesGuard } from '../../../shared/infrastructure/guards/roles.guard';
import { PermissionGuard } from '../../../shared/infrastructure/guards/permission.guard';
import { RequirePermission } from '../../../shared/infrastructure/guards/permission.decorator';
import { GroupUseCase } from '../application/use-cases/group.usecase';
import { AppError } from '../../../core/errors/app.error';
import {
  CreateGroupSchema,
  UpdateGroupSchema,
  ListGroupsSchema,
  AddStudentToGroupSchema,
  UpdateStudentDiscountSchema,
} from '../application/dtos/group.dto';

@Controller('groups')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, PermissionGuard)
export class GroupController {
  constructor(private readonly useCase: GroupUseCase) {}

  @Get()
  @RequirePermission('groups.view')
  async list(@Request() req: any, @Query() query: any) {
    const params = ListGroupsSchema.parse(query);
    const result = await this.useCase.list(req.user.tenantId, params);
    return { success: true, data: result };
  }

  @Get(':id')
  @RequirePermission('groups.view')
  async getById(@Request() req: any, @Param('id') id: string) {
    const data = await this.useCase.getById(req.user.tenantId, id);
    return { success: true, data };
  }

  @Post()
  @RequirePermission('groups.create')
  async create(@Request() req: any, @Body() body: unknown) {
    const parsed = CreateGroupSchema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', parsed.error.errors[0].message, 400);
    const data = await this.useCase.create(req.user.tenantId, parsed.data);
    return { success: true, data };
  }

  @Put(':id')
  @RequirePermission('groups.edit')
  async update(@Request() req: any, @Param('id') id: string, @Body() body: unknown) {
    const parsed = UpdateGroupSchema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', parsed.error.errors[0].message, 400);
    const data = await this.useCase.update(req.user.tenantId, id, parsed.data);
    return { success: true, data };
  }

  @Delete(':id')
  @RequirePermission('groups.delete')
  async delete(@Request() req: any, @Param('id') id: string) {
    await this.useCase.delete(req.user.tenantId, id);
    return { success: true };
  }

  @Get(':id/students')
  @RequirePermission('groups.view')
  async getStudents(@Request() req: any, @Param('id') id: string) {
    const data = await this.useCase.getStudents(req.user.tenantId, id);
    return { success: true, data };
  }

  @Post(':id/students')
  @RequirePermission('groups.edit')
  async addStudent(@Request() req: any, @Param('id') id: string, @Body() body: unknown) {
    const parsed = AddStudentToGroupSchema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', parsed.error.errors[0].message, 400);
    const data = await this.useCase.addStudent(
      req.user.tenantId,
      id,
      parsed.data.studentId,
      parsed.data.discount,
    );
    return { success: true, data };
  }

  @Patch(':id/students/:studentId/discount')
  @RequirePermission('groups.edit')
  async updateDiscount(
    @Request() req: any,
    @Param('id') id: string,
    @Param('studentId') studentId: string,
    @Body() body: unknown,
  ) {
    const parsed = UpdateStudentDiscountSchema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', parsed.error.errors[0].message, 400);
    await this.useCase.updateStudentDiscount(req.user.tenantId, id, studentId, parsed.data.discount);
    return { success: true };
  }

  @Delete(':id/students/:studentId')
  @RequirePermission('groups.edit')
  async removeStudent(
    @Request() req: any,
    @Param('id') id: string,
    @Param('studentId') studentId: string,
  ) {
    await this.useCase.removeStudent(req.user.tenantId, id, studentId);
    return { success: true };
  }
}
