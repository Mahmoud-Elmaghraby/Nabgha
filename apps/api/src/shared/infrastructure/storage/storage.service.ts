import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: Minio.Client;
  private bucket: string;
  private endpoint: string;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    if (process.env.DEPLOY_MODE === 'desktop') return;
    const endpoint = this.config.get<string>('STORAGE_ENDPOINT') ?? 'http://localhost:9002';
    const url = new URL(endpoint);
    this.bucket = this.config.get<string>('STORAGE_BUCKET') ?? 'nabgha';
    this.endpoint = endpoint;

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
        // اعمل الـ bucket public read
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
        this.logger.log(`Bucket '${this.bucket}' created and set to public`);
      } else {
        this.logger.log(`Bucket '${this.bucket}' already exists`);
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
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    await this.client.putObject(this.bucket, fileName, buffer, buffer.length, {
      'Content-Type': mimeType,
    });

    // رجّع URL عبر nginx proxy عشان يكون HTTPS
    return `/storage/${this.bucket}/${fileName}`;
  }

  async deleteFile(url: string): Promise<void> {
    try {
      const urlObj = new URL(url);
      const key = urlObj.pathname.replace(`/${this.bucket}/`, '');
      await this.client.removeObject(this.bucket, key);
    } catch (err: any) {
      this.logger.warn(`Failed to delete file: ${err.message}`);
    }
  }

  getPublicUrl(key: string): string {
    return `/storage/${this.bucket}/${key}`;
  }
}
