import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './core/errors/http-exception.filter';
import { TransformInterceptor } from './core/interceptors/transform.interceptor';
import { LoggingInterceptor } from './core/interceptors/logging.interceptor';
import { AppLogger } from './core/logging/logger.service';
import { NestExpressApplication } from '@nestjs/platform-express';
import { StorageService } from './shared/infrastructure/storage/storage.service';
import helmet from 'helmet';
import * as path from 'path';
import * as fs from 'fs';

async function bootstrap() {
  const isDesktop = process.env.DEPLOY_MODE === 'desktop';
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const logger = app.get(AppLogger);
  app.useLogger(logger);
  // ورا nginx: من غير trust proxy كل الطلبات بتظهر جاية من 127.0.0.1، فحد الطلبات
  // (rate limit) كان بيتحسب على السيرفر كله كأنه مستخدم واحد
  app.set('trust proxy', 'loopback');
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  app.setGlobalPrefix('api/v1');

  // ── Desktop mode: خدمة الـ static files ──────────────────
  if (isDesktop) {
    const staticPath = process.env.STATIC_PATH;
    const storageService = app.get(StorageService);
    const localStoragePath = storageService.getLocalStoragePath();
    fs.mkdirSync(localStoragePath, { recursive: true });

    // 1. Storage files على /storage/
    app.useStaticAssets(localStoragePath, { prefix: '/storage' });
    logger.log(`Serving storage from: ${localStoragePath}`, 'Bootstrap');

    // 2. Frontend static files
    if (staticPath && fs.existsSync(staticPath)) {
      app.useStaticAssets(staticPath);
      logger.log(`Serving frontend from: ${staticPath}`, 'Bootstrap');
    }

    // 3. SPA fallback — بعد الـ global prefix
    if (staticPath && fs.existsSync(staticPath)) {
      const indexPath = path.join(staticPath, 'index.html');
      const expressApp = app.getHttpAdapter().getInstance();
      expressApp.use((req: any, res: any, next: any) => {
        if (
          req.path.startsWith('/api') ||
          req.path.startsWith('/storage') ||
          req.path.includes('.')
        ) return next();
        if (fs.existsSync(indexPath)) res.sendFile(indexPath);
        else next();
      });
    }
  }

  app.enableCors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor());

  const port = process.env.PORT || 3001;
  const host = (isDesktop || process.env.ALLOW_NETWORK === 'true') ? '0.0.0.0' : 'localhost';
  await app.listen(port, host);
  logger.log(`Nabgha API running on http://${host}:${port}/api/v1`, 'Bootstrap');
}
bootstrap();
