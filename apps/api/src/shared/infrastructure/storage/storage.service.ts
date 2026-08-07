import { Injectable, Logger, OnModuleInit, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import * as fs from 'fs';
import * as path from 'path';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client!: Minio.Client;
  private bucket!: string;
  private isDesktop: boolean;
  private localStoragePath: string;

  constructor(private readonly config: ConfigService) {
    this.isDesktop = process.env.DEPLOY_MODE === 'desktop';
    // في Desktop mode — نحفظ الصور جنب الـ exe
    this.localStoragePath = process.env.STORAGE_LOCAL_PATH
      ?? path.join(process.env.APPDATA ?? process.cwd(), 'Nabgha', 'storage');
  }

  async onModuleInit() {
    if (this.isDesktop) {
      // إنشاء الـ folder لو مش موجود
      fs.mkdirSync(this.localStoragePath, { recursive: true });
      this.logger.log(`Desktop storage: ${this.localStoragePath}`);
      return;
    }

    const endpoint = this.config.get<string>('STORAGE_ENDPOINT') ?? 'http://localhost:9002';
    const url = new URL(endpoint);
    this.bucket = this.config.get<string>('STORAGE_BUCKET') ?? 'nabgha';

    this.client = new Minio.Client({
      endPoint: url.hostname,
      port: parseInt(url.port || '9002'),
      useSSL: url.protocol === 'https:',
      accessKey: this.config.get<string>('STORAGE_ACCESS_KEY') ?? 'minioadmin',
      secretKey: this.config.get<string>('STORAGE_SECRET_KEY') ?? 'minioadmin',
    });

    await this.ensureBucket();
  }

  private async ensureBucket() {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        const policy = JSON.stringify({
          Version: '2012-10-17',
          Statement: [{
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${this.bucket}/*`],
          }],
        });
        await this.client.setBucketPolicy(this.bucket, policy);
        this.logger.log(`Bucket created: ${this.bucket}`);
      }
    } catch (err: any) {
      this.logger.error(`Failed to ensure bucket: ${err.message}`);
    }
  }

  // ─── التحقق من magic bytes — مش بس الـ MIME type ─────────
  private validateMagicBytes(buffer: Buffer, mimetype: string): boolean {
    if (buffer.length < 12) return false;
    const jpeg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    const png = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    const webp = buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
    if (mimetype === 'image/jpeg' && !jpeg) return false;
    if (mimetype === 'image/png' && !png) return false;
    if (mimetype === 'image/webp' && !webp) return false;
    return true;
  }

  /**
   * دالة موحدة: تحقق كامل (نوع + magic bytes + حجم) ثم رفع الملف.
   * تُستخدم من أي endpoint محتاج يرفع صورة — بدل تكرار نفس المنطق في كل كونترولر.
   */
  async validateAndUploadImage(
    file: { buffer: Buffer; mimetype: string; originalname: string; size: number } | undefined,
    folder: string,
    maxSizeBytes: number,
  ): Promise<string> {
    if (!file) throw new BadRequestException('لم يتم رفع أي ملف');
    if (file.size > maxSizeBytes) {
      throw new BadRequestException(`حجم الملف يتجاوز ${Math.round(maxSizeBytes / (1024 * 1024))}MB`);
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('نوع الملف غير مدعوم — يُسمح فقط بـ JPEG, PNG, WebP');
    }
    if (!this.validateMagicBytes(file.buffer, file.mimetype)) {
      throw new BadRequestException('الملف تالف أو غير صحيح');
    }
    return this.uploadFile(file.buffer, file.originalname, file.mimetype, folder);
  }

  async uploadFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    folder = 'uploads',
  ): Promise<string> {
    const ext = originalName.split('.').pop()?.toLowerCase() ?? 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const relativePath = `${folder}/${fileName}`;

    if (this.isDesktop) {
      // حفظ على الـ local file system
      const fullDir = path.join(this.localStoragePath, folder);
      fs.mkdirSync(fullDir, { recursive: true });
      const fullPath = path.join(this.localStoragePath, relativePath);
      fs.writeFileSync(fullPath, buffer);
      // نرجع URL بيـserve من NestJS على /storage/...
      return `/storage/${relativePath}`;
    }

    await this.client.putObject(this.bucket, relativePath, buffer, buffer.length, {
      'Content-Type': mimeType,
    });
    return `/storage/${this.bucket}/${relativePath}`;
  }

  async deleteFile(url: string): Promise<void> {
    try {
      if (this.isDesktop) {
        // شكل الرابط: /storage/{folder}/{fileName}
        const relativePath = url.replace(/^\/storage\//, '');
        const fullPath = path.join(this.localStoragePath, relativePath);
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        return;
      }
      // شكل الرابط: /storage/{bucket}/{folder}/{fileName} — رابط نسبي مش absolute URL
      const prefix = `/storage/${this.bucket}/`;
      if (!url.startsWith(prefix)) {
        this.logger.warn(`URL format not recognized for deletion: ${url}`);
        return;
      }
      const key = url.slice(prefix.length);
      await this.client.removeObject(this.bucket, key);
    } catch (err: any) {
      this.logger.warn(`Failed to delete file: ${err.message}`);
    }
  }

  getPublicUrl(key: string): string {
    if (this.isDesktop) return `/storage/${key}`;
    return `/storage/${this.bucket}/${key}`;
  }

  // يُستخدم من main.ts لتسجيل الـ static route للـ storage
  getLocalStoragePath(): string {
    return this.localStoragePath;
  }

  /**
   * يقرأ ملف من التخزين المحلي كـ Buffer خام (مستخدم لإرفاق صور في رسائل واتساب).
   * متاح حالياً في Desktop mode بس — الأوضاع التانية (S3/MinIO) هترجع null
   * لحد ما نبني منطق جلب مشابه ليها لو احتجناه لاحقاً.
   */
  async getFileBuffer(url: string): Promise<Buffer | null> {
    if (!this.isDesktop) return null;
    try {
      const relativePath = url.replace(/^\/storage\//, '');
      const fullPath = path.join(this.localStoragePath, relativePath);
      if (!fs.existsSync(fullPath)) return null;
      return fs.readFileSync(fullPath);
    } catch (err: any) {
      this.logger.warn(`getFileBuffer failed for ${url}: ${err.message}`);
      return null;
    }
  }
}
