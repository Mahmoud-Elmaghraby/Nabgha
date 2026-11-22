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
import { ExamsModule }        from './modules/exams/exam.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      // حد عام لكل IP — الواجهة بتعمل طلبات كتير مع بعض (داشبورد، مسح QR متتالي)
      {
        name: 'global',
        ttl: 60000,
        limit: 600,
      },
      // ⚠️ في @nestjs/throttler v6 كل throttler هنا بيتطبق على **كل** المسارات، مش بس
      // اللي عليها @Throttle({ auth }). قبل كده الحد ده كان 10 طلبات/دقيقة في الـ production
      // لكل الـ API، فالبرنامج كان بيقف بعد كام ضغطة. الحد الفعلي لتسجيل الدخول والـ OTP
      // متحدد على مساراتها بـ @Throttle({ auth: { limit: ... } })، وهنا رقم عالي بس.
      {
        name: 'auth',
        ttl: 60000,
        limit: 1000,
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
    ExamsModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: ZodValidationFilter },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
