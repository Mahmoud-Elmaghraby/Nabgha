import { Controller, Post, Body, Request, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../shared/infrastructure/guards/jwt-auth.guard';
import { TenantGuard } from '../../shared/infrastructure/guards/tenant.guard';
import { RolesGuard } from '../../shared/infrastructure/guards/roles.guard';
import { PermissionGuard } from '../../shared/infrastructure/guards/permission.guard';
import { RequirePermission } from '../../shared/infrastructure/guards/permission.decorator';
import { AppError } from '../../core/errors/app.error';
import { PrintMonthlyReportsUseCase } from './print-monthly-reports.usecase';

// نفس صلاحية عرض/توليد تقرير الطالب الشهري نفسه (category 'students' → students.view
// في reports.controller.ts) — طباعة/تحميل مش إرسال، فمش محتاجة reports.send_whatsapp.
@Controller('reports/monthly-print')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, PermissionGuard)
export class MonthlyPrintController {
  constructor(private readonly useCase: PrintMonthlyReportsUseCase) {}

  @Post()
  @RequirePermission('students.view')
  async print(@Request() req: any, @Body() body: any, @Res() res: Response) {
    const { studentIds, month } = body ?? {};
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'يجب اختيار طالب واحد على الأقل', 400);
    }
    if (!month) {
      throw new AppError('VALIDATION_ERROR', 'الشهر مطلوب', 400);
    }

    const buffer = await this.useCase.execute({ tenantId: req.user.tenantId, studentIds, month });

    res.set({
      'Content-Type': 'application/pdf',
      // اسم الهيدر لازم يكون ASCII بحت — أي حروف عربية هنا بتطلع
      // TypeError [ERR_INVALID_CHAR] من Node وقت setHeader. الاسم العربي الفعلي
      // اللي المستخدم بيشوفه بيتحدد في الفرونت (downloadBlob) مش من هنا.
      'Content-Disposition': `attachment; filename="monthly-reports-${month}-${Date.now()}.pdf"`,
    });
    res.send(buffer);
  }
}
