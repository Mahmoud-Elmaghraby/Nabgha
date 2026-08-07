import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../../shared/infrastructure/guards/jwt-auth.guard';
import { TenantGuard } from '../../../shared/infrastructure/guards/tenant.guard';
import { PermissionGuard } from '../../../shared/infrastructure/guards/permission.guard';
import { RequirePermission } from '../../../shared/infrastructure/guards/permission.decorator';
import { CreateUserUseCase } from '../application/use-cases/create-user.usecase';
import { ListUsersUseCase } from '../application/use-cases/list-users.usecase';
import { GetUserUseCase } from '../application/use-cases/get-user.usecase';
import { UpdateUserUseCase } from '../application/use-cases/update-user.usecase';
import { DeleteUserUseCase } from '../application/use-cases/delete-user.usecase';
import { ChangePasswordUseCase } from '../application/use-cases/change-password.usecase';
import { CreateUserSchema } from '../application/dtos/create-user.dto';
import { UpdateUserSchema, ChangePasswordSchema } from '../application/dtos/update-user.dto';
import { UserMapper } from '../infrastructure/user.mapper';

@Controller('users')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
export class UserController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly listUsersUseCase: ListUsersUseCase,
    private readonly getUserUseCase: GetUserUseCase,
    private readonly updateUserUseCase: UpdateUserUseCase,
    private readonly deleteUserUseCase: DeleteUserUseCase,
    private readonly changePasswordUseCase: ChangePasswordUseCase,
  ) {}

  @Post()
  @RequirePermission('settings.edit')
  async create(@Body() body: unknown, @Request() req: any) {
    const dto = CreateUserSchema.parse(body);
    const user = await this.createUserUseCase.execute(dto, req.user.tenantId);
    return { success: true, data: UserMapper.toResponse(user) };
  }

  @Get()
  @RequirePermission('settings.view')
  async list(@Query() query: any, @Request() req: any) {
    const result = await this.listUsersUseCase.execute(
      {
        search: query.search,
        role: query.role,
        isActive: query.isActive !== undefined ? query.isActive === 'true' : undefined,
        page: query.page ? Number(query.page) : 1,
        limit: query.limit ? Number(query.limit) : 20,
      },
      req.user.tenantId,
    );
    return {
      success: true,
      data: {
        ...result,
        data: result.data.map(UserMapper.toResponse),
      },
    };
  }

  @Get(':id')
  @RequirePermission('settings.view')
  async getOne(@Param('id') id: string, @Request() req: any) {
    const user = await this.getUserUseCase.execute(id, req.user.tenantId);
    return { success: true, data: UserMapper.toResponse(user) };
  }

  @Put(':id')
  @RequirePermission('settings.edit')
  async update(@Param('id') id: string, @Body() body: unknown, @Request() req: any) {
    const dto = UpdateUserSchema.parse(body);
    const user = await this.updateUserUseCase.execute(id, dto, req.user.tenantId, req.user.sub);
    return { success: true, data: UserMapper.toResponse(user) };
  }

  @Delete(':id')
  @RequirePermission('settings.edit')
  async delete(@Param('id') id: string, @Request() req: any) {
    await this.deleteUserUseCase.execute(id, req.user.tenantId, req.user.sub);
    return { success: true, data: { message: 'تم حذف المستخدم بنجاح' } };
  }

  @Put(':id/password')
  async changePassword(@Param('id') id: string, @Body() body: unknown, @Request() req: any) {
    const dto = ChangePasswordSchema.parse(body);
    await this.changePasswordUseCase.execute(id, dto, req.user.tenantId);
    return { success: true, data: { message: 'تم تغيير كلمة المرور بنجاح' } };
  }
}
