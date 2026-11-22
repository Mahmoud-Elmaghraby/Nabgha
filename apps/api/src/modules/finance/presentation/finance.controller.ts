import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, Request, HttpCode, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../shared/infrastructure/guards/jwt-auth.guard';
import { TenantGuard } from '../../../shared/infrastructure/guards/tenant.guard';
import { RolesGuard } from '../../../shared/infrastructure/guards/roles.guard';
import { PermissionGuard } from '../../../shared/infrastructure/guards/permission.guard';
import { FinanceUseCase } from '../application/use-cases/finance.usecase';
import { RequirePermission } from '../../../shared/infrastructure/guards/permission.decorator';
import { ZodValidationPipe } from '../../../shared/infrastructure/pipes/zod-validation.pipe';
import {
  CreateTreasurySchema, UpdateTreasurySchema, TransferBetweenTreasuriesSchema,
  GenerateDuesSchema, UpdateDueSchema, WaiveDueSchema, ListDuesSchema, CreateManualDueSchema,
  CreatePaymentSchema, CancelPaymentSchema, RefundPaymentSchema, ListPaymentsSchema,
  CreateExpenseSchema, UpdateExpenseSchema, ListExpensesSchema, CollectMultiSchema,
} from '../application/dtos/finance.dto';

@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, PermissionGuard)
@Controller('finance')
export class FinanceController {
  constructor(private readonly useCase: FinanceUseCase) {}

  // ─── Treasuries ───────────────────────────────────────────
  @Get('treasuries')
  @RequirePermission('finance.view')
  async listTreasuries(@Request() req: any) {
    const data = await this.useCase.listTreasuries(req.user.tenantId);
    return { success: true, data };
  }

  @Get('treasuries/:id')
  @RequirePermission('finance.view')
  async getTreasury(@Request() req: any, @Param('id') id: string) {
    const data = await this.useCase.getTreasury(req.user.tenantId, id);
    return { success: true, data };
  }

  @Post('treasuries')
  @RequirePermission('finance.manage')
  async createTreasury(
    @Request() req: any,
    @Body(new ZodValidationPipe(CreateTreasurySchema)) body: any,
  ) {
    const data = await this.useCase.createTreasury(req.user.tenantId, body);
    return { success: true, data };
  }

