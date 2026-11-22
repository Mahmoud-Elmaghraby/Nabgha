import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const archiver: any = require('archiver');
import { PgDumpLocatorService } from '../../infrastructure/backup/pg-dump-locator.service';
import { ModuleSettingsRepository } from '../../infrastructure/settings.repository';
import { AppError } from '../../../../core/errors/app.error';

const execFileAsync = promisify(execFile);
const AUTO_BACKUP_SETTING_KEY = 'auto_backup_enabled';
const MAX_AUTO_BACKUPS = 7;

@Injectable()
export class BackupUseCase {
  private readonly logger = new Logger(BackupUseCase.name);

  constructor(
    private readonly pgDumpLocator: PgDumpLocatorService,
    private readonly moduleSettings: ModuleSettingsRepository,
  ) {}

  private getBackupsDir(): string {
    const baseDir = process.env.APPDATA ?? process.cwd();
    const dir = path.join(baseDir, 'Nabgha', 'backups');
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  private getStorageDir(): string {
    return process.env.STORAGE_LOCAL_PATH
      ?? path.join(process.env.APPDATA ?? process.cwd(), 'Nabgha', 'storage');
  }

  /** ينشئ نسخة احتياطية كاملة (قاعدة بيانات + ملفات التخزين) في ملف zip واحد */
  async createBackup(tenantId: string, trigger: 'manual' | 'scheduled'): Promise<string> {
    const pgDumpPath = await this.pgDumpLocator.locate();
    if (!pgDumpPath) {
      throw new AppError('BACKUP_FAILED', 'تعذر العثور على أداة pg_dump على هذا الجهاز', 500);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupsDir = this.getBackupsDir();
    const dumpFilePath = path.join(backupsDir, `db-${timestamp}.dump`);
    const zipFilePath = path.join(backupsDir, `nabgha-backup-${timestamp}.zip`);

    // 1) نسخة قاعدة البيانات (custom format — أضغط وأسرع في الاسترجاع لاحقاً)
    const databaseUrl = process.env.DATABASE_URL
      ?? 'postgresql://nabgha:nabgha123@127.0.0.1:5432/nabgha';

    // تفكيك الرابط لمكوناته وتمريرها كمعاملات منفصلة لـ pg_dump بدل الرابط الكامل
    // كمعامل واحد — تمرير الرابط الكامل عبر execFile كان بيفشل بخطأ "spawn UNKNOWN"
    // غامض على ويندوز، بينما نفس البيانات بمعاملات منفصلة (-U/-h/-d) شغالة 100%.
    // الباسورد بيتمرر عبر PGPASSWORD كـ environment variable بدل تضمينه في المعامل.
    const dbUrl = new URL(databaseUrl);
    const dbUser = decodeURIComponent(dbUrl.username);
    const dbPassword = decodeURIComponent(dbUrl.password);
    const dbHost = dbUrl.hostname;
    const dbPort = dbUrl.port || '5432';
    const dbName = dbUrl.pathname.replace(/^\//, '');

    try {
      await execFileAsync(
        pgDumpPath,
        ['-U', dbUser, '-h', dbHost, '-p', dbPort, '-d', dbName, '-F', 'c', '-f', dumpFilePath],
        { env: { ...process.env, PGPASSWORD: dbPassword }, maxBuffer: 10 * 1024 * 1024 },
      );
    } catch (err: any) {
      // السبب الحقيقي بيجي في stderr (مثلاً: password authentication failed / invalid page / version mismatch)
      const stderr = String(err?.stderr ?? '').trim();
      const reason = (stderr || String(err?.message ?? '')).split('\n').filter(Boolean).slice(0, 3).join(' | ').slice(0, 300);
      this.logger.error(`pg_dump failed (path=${pgDumpPath}, user=${dbUser}, host=${dbHost}:${dbPort}, db=${dbName}, code=${err?.code ?? ''}): ${reason}`);
      fs.rmSync(dumpFilePath, { force: true });
      throw new AppError('BACKUP_FAILED', `فشل أخذ نسخة قاعدة البيانات — السبب: ${reason}`, 500);
    }

    // 2) ضغط الـ dump + ملفات التخزين المحلية + manifest في zip واحد
    // ملاحظة: try/finally يضمن حذف ملف الـ dump الخام حتى لو فشل الضغط لأي سبب —
    // بدون كده، أي فشل بيسيب ملف dump كامل (بيانات حساسة) عالق على القرص بلا حماية.
    try {
      await this.zipBackup(zipFilePath, dumpFilePath, tenantId, trigger);
    } finally {
      fs.rmSync(dumpFilePath, { force: true });
    }

    this.logger.log(`Backup created (${trigger}): ${zipFilePath}`);

    if (trigger === 'scheduled') {
      await this.cleanupOldBackups(backupsDir);
    }

    return zipFilePath;
  }

  private zipBackup(zipFilePath: string, dumpFilePath: string, tenantId: string, trigger: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipFilePath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve());
      archive.on('error', (err: Error) => reject(err));
      archive.pipe(output);

      archive.file(dumpFilePath, { name: 'database.dump' });

      const storageDir = this.getStorageDir();
      if (fs.existsSync(storageDir)) {
        archive.directory(storageDir, 'storage');
      }

      const manifest = JSON.stringify({
        createdAt: new Date().toISOString(),
        trigger,
        tenantId,
      }, null, 2);
      archive.append(manifest, { name: 'manifest.json' });

      archive.finalize();
    });
  }

  private async cleanupOldBackups(backupsDir: string): Promise<void> {
    const files = fs.readdirSync(backupsDir)
      .filter((f) => f.startsWith('nabgha-backup-') && f.endsWith('.zip'))
      .map((f) => ({ name: f, time: fs.statSync(path.join(backupsDir, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);

    const toDelete = files.slice(MAX_AUTO_BACKUPS);
    for (const file of toDelete) {
      fs.rmSync(path.join(backupsDir, file.name), { force: true });
      this.logger.log(`Old backup cleaned up: ${file.name}`);
    }
  }

  async listBackups(): Promise<Array<{ filename: string; sizeBytes: number; createdAt: string }>> {
    const backupsDir = this.getBackupsDir();
    return fs.readdirSync(backupsDir)
      .filter((f) => f.endsWith('.zip'))
      .map((f) => {
        const stat = fs.statSync(path.join(backupsDir, f));
        return { filename: f, sizeBytes: stat.size, createdAt: stat.mtime.toISOString() };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getBackupFilePath(filename: string): string {
    // حماية من path traversal — الاسم لازم يكون بس اسم ملف بسيط، مش مسار
    if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
      throw new AppError('VALIDATION_ERROR', 'اسم ملف غير صالح', 400);
    }
    const fullPath = path.join(this.getBackupsDir(), filename);
    if (!fs.existsSync(fullPath)) {
      throw new AppError('NOT_FOUND', 'النسخة الاحتياطية غير موجودة', 404);
    }
    return fullPath;
  }

  async getAutoBackupEnabled(tenantId: string): Promise<boolean> {
    const value = await this.moduleSettings.get(tenantId, AUTO_BACKUP_SETTING_KEY);
    return value === 'true';
  }

  async setAutoBackupEnabled(tenantId: string, enabled: boolean): Promise<void> {
    await this.moduleSettings.set(tenantId, AUTO_BACKUP_SETTING_KEY, enabled ? 'true' : 'false');
  }
}