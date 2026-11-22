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
  async initSetup(@Body() body: any) {
    if (process.env.DEPLOY_MODE !== 'desktop') {
      throw new Error('Not allowed');
    }
    await this.authService.initDesktopSetup(body);
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
