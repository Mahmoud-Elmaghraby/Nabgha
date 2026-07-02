import {
  Controller, Post, UseGuards, Request,
  UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../shared/infrastructure/guards/jwt-auth.guard';
import { TenantGuard } from '../../shared/infrastructure/guards/tenant.guard';
import { RolesGuard } from '../../shared/infrastructure/guards/roles.guard';
import { PermissionGuard } from '../../shared/infrastructure/guards/permission.guard';
import { RequirePermission } from '../../shared/infrastructure/guards/permission.decorator';
import { StorageService } from '../../shared/infrastructure/storage/storage.service';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;   // 5MB
const MAX_LOGO_SIZE = 2 * 1024 * 1024;    // 2MB
const MAX_CARD_SIZE = 5 * 1024 * 1024;    // 5MB

@Controller('upload')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, PermissionGuard)
export class UploadController {
  constructor(private readonly storage: StorageService) {}

  // صورة عامة — أي موديول بيستدعيها لازم يكون فحص صلاحيته هو نفسه قبل النداء
  @Post('image')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_SIZE } }))
  async uploadImage(@UploadedFile() file: Express.Multer.File, @Request() req: any) {
    const url = await this.storage.validateAndUploadImage(
      file, `tenants/${req.user.tenantId}`, MAX_IMAGE_SIZE,
    );
    return { success: true, data: { url } };
  }

  @Post('logo')
  @RequirePermission('settings.edit')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_LOGO_SIZE } }))
  async uploadLogo(@UploadedFile() file: Express.Multer.File, @Request() req: any) {
    const url = await this.storage.validateAndUploadImage(
      file, `tenants/${req.user.tenantId}/logo`, MAX_LOGO_SIZE,
    );
    return { success: true, data: { url } };
  }

  @Post('card')
  @RequirePermission('settings.edit')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_CARD_SIZE } }))
  async uploadCard(@UploadedFile() file: Express.Multer.File, @Request() req: any) {
    const url = await this.storage.validateAndUploadImage(
      file, `tenants/${req.user.tenantId}/cards`, MAX_CARD_SIZE,
    );
    return { success: true, data: { url } };
  }
}
