import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AppError } from '../../../core/errors/app.error';

/** النسخ الاحتياطي من جوّه البرنامج متاح في وضع Desktop بس. */
export function isBackupAvailable(): boolean {
  return process.env.DEPLOY_MODE === 'desktop';
}

/**
 * BACKUP-006: pg_dump بياخد قاعدة البيانات كلها، مش المركز بتاع اللي طالب النسخة بس.
 * على السيرفر (SaaS) ده معناه إن أي أدمن مركز — ومنهم حساب الديمو اللي بيتدّى للعملاء المحتملين —
 * كان يقدر ينزّل بيانات كل المراكز. فالنسخ من البرنامج مقفول في أي وضع غير Desktop،
 * والنسخ على السيرفر بيتعمل من إدارة السيرفر (DEPLOYMENT_RUNBOOK).
 * القايمة مسموحة (allowlist): لو DEPLOY_MODE مش متظبط، النسخ مقفول.
 */
@Injectable()
export class BackupAvailabilityGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    if (!isBackupAvailable()) {
      throw AppError.forbidden(
        'BACKUP_DESKTOP_ONLY',
        'النسخ الاحتياطي من البرنامج متاح في نسخة الديسكتوب بس. على السيرفر النسخ بيتعمل من إدارة السيرفر.',
      );
    }
    return true;
  }
}
