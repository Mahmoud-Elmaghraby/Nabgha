import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { AppError } from '../../core/errors/app.error';
import { ParentPortalAvailabilityGuard } from '../../shared/infrastructure/guards/parent-portal-availability.guard';
import { ParentJwtAuthGuard } from '../../shared/infrastructure/guards/jwt-auth.guard';
import type { ParentJwtPayload } from '../../shared/infrastructure/auth/jwt.strategy';
import { ParentPortalService } from './parent-portal.service';

const RequestOtpSchema = z.object({
  phone: z.string().min(8),
});

const VerifyOtpSchema = z.object({
  phone: z.string().min(8),
  code: z.string().min(4).max(8),
});

// كل الـ endpoints هنا محجوبة تلقائيًا في وضع Desktop عن طريق
// ParentPortalAvailabilityGuard — بوابة الأهالي محتاجة سيرفر مكشوف على
// الإنترنت، وده مش متاح/منطقي في نسخة Desktop اللي شغالة Offline جوه جهاز العميل.
@Controller('parent-portal/:slug')
@UseGuards(ParentPortalAvailabilityGuard)
export class ParentPortalController {
  constructor(private readonly parentPortalService: ParentPortalService) {}

  @Post('auth/request-otp')
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  async requestOtp(@Param('slug') slug: string, @Body() body: unknown) {
    const parsed = RequestOtpSchema.safeParse(body);
    if (!parsed.success) throw AppError.badRequest('VALIDATION_ERROR', 'بيانات غير صحيحة');
    const data = await this.parentPortalService.requestOtp(slug, parsed.data.phone);
    return { success: true, data };
  }

  @Post('auth/verify-otp')
  @Throttle({ auth: { limit: 10, ttl: 60000 } })
  async verifyOtp(@Param('slug') slug: string, @Body() body: unknown) {
    const parsed = VerifyOtpSchema.safeParse(body);
    if (!parsed.success) throw AppError.badRequest('VALIDATION_ERROR', 'بيانات غير صحيحة');
    const data = await this.parentPortalService.verifyOtp(slug, parsed.data.phone, parsed.data.code);
    return { success: true, data };
  }

  @Get('me')
  @UseGuards(ParentJwtAuthGuard)
  async me(@Req() req: { user: ParentJwtPayload }) {
    const { tenantId, studentIds } = req.user;
    const data = await this.parentPortalService.getMe(tenantId, studentIds);
    return { success: true, data };
  }

  @Get('students/:studentId')
  @UseGuards(ParentJwtAuthGuard)
  async getStudentDetail(@Req() req: { user: ParentJwtPayload }, @Param('studentId') studentId: string) {
    const { tenantId, studentIds } = req.user;
    // تحقق ملكية صريح: التوكن ممكن يحمل أكتر من طالب (أكتر من ابن لنفس الرقم)،
    // لازم نتأكد إن الـ studentId المطلوب فعلاً من ضمن أبناء ولي الأمر ده بالظبط
    // قبل ما نرجّع أي بيانات — مش بس نعتمد على وجود الطالب في المستأجر.
    if (!studentIds.includes(studentId)) {
      throw AppError.forbidden('NOT_YOUR_CHILD', 'غير مصرح لك بعرض بيانات هذا الطالب');
    }
    const data = await this.parentPortalService.getStudentDetail(tenantId, studentId);
    return { success: true, data };
  }
}
