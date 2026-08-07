import { Controller, Post, Get, Delete, Param, Body, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/infrastructure/guards/jwt-auth.guard';
import { TenantGuard } from '../../shared/infrastructure/guards/tenant.guard';
import { RolesGuard } from '../../shared/infrastructure/guards/roles.guard';
import { PermissionGuard } from '../../shared/infrastructure/guards/permission.guard';
import { RequirePermission } from '../../shared/infrastructure/guards/permission.decorator';
import { AppError } from '../../core/errors/app.error';
import { SendMonthlyReportsUseCase } from './send-monthly-reports.usecase';

@Controller('reports/monthly-whatsapp')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, PermissionGuard)
export class MonthlyWhatsappController {
  constructor(private readonly useCase: SendMonthlyReportsUseCase) {}

  @Post('send')
  @RequirePermission('reports.send_whatsapp')
  async send(@Request() req: any, @Body() body: any) {
    const { studentIds, month } = body ?? {};
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'يجب اختيار طالب واحد على الأقل', 400);
    }
    if (!month) {
      throw new AppError('VALIDATION_ERROR', 'الشهر مطلوب', 400);
    }

    try {
      const data = await this.useCase.execute({
        tenantId: req.user.tenantId,
        studentIds,
        month,
        createdBy: req.user.sub,
      });
      return { success: true, data };
    } catch (err: any) {
      if (err.message === 'not_connected') throw new AppError('WA_NOT_CONNECTED', 'الواتساب غير متصل حالياً', 400);
      if (err.message === 'wa_disabled') throw new AppError('WA_DISABLED', 'خدمة الواتساب معطّلة', 400);
      throw err;
    }
  }

  @Get(':jobId')
  @RequirePermission('reports.send_whatsapp')
  async progress(@Request() req: any, @Param('jobId') jobId: string) {
    const data = await this.useCase.getProgress(req.user.tenantId, jobId);
    if (!data) throw new AppError('NOT_FOUND', 'الوظيفة غير موجودة', 404);
    return { success: true, data };
  }

  @Delete(':jobId')
  @RequirePermission('reports.send_whatsapp')
  async cancel(@Request() req: any, @Param('jobId') jobId: string) {
    await this.useCase.cancel(req.user.tenantId, jobId);
    return { success: true };
  }
}