  @Put('treasuries/:id')
  @RequirePermission('finance.manage')
  async updateTreasury(
    @Request() req: any,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateTreasurySchema)) body: any,
  ) {
    const data = await this.useCase.updateTreasury(req.user.tenantId, id, body);
    return { success: true, data };
  }

  @Delete('treasuries/:id')
  @RequirePermission('finance.manage')
  @HttpCode(204)
  async deleteTreasury(@Request() req: any, @Param('id') id: string) {
    await this.useCase.deleteTreasury(req.user.tenantId, id);
  }

  @Get('treasuries/:id/detail')
  @RequirePermission('finance.view')
  async getTreasuryDetail(@Request() req: any, @Param('id') id: string) {
    const data = await this.useCase.getTreasuryDetail(req.user.tenantId, id);
    return { success: true, data };
  }

  @Post('treasuries/transfer')
  @RequirePermission('finance.manage')
  async transferBetweenTreasuries(
    @Request() req: any,
    @Body(new ZodValidationPipe(TransferBetweenTreasuriesSchema)) body: any,
  ) {
    const data = await this.useCase.transferBetweenTreasuries(req.user.tenantId, body, req.user.sub);
    return { success: true, data };
  }

  // ─── Monthly Dues ─────────────────────────────────────────
  @Get('dues')
  @RequirePermission('finance.view')
  async listDues(@Request() req: any, @Query() query: any) {
    const params = ListDuesSchema.parse(query);
    const result = await this.useCase.listDues(req.user.tenantId, params);
    return { success: true, ...result };
  }

  @Get('dues/:id')
  @RequirePermission('finance.view')
  async getDue(@Request() req: any, @Param('id') id: string) {
    const data = await this.useCase.getDue(req.user.tenantId, id);
    return { success: true, data };
  }

  @Post('dues/generate')
  @RequirePermission('finance.manage')
  async generateDues(
    @Request() req: any,
    @Body(new ZodValidationPipe(GenerateDuesSchema)) body: any,
  ) {
    const data = await this.useCase.generateDues(req.user.tenantId, body, req.user.sub);
    return { success: true, data };
  }

  @Post('dues/manual')
  @RequirePermission('finance.collect')
  async createManualDue(
    @Request() req: any,
    @Body(new ZodValidationPipe(CreateManualDueSchema)) body: any,
  ) {
    const data = await this.useCase.createManualDue(req.user.tenantId, body, req.user.sub);
    return { success: true, data };
  }

  @Put('dues/:id')
  @RequirePermission('finance.manage')
  async updateDue(
    @Request() req: any,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateDueSchema)) body: any,
  ) {
    const data = await this.useCase.updateDue(req.user.tenantId, id, body);
    return { success: true, data };
  }

  @Patch('dues/:id/waive')
  @RequirePermission('finance.manage')
  async waiveDue(
    @Request() req: any,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(WaiveDueSchema)) body: any,
  ) {
    const data = await this.useCase.waiveDue(req.user.tenantId, id, body.notes);
    return { success: true, data };
  }

  @Delete('dues/:id')
  @RequirePermission('finance.manage')
  @HttpCode(204)
  async deleteDue(@Request() req: any, @Param('id') id: string) {
    await this.useCase.deleteDue(req.user.tenantId, id);
  }

  // ─── Payments ─────────────────────────────────────────────
  @Get('payments')
  @RequirePermission('finance.view')
  async listPayments(@Request() req: any, @Query() query: any) {
    const params = ListPaymentsSchema.parse(query);
    const result = await this.useCase.listPayments(req.user.tenantId, params);
    return { success: true, ...result };
  }

  @Get('payments/:id')
  @RequirePermission('finance.view')
  async getPayment(@Request() req: any, @Param('id') id: string) {
    const data = await this.useCase.getPayment(req.user.tenantId, id);
    return { success: true, data };
  }

  @Post('payments')
  @RequirePermission('finance.collect')
  async createPayment(
    @Request() req: any,
    @Body(new ZodValidationPipe(CreatePaymentSchema)) body: any,
  ) {
    const data = await this.useCase.createPayment(req.user.tenantId, body, req.user.sub);
    return { success: true, data };
  }

  @Post('payments/:id/cancel')
  @RequirePermission('finance.manage')
  async cancelPayment(
    @Request() req: any,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CancelPaymentSchema)) body: any,
  ) {
    const data = await this.useCase.cancelPayment(req.user.tenantId, id, body, req.user.sub);
    return { success: true, data };
  }

  @Post('payments/:id/refund')
  @RequirePermission('finance.manage')
  async refundPayment(
    @Request() req: any,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RefundPaymentSchema)) body: any,
  ) {
    const data = await this.useCase.refundPayment(req.user.tenantId, id, body, req.user.sub);
    return { success: true, data };
  }

  // ─── Expenses ─────────────────────────────────────────────
  @Get('expenses')
  @RequirePermission('finance.view')
  async listExpenses(@Request() req: any, @Query() query: any) {
    const params = ListExpensesSchema.parse(query);
    const result = await this.useCase.listExpenses(req.user.tenantId, params);
    return { success: true, ...result };
  }

  @Get('expenses/:id')
  @RequirePermission('finance.view')
  async getExpense(@Request() req: any, @Param('id') id: string) {
    const data = await this.useCase.getExpense(req.user.tenantId, id);
    return { success: true, data };
  }

  @Post('expenses')
  @RequirePermission('finance.manage')
  async createExpense(
    @Request() req: any,
    @Body(new ZodValidationPipe(CreateExpenseSchema)) body: any,
  ) {
    const data = await this.useCase.createExpense(req.user.tenantId, body, req.user.sub);
    return { success: true, data };
  }

  @Put('expenses/:id')
  @RequirePermission('finance.manage')
  async updateExpense(
    @Request() req: any,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateExpenseSchema)) body: any,
  ) {
    const data = await this.useCase.updateExpense(req.user.tenantId, id, body, req.user.sub);
    return { success: true, data };
  }

  @Delete('expenses/:id')
  @RequirePermission('finance.manage')
  @HttpCode(204)
  async deleteExpense(@Request() req: any, @Param('id') id: string) {
    await this.useCase.deleteExpense(req.user.tenantId, id, req.user.sub);
  }

  // ─── Collection ───────────────────────────────────────────
  @Get('collect/search')
  @RequirePermission('finance.collect')
  async searchStudents(@Request() req: any, @Query('q') q: string) {
    const data = await this.useCase.searchStudentsForCollection(req.user.tenantId, q);
    return { success: true, data };
  }

  @Get('collect/student/:studentId/dues')
  @RequirePermission('finance.collect')
  async getStudentOpenDues(@Request() req: any, @Param('studentId') studentId: string) {
    const data = await this.useCase.getStudentOpenDues(req.user.tenantId, studentId);
    return { success: true, data };
  }

  @Get('collect/student/:studentId/profile')
  @RequirePermission('finance.view')
  async getStudentFinancialProfile(@Request() req: any, @Param('studentId') studentId: string) {
    const data = await this.useCase.getStudentFinancialProfile(req.user.tenantId, studentId);
    return { success: true, data };
  }

  @Post('collect/multi')
  @RequirePermission('finance.collect')
  async collectMultiple(
    @Request() req: any,
    @Body(new ZodValidationPipe(CollectMultiSchema)) body: any,
  ) {
    const data = await this.useCase.collectMultiplePayments(req.user.tenantId, body, req.user.sub);
    return { success: true, data };
  }

  // ─── Stats ────────────────────────────────────────────────
  @Get('stats')
  @RequirePermission('finance.view')
  async getStats(@Request() req: any, @Query('month') month: string) {
    const currentMonth = month || new Date().toISOString().slice(0, 7);
    const data = await this.useCase.getStats(req.user.tenantId, currentMonth);
    return { success: true, data };
  }
}
