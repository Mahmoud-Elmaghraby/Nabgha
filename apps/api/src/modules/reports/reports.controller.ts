import { Controller, Get, Param, Query, Request, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../shared/infrastructure/guards/jwt-auth.guard';
import { TenantGuard } from '../../shared/infrastructure/guards/tenant.guard';
import { RolesGuard } from '../../shared/infrastructure/guards/roles.guard';
import { PermissionGuard } from '../../shared/infrastructure/guards/permission.guard';
import { RequirePermission } from '../../shared/infrastructure/guards/permission.decorator';
import { AppError } from '../../core/errors/app.error';
import { ReportRegistryService } from './report-registry.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, PermissionGuard)
export class ReportsController {
  constructor(private readonly registry: ReportRegistryService) {}

  @Get()
  @RequirePermission('students.view')
  async list() {
    return { success: true, data: this.registry.getAll() };
  }

  @Get(':key/preview')
  @RequirePermission('students.view')
  async preview(@Request() req: any, @Param('key') key: string, @Query() query: any) {
    const report = this.registry.get(key);
    if (!report) throw new AppError('NOT_FOUND', 'التقرير غير موجود', 404);
    const data = await report.getPreviewData(req.user.tenantId, query);
    return { success: true, data };
  }

  @Get(':key/generate')
  @RequirePermission('students.view')
  async generate(
    @Request() req: any,
    @Param('key') key: string,
    @Query() query: any,
    @Res() res: Response,
  ) {
    const report = this.registry.get(key);
    if (!report) throw new AppError('NOT_FOUND', 'التقرير غير موجود', 404);

    const { format, ...params } = query;
    const resolvedFormat = format === 'xlsx' ? 'xlsx' : 'pdf';

    const buffer = await report.generate(req.user.tenantId, params, resolvedFormat);
    const filename = `${key}-${Date.now()}`;

    res.set({
      'Content-Type': resolvedFormat === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}.${resolvedFormat}"`,
    });
    res.send(buffer);
  }
}
