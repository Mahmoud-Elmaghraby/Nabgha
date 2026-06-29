import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: Minio.Client;
  private bucket: string;
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
        const relativePath = url.replace('/storage/', '');
        const fullPath = path.join(this.localStoragePath, relativePath);
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        return;
      }
      const urlObj = new URL(url);
      const key = urlObj.pathname.replace(`/${this.bucket}/`, '');
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
}
