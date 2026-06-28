import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './core/errors/http-exception.filter';
import { TransformInterceptor } from './core/interceptors/transform.interceptor';
import { LoggingInterceptor } from './core/interceptors/logging.interceptor';
import { AppLogger } from './core/logging/logger.service';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import * as path from 'path';
import * as fs from 'fs';

async function bootstrap() {
  const isDesktop = process.env.DEPLOY_MODE === 'desktop';
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const logger = app.get(AppLogger);
  app.useLogger(logger);
  app.use(helmet({ contentSecurityPolicy: false }));

  // ÙÙŠ Desktop mode â€” Ù†Ø®Ø¯Ù… static files Ùˆnindex.html
  if (isDesktop && process.env.STATIC_PATH) {
    const staticPath = process.env.STATIC_PATH;
    if (fs.existsSync(staticPath)) {
      app.useStaticAssets(staticPath);
      logger.log("Serving static files from: " + staticPath, "Bootstrap");
    }
  }

  app.setGlobalPrefix("api/v1");
  if (isDesktop && process.env.STATIC_PATH) {
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.get("*", (req: any, res: any, next: any) => {
      if (req.path.startsWith("/api")) return next();
      const fs = require("fs");
      const indexPath = require("path").join(process.env.STATIC_PATH, "index.html");
      if (fs.existsSync(indexPath)) res.sendFile(indexPath);
      else next();
    });
  }

  app.enableCors({
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  });

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor());

  const port = process.env.PORT || 3001;
  const host = (isDesktop || process.env.ALLOW_NETWORK === "true") ? "0.0.0.0" : "localhost";
  await app.listen(port, host);
  logger.log("Nabgha API running on http://" + host + ":" + port + "/api/v1", "Bootstrap");
}
bootstrap();

