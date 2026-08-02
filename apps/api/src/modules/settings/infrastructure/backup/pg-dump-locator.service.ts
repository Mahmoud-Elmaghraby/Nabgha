import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

@Injectable()
export class PgDumpLocatorService {
  private readonly logger = new Logger(PgDumpLocatorService.name);
  private cachedPath: string | null = null;

  async locate(): Promise<string | null> {
    if (this.cachedPath) return this.cachedPath;

    // 1) متغير بيئة صريح (لو اتظبط يدوياً أو من نسخة مستقبلية من الـ installer)
    if (process.env.PG_DUMP_PATH && fs.existsSync(process.env.PG_DUMP_PATH)) {
      this.cachedPath = process.env.PG_DUMP_PATH;
      return this.cachedPath;
    }

    // 2) لينكس/ماك: pg_dump غالباً على الـ PATH مباشرة (بيئة التطوير الحالية)
    if (process.platform !== 'win32') {
      try {
        await execFileAsync('pg_dump', ['--version']);
        this.cachedPath = 'pg_dump';
        return this.cachedPath;
      } catch {
        this.logger.warn('pg_dump not found on PATH (Linux/Mac)');
      }
    }

    // 3) ويندوز: نفس المسارات الثابتة اللي الـ installer نفسه بيدوّر فيها
    if (process.platform === 'win32') {
      for (const drive of ['C', 'D']) {
        for (let version = 18; version >= 12; version--) {
          const candidate = `${drive}:\\Program Files\\PostgreSQL\\${version}\\bin\\pg_dump.exe`;
          if (fs.existsSync(candidate)) {
            this.cachedPath = candidate;
            return this.cachedPath;
          }
        }
      }
    }

    this.logger.error('pg_dump could not be located on this system');
    return null;
  }
}
