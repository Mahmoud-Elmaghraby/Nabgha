import {
  Controller, Get, Post, Put, Delete, Patch,
  Body, Param, Query, UseGuards, Request, Res,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../../shared/infrastructure/guards/jwt-auth.guard';
import { TenantGuard } from '../../../shared/infrastructure/guards/tenant.guard';
import { RolesGuard } from '../../../shared/infrastructure/guards/roles.guard';
import { PermissionGuard } from '../../../shared/infrastructure/guards/permission.guard';
import { RequirePermission } from '../../../shared/infrastructure/guards/permission.decorator';
import { StudentUseCase } from '../application/use-cases/student.usecase';
import { ExcelExportService } from '../../../shared/infrastructure/export/excel-export.service';
import { PdfExportService } from '../../../shared/infrastructure/export/pdf-export.service';
import { STUDENT_EXPORT_COLUMNS } from './student-export.columns';
import { AppError } from '../../../core/errors/app.error';
import {
  CreateStudentSchema,
  UpdateStudentSchema,
  ListStudentsSchema,
} from '../application/dtos/student.dto';

@Controller('students')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, PermissionGuard)
export class StudentController {
  constructor(
    private readonly useCase: StudentUseCase,
    private readonly excelExport: ExcelExportService,
    private readonly pdfExport: PdfExportService,
  ) {}

  @Get()
  @RequirePermission('students.view')
  async list(@Request() req: any, @Query() query: any) {
    const params = ListStudentsSchema.parse(query);
    const result = await this.useCase.list(req.user.tenantId, params);
    return { success: true, data: result };
  }

  @Get('export/columns')
  @RequirePermission('students.view')
  async getExportColumns() {
    const data = STUDENT_EXPORT_COLUMNS.map(c => ({ key: c.key, header: c.header }));
    return { success: true, data };
  }

  @Get('export')
  @RequirePermission('students.view')
  async export(@Request() req: any, @Query() query: any, @Res() res: Response) {
    const { format, columns, ...filters } = query;
    const parsed = ListStudentsSchema.parse(filters);
    const { page, limit, ...exportFilters } = parsed;
    const students = await this.useCase.listForExport(req.user.tenantId, exportFilters);

    let selectedColumns = STUDENT_EXPORT_COLUMNS;
    if (typeof columns === 'string' && columns.length > 0) {
      const requestedKeys = new Set([...columns.split(','), 'fullName']);
      selectedColumns = STUDENT_EXPORT_COLUMNS.filter(c => requestedKeys.has(c.key));
    }

    const filename = `students-${Date.now()}`;
    if (format === 'xlsx') {
      const buffer = await this.excelExport.generate(students, selectedColumns, {
        title: 'قائمة الطلاب',
      });
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
      });
      res.send(buffer);
      return;
    }

    const buffer = await this.pdfExport.generate(students, selectedColumns, {
      title: 'قائمة الطلاب',
    });
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}.pdf"`,
    });
    res.send(buffer);
  }

  @Get(':id')
  @RequirePermission('students.view')
  async getById(@Request() req: any, @Param('id') id: string) {
    const data = await this.useCase.getById(req.user.tenantId, id);
    return { success: true, data };
  }

  @Get(':id/groups')
  @RequirePermission('students.view')
  async getGroups(@Request() req: any, @Param('id') id: string) {
    const data = await this.useCase.getGroups(req.user.tenantId, id);
    return { success: true, data };
  }

  @Get(':id/attendance')
  @RequirePermission('students.view')
  async getAttendance(@Request() req: any, @Param('id') id: string) {
    const data = await this.useCase.getAttendance(req.user.tenantId, id);
    return { success: true, data };
  }

  @Get(':id/qr')
  @RequirePermission('students.view')
  async getQr(@Request() req: any, @Param('id') id: string, @Res() res: Response) {
    const student = await this.useCase.getById(req.user.tenantId, id);
    const QRCode = await import('qrcode');
    const qrData = JSON.stringify({
      code: student.studentCode,
      name: student.fullName,
      id: student.id,
    });
    const svg = await QRCode.toString(qrData, { type: 'svg', width: 200 });
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  }

  @Post()
  @RequirePermission('students.create')
  async create(@Request() req: any, @Body() body: unknown) {
    const parsed = CreateStudentSchema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', parsed.error.errors[0].message, 400);
    const data = await this.useCase.create(req.user.tenantId, parsed.data);
    return { success: true, data };
  }

  @Put(':id')
  @RequirePermission('students.edit')
  async update(@Request() req: any, @Param('id') id: string, @Body() body: unknown) {
    const parsed = UpdateStudentSchema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', parsed.error.errors[0].message, 400);
    const data = await this.useCase.update(req.user.tenantId, id, parsed.data);
    return { success: true, data };
  }

  @Patch(':id/toggle')
  @RequirePermission('students.edit')
  async toggle(@Request() req: any, @Param('id') id: string) {
    const data = await this.useCase.toggleActive(req.user.tenantId, id);
    return { success: true, data };
  }

  @Delete(':id')
  @RequirePermission('students.delete')
  async delete(@Request() req: any, @Param('id') id: string) {
    await this.useCase.delete(req.user.tenantId, id);
    return { success: true };
  }
}
