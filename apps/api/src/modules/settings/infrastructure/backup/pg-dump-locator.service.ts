import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

@Injectable()
export class PgDumpLocatorService {
  private readonly logger = new Logger(PgDumpLocatorService.name);
  private cachedPath: string | null = null;

  /**
   * يتأكد إن الملف فعلاً بيشتغل (pg_dump --version) قبل ما نعتمده.
   * "spawn UNKNOWN" على ويندوز غالباً معناه إن الملف موجود لكن مش قابل للتشغيل
   * (تالف، محجوب، أو نسخة ناقصة من تثبيت قديم) — فبنتخطاه ونجرب اللي بعده.
   */
  private async isRunnable(candidate: string): Promise<boolean> {
    try {
      if (candidate !== 'pg_dump' && (!fs.existsSync(candidate) || fs.statSync(candidate).size === 0)) {
        return false;
      }
      await execFileAsync(candidate, ['--version'], { windowsHide: true, timeout: 10000 });
      return true;
    } catch (err: any) {
      this.logger.warn(`pg_dump candidate not runnable (${candidate}): ${err?.code ?? ''} ${err?.message ?? ''}`);
      return false;
    }
  }

  /** يمسح المسار المحفوظ — يُستدعى لو التشغيل الفعلي فشل عشان المحاولة الجاية تدوّر من جديد */
  resetCache(): void {
    this.cachedPath = null;
  }

  async locate(): Promise<string | null> {
    if (this.cachedPath) return this.cachedPath;

    // 1) متغير بيئة صريح (لو اتظبط يدوياً أو من نسخة مستقبلية من الـ installer)
    if (process.env.PG_DUMP_PATH && (await this.isRunnable(process.env.PG_DUMP_PATH))) {
      this.cachedPath = process.env.PG_DUMP_PATH;
      return this.cachedPath;
    }

    // 2) لينكس/ماك: pg_dump غالباً على الـ PATH مباشرة (بيئة التطوير الحالية)
    if (process.platform !== 'win32') {
      if (await this.isRunnable('pg_dump')) {
        this.cachedPath = 'pg_dump';
        return this.cachedPath;
      }
    }

    // 3) ويندوز: نفس المسارات الثابتة اللي الـ installer نفسه بيدوّر فيها
    // ملاحظة: بعض تثبيتات PostgreSQL بتخلي \bin\pg_dump.exe ملف فاضل (0 bytes) —
    // في الحالة دي بنتجاهله ونكمل الدوران على المسارات الأخرى.
    if (process.platform === 'win32') {
      for (const drive of ['C', 'D']) {
        for (let version = 18; version >= 12; version--) {
          // المسار الرئيسي: PostgreSQL\<version>\bin
          const candidate = `${drive}:\\Program Files\\PostgreSQL\\${version}\\bin\\pg_dump.exe`;
          if (await this.isRunnable(candidate)) {
            this.cachedPath = candidate;
            return this.cachedPath;
          }

          // المسار الاحتياطي: pgAdmin 4 runtime (بيتضمن نسخة شغالة من pg_dump)
          const pgAdminCandidate = `${drive}:\\Program Files\\PostgreSQL\\${version}\\pgAdmin 4\\runtime\\pg_dump.exe`;
          if (await this.isRunnable(pgAdminCandidate)) {
            this.cachedPath = pgAdminCandidate;
            return this.cachedPath;
          }
        }
      }
    }

    this.logger.error('pg_dump could not be located on this system');
    return null;
  }
}
