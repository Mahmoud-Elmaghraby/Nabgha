import { Controller, ForbiddenException, Get, Param, Query, Request, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { hasPermission } from '@nabgha/types';
import { JwtAuthGuard } from '../../shared/infrastructure/guards/jwt-auth.guard';
import { TenantGuard } from '../../shared/infrastructure/guards/tenant.guard';
import { RolesGuard } from '../../shared/infrastructure/guards/roles.guard';
import { PermissionGuard } from '../../shared/infrastructure/guards/permission.guard';
import { RequirePermission } from '../../shared/infrastructure/guards/permission.decorator';
import { AppError } from '../../core/errors/app.error';
import { ReportRegistryService } from './report-registry.service';

// كل تقارير الـ controller ده كانت بتتحقق بس من صلاحية 'students.view' بغض النظر عن
// نوع التقرير — يعني أي حد عنده صلاحية عرض الطلاب بس (زي المدرس) كان يقدر يفتح تقرير
// التحصيل أو المستحقات المتأخرة ويشوف مبالغ الدفع والخصومات وأرقام الإيصالات، رغم إنه
// أصلاً ممنوع من فتح شاشة المالية نفسها. الماب ده بيربط كل تصنيف تقرير بالصلاحية
// المناسبة له فعلياً. 'student-statement' مستثنى بالاسم رغم إنه مصنّف 'students' لأنه
// كشف حساب مالي كامل (مدفوعات، خصومات، أرقام إيصالات).
const REPORT_KEY_PERMISSIONS: Record<string, string> = {
  'student-statement': 'finance.view',
};
const CATEGORY_PERMISSIONS: Record<string, string> = {
  finance: 'finance.view',
  students: 'students.view',
  sessions: 'sessions.view',
  exams: 'sessions.view',
};

@Controller('reports')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, PermissionGuard)
export class ReportsController {
  constructor(private readonly registry: ReportRegistryService) {}

  private requiredPermissionFor(key: string, category: string): string {
    return REPORT_KEY_PERMISSIONS[key] ?? CATEGORY_PERMISSIONS[category] ?? 'students.view';
  }

  private assertCanAccess(req: any, key: string, category: string): void {
    if (req.user.role === 'tenant_admin') return;
    const required = this.requiredPermissionFor(key, category);
    if (!hasPermission(req.user.permissions || [], required)) {
      throw new ForbiddenException('ليس لديك صلاحية لعرض هذا التقرير');
    }
  }

  @Get()
  @RequirePermission('students.view')
  async list(@Request() req: any) {
    const all = this.registry.getAll();
    if (req.user.role === 'tenant_admin') {
      return { success: true, data: all };
    }
    const permissions: string[] = req.user.permissions || [];
    const visible = all.filter((r) =>
      hasPermission(permissions, this.requiredPermissionFor(r.key, r.category)),
    );
    return { success: true, data: visible };
  }

  @Get(':key/preview')
  @RequirePermission('students.view')
  async preview(@Request() req: any, @Param('key') key: string, @Query() query: any) {
    const report = this.registry.get(key);
    if (!report) throw new AppError('NOT_FOUND', 'التقرير غير موجود', 404);
    this.assertCanAccess(req, key, report.category);
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
    this.assertCanAccess(req, key, report.category);

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
