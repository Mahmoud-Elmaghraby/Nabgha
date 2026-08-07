import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AppError } from '../../../core/errors/app.error';

/**
 * بوابة أولياء الأمور محتاجة سيرفر مكشوف على الإنترنت عشان ولي الأمر يوصله
 * من برّه — ده أصلاً بيتعارض مع فلسفة وضع Desktop اللي مصمم يشتغل Offline
 * جوه جهاز العميل، ومفيش أي معنى (ولا أمان) نفتح بورت عليه من النت.
 * الگارد ده بيتطبّق على كل الـ controller بتاع بوابة الأهالي فيرفض أي
 * طلب طالما DEPLOY_MODE=desktop، قبل حتى ما يوصل لأي منطق تاني.
 */
@Injectable()
export class ParentPortalAvailabilityGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    if (process.env.DEPLOY_MODE === 'desktop') {
      throw AppError.notFound('NOT_AVAILABLE', 'بوابة أولياء الأمور غير متاحة في هذا الوضع');
    }
    return true;
  }
}
