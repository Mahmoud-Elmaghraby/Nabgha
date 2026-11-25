import { Body, Controller, Get, Param, Post, Put, Query, Request, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../../shared/infrastructure/guards/jwt-auth.guard';
import { TenantGuard } from '../../../shared/infrastructure/guards/tenant.guard';
import { RolesGuard } from '../../../shared/infrastructure/guards/roles.guard';
import { PermissionGuard } from '../../../shared/infrastructure/guards/permission.guard';
import { RequirePermission } from '../../../shared/infrastructure/guards/permission.decorator';
import { InboxUseCase } from '../application/use-cases/inbox.usecase';

/**
 * صندوق وارد الواتساب (WA-110).
 * الصلاحيات: inbox.view (الشوف) و inbox.reply (الرد) — المدير بيدّيهم للمساعد اللي هيرد على أولياء الأمور.
 * {phone} في المسارات أي صيغة (010… / 2010…) وبيتوحّد في الـ use case.
 */
@Controller('inbox')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, PermissionGuard)
export class InboxController {
  constructor(private readonly inbox: InboxUseCase) {}

  @Get('conversations')
  @RequirePermission('inbox.view')
  async conversations(
    @Request() req: any,
    @Query('search') search?: string,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const result = await this.inbox.listConversations(req.user.tenantId, {
      search,
      unreadOnly: unreadOnly === 'true',
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
    return { success: true, ...result };
  }

  @Get('unread-count')
  @RequirePermission('inbox.view')
  async unread(@Request() req: any) {
    return { success: true, data: await this.inbox.unreadCount(req.user.tenantId) };
  }

  @Get('conversations/:phone/messages')
  @RequirePermission('inbox.view')
  async thread(
    @Request() req: any,
    @Param('phone') phone: string,
    @Query('before') before?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.inbox.getThread(req.user.tenantId, phone, { before, limit: limit ? Number(limit) : undefined });
    return { success: true, data };
  }

  @Put('conversations/:phone/read')
  @RequirePermission('inbox.view')
  async read(@Request() req: any, @Param('phone') phone: string) {
    return { success: true, data: await this.inbox.markRead(req.user.tenantId, phone) };
  }

  @Post('conversations/:phone/messages')
  @RequirePermission('inbox.reply')
  async reply(@Request() req: any, @Param('phone') phone: string, @Body() body: { body?: unknown }) {
    const data = await this.inbox.reply(req.user.tenantId, req.user.sub ?? null, phone, body?.body);
    return { success: true, data };
  }

  @Post('messages/:id/retry')
  @RequirePermission('inbox.reply')
  async retry(@Request() req: any, @Param('id') id: string) {
    return { success: true, data: await this.inbox.retry(req.user.tenantId, id) };
  }

  /** الفويس نوت / الصورة / الملف — بعد الصلاحيات بس (مش من /storage العام) */
  @Get('messages/:id/media')
  @RequirePermission('inbox.view')
  async media(@Request() req: any, @Param('id') id: string, @Res() res: Response) {
    const { path, mime } = await this.inbox.getMedia(req.user.tenantId, id);
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.sendFile(path);
  }
}
