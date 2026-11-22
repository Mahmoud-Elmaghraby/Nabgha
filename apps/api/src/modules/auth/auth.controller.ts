import { Controller, Post, Body } from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AppError } from '../../core/errors/app.error';
import { z } from 'zod';

const LoginSchema = z.object({
  slug: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
});

const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const DesktopSetupSchema = z.object({
  centerName: z.string().trim().min(1, 'اسم المركز مطلوب').max(255),
  slug: z.string().trim().min(1).max(50).regex(/^[a-z0-9-]+$/, 'الـ slug يقبل حروف إنجليزية صغيرة وأرقام وشرطة فقط'),
  username: z.string().trim().min(1, 'اسم المستخدم مطلوب').max(100),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل').max(200),
});

const PlatformLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('setup/check')
  async checkSetup() {
    if (process.env.DEPLOY_MODE !== 'desktop') {
      return { success: true, data: { needsSetup: false } };
    }
    try {
      const count = await this.authService.checkDesktopSetup();
      return { success: true, data: { needsSetup: count === 0 } };
    } catch {
      return { success: true, data: { needsSetup: true } };
    }
  }

  @Post('setup/init')
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  async initSetup(@Body() body: any) {
    if (process.env.DEPLOY_MODE !== 'desktop') {
      throw new AppError('FORBIDDEN', 'غير مسموح', 403);
    }
    const parsed = DesktopSetupSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'بيانات غير صحيحة', 400);
    }
    await this.authService.initDesktopSetup(parsed.data);
    return { success: true };
  }

  @Post('login')
  @Throttle({ auth: { limit: 10, ttl: 60000 } })
  async login(@Body() body: any) {
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'بيانات غير صحيحة', 400);
    const data = await this.authService.tenantLogin(
      parsed.data.slug,
      parsed.data.username,
      parsed.data.password,
    );
    return { success: true, data };
  }

  @Post('platform/login')
  @Throttle({ auth: { limit: 10, ttl: 60000 } })
  async platformLogin(@Body() body: any) {
    const parsed = PlatformLoginSchema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'بيانات غير صحيحة', 400);
    const data = await this.authService.platformLogin(parsed.data.email, parsed.data.password);
    return { success: true, data };
  }

  @Post('refresh')
  @SkipThrottle()
  async refresh(@Body() body: any) {
    const parsed = RefreshSchema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'بيانات غير صحيحة', 400);
    const data = await this.authService.refreshToken(parsed.data.refreshToken);
    return { success: true, data };
  }

  @Post('logout')
  async logout() {
    return { success: true };
  }
}
