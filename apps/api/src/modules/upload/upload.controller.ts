import {
  Controller, Post, UseGuards, Request,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../shared/infrastructure/guards/jwt-auth.guard';
import { TenantGuard } from '../../shared/infrastructure/guards/tenant.guard';
import { StorageService } from '../../shared/infrastructure/storage/storage.service';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

// التحقق من magic bytes — مش بس الـ MIME type
function validateMagicBytes(buffer: Buffer, mimetype: string): boolean {
  if (buffer.length < 4) return false;
  const jpeg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  const png = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
  const webp = buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
  if (mimetype === 'image/jpeg' && !jpeg) return false;
  if (mimetype === 'image/png' && !png) return false;
  if (mimetype === 'image/webp' && !webp) return false;
  return true;
}

@Controller('upload')
@UseGuards(JwtAuthGuard, TenantGuard)
export class UploadController {
  constructor(private readonly storage: StorageService) {}

  @Post('image')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_SIZE } }))
  async uploadImage(@UploadedFile() file: Express.Multer.File, @Request() req: any) {
    if (!file) throw new BadRequestException('لم يتم رفع أي ملف');
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('نوع الملف غير مدعوم — يُسمح فقط بـ JPEG, PNG, WebP');
    }
    if (!validateMagicBytes(file.buffer, file.mimetype)) {
      throw new BadRequestException('الملف تالف أو غير صحيح');
    }
    const url = await this.storage.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype,
      `tenants/${req.user.tenantId}`,
    );
    return { success: true, data: { url } };
  }

  @Post('logo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  async uploadLogo(@UploadedFile() file: Express.Multer.File, @Request() req: any) {
    if (!file) throw new BadRequestException('لم يتم رفع أي ملف');
    if (file.size > 2 * 1024 * 1024) throw new BadRequestException('حجم اللوجو يتجاوز 2MB');
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('نوع الملف غير مدعوم');
    }
    if (!validateMagicBytes(file.buffer, file.mimetype)) {
      throw new BadRequestException('الملف تالف أو غير صحيح');
    }
    const url = await this.storage.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype,
      `tenants/${req.user.tenantId}/logo`,
    );
    return { success: true, data: { url } };
  }

  @Post('card')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadCard(@UploadedFile() file: Express.Multer.File, @Request() req: any) {
    if (!file) throw new BadRequestException('لم يتم رفع أي ملف');
    if (file.size > 5 * 1024 * 1024) throw new BadRequestException('حجم صورة الكارت يتجاوز 5MB');
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('نوع الملف غير مدعوم');
    }
    if (!validateMagicBytes(file.buffer, file.mimetype)) {
      throw new BadRequestException('الملف تالف أو غير صحيح');
    }
    const url = await this.storage.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype,
      `tenants/${req.user.tenantId}/cards`,
    );
    return { success: true, data: { url } };
  }
}
