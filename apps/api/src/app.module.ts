import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { DatabaseModule } from './shared/infrastructure/database/database.module';
import { LoggingModule } from './core/logging/logging.module';
import { HealthModule } from './core/health/health.module';
import { GlobalExceptionFilter } from './core/errors/http-exception.filter';
import { ZodValidationFilter } from './core/errors/zod-validation.filter';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { WhatsAppModule } from './modules/whatsapp/whatsapp.module';
import { SettingsModule } from './modules/settings/settings.module';
import { SubjectsModule } from './modules/subjects/subjects.module';
import { TeachersModule } from './modules/teachers/teachers.module';
import { StudentsModule } from './modules/students/students.module';
import { GroupsModule } from './modules/groups/groups.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { FinanceModule } from './modules/finance/finance.module';
import { UploadModule } from './modules/upload/upload.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { PlatformModule } from './modules/platform/platform.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ParentPortalModule } from './modules/parent-portal/parent-portal.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        name: 'global',
        ttl: 60000,
        limit: process.env.NODE_ENV === 'production' ? 100 : 1000,
      },
      {
        name: 'auth',
        ttl: 60000,
        limit: process.env.NODE_ENV === 'production' ? 10 : 100,
      },
    ]),
    LoggingModule,
    DatabaseModule,
    HealthModule,
    AuthModule,
    UserModule,
    WhatsAppModule,
    SettingsModule,
    SubjectsModule,
    TeachersModule,
    StudentsModule,
    GroupsModule,
    SessionsModule,
    FinanceModule,
    UploadModule,
    TelegramModule,
    PlatformModule,
    ReportsModule,
    ParentPortalModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: ZodValidationFilter },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
