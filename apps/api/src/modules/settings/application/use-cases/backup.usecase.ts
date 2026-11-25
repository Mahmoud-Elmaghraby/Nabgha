import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const archiver: any = require('archiver');
import { PgDumpLocatorService } from '../../infrastructure/backup/pg-dump-locator.service';
import { ModuleSettingsRepository } from '../../infrastructure/settings.repository';
import { AppError } from '../../../../core/errors/app.error';
import { isBackupAvailable } from '../../../../shared/infrastructure/guards/backup-availability.guard';

const execFileAsync = promisify(execFile);

const AUTO_BACKUP_SETTING_KEY = 'auto_backup_enabled';
const LAST_SUCCESS_KEY = 'backup_last_success_at';
const LAST_FAILURE_KEY = 'backup_last_failure_at';
const LAST_ERROR_KEY = 'backup_last_error';

/** النسخ التلقائية ليها اسم مختلف عشان التنضيف يلمسها هي بس (BACKUP-009) */
const AUTO_PREFIX = 'nabgha-backup-auto-';
const ANY_PREFIX = 'nabgha-backup-';
const MAX_AUTO_BACKUPS = 7;

/** نسخة تلقائية جديدة لو آخر نسخة ناجحة أقدم من كده (BACKUP-003) */
const AUTO_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** بعد فشل، مانحاولش تاني قبل الوقت ده (عشان التشغيل + الكرون مايعيدوش ورا بعض) */
const RETRY_AFTER_FAILURE_MS = 50 * 60 * 1000;
/** الواجهة بتعرض تنبيه لو مفيش نسخة ناجحة من المدة دي (BACKUP-007) */
export const BACKUP_STALE_AFTER_MS = 48 * 60 * 60 * 1000;
const VERIFY_TIMEOUT_MS = 10 * 60 * 1000;

export type BackupTrigger = 'manual' | 'scheduled';

export interface BackupStatus {
  available: boolean;
  autoEnabled: boolean;
  running: boolean;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
  /** آخر نسخة ناجحة أقدم من 48 ساعة، أو مفيش نسخة خالص وآخر محاولة فشلت */
  stale: boolean;
}

@Injectable()
export class BackupUseCase {
  private readonly logger = new Logger(BackupUseCase.name);
  /** منع نسختين في نفس الوقت (يدوي + تلقائي) — الـ API process واحد في الديسكتوب */
  private running = false;

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

  // ─── إنشاء نسخة ─────────────────────────────────────────────

  /**
   * ينشئ نسخة احتياطية كاملة (قاعدة بيانات + ملفات التخزين) في ملف zip واحد.
   * الترتيب: pg_dump ← فحص الـ dump (BACKUP-008) ← zip ← تسجيل النجاح.
   * أي فشل بيتسجّل في tenant_settings عشان يظهر للمستخدم (BACKUP-007).
   */
  async createBackup(tenantId: string, trigger: BackupTrigger): Promise<string> {
    // BACKUP-006: حماية تانية غير الـ guard — pg_dump بياخد قاعدة البيانات كلها (كل المراكز)
    if (!isBackupAvailable()) {
      throw AppError.forbidden('BACKUP_DESKTOP_ONLY', 'النسخ الاحتياطي من البرنامج متاح في نسخة الديسكتوب بس.');
    }
    if (this.running) {
      throw new AppError('BACKUP_IN_PROGRESS', 'فيه نسخة احتياطية شغالة دلوقتي. استنى دقيقة وجرّب تاني.', 409);
    }

    this.running = true;
    try {
      const zipFilePath = await this.runBackup(tenantId, trigger);
      await this.safeSet(tenantId, LAST_SUCCESS_KEY, new Date().toISOString());
      this.logger.log(`Backup created (${trigger}): ${zipFilePath}`);
      if (trigger === 'scheduled') this.cleanupOldBackups(this.getBackupsDir());
      return zipFilePath;
    } catch (err: any) {
      const message = String(err?.message ?? err).slice(0, 300);
      this.logger.error(`Backup failed (${trigger}): ${message}`);
      await this.safeSet(tenantId, LAST_FAILURE_KEY, new Date().toISOString());
      await this.safeSet(tenantId, LAST_ERROR_KEY, message);
      throw err instanceof AppError ? err : new AppError('BACKUP_FAILED', `فشل عمل النسخة الاحتياطية — السبب: ${message}`, 500);
    } finally {
      this.running = false;
    }
  }

  private async runBackup(tenantId: string, trigger: BackupTrigger): Promise<string> {
    const pgDumpPath = await this.pgDumpLocator.locate();
    if (!pgDumpPath) {
      throw new AppError('BACKUP_FAILED', 'تعذر العثور على أداة pg_dump على هذا الجهاز', 500);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupsDir = this.getBackupsDir();
    const dumpFilePath = path.join(backupsDir, `db-${timestamp}.dump`);
    const prefix = trigger === 'scheduled' ? AUTO_PREFIX : ANY_PREFIX;
    const zipFilePath = path.join(backupsDir, `${prefix}${timestamp}.zip`);

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
      try {
        await execFileAsync(
          pgDumpPath,
          ['-U', dbUser, '-h', dbHost, '-p', dbPort, '-d', dbName, '-F', 'c', '-f', dumpFilePath],
          {
            env: { ...process.env, PGPASSWORD: dbPassword },
            maxBuffer: 10 * 1024 * 1024,
            windowsHide: true,
            cwd: backupsDir,
          },
        );
      } catch (err: any) {
        // لو الملف نفسه مش قابل للتشغيل، نمسح المسار المحفوظ عشان المحاولة الجاية تدوّر على غيره
        if (err?.code === 'UNKNOWN' || err?.code === 'ENOENT' || err?.code === 'EACCES') {
          this.pgDumpLocator.resetCache();
        }
        // السبب الحقيقي بيجي في stderr (مثلاً: password authentication failed / invalid page / version mismatch)
        const stderr = String(err?.stderr ?? '').trim();
        const reason = (stderr || String(err?.message ?? '')).split('\n').filter(Boolean).slice(0, 3).join(' | ').slice(0, 300);
        this.logger.error(`pg_dump failed (path=${pgDumpPath}, user=${dbUser}, host=${dbHost}:${dbPort}, db=${dbName}, code=${err?.code ?? ''}): ${reason}`);
        throw new AppError('BACKUP_FAILED', `فشل أخذ نسخة قاعدة البيانات — السبب: ${reason}`, 500);
      }

      // 2) BACKUP-008: نتأكد إن الـ dump سليم قبل ما نعتبره نسخة
      const verification = await this.verifyDump(dumpFilePath, pgDumpPath);

      // 3) ضغط الـ dump + ملفات التخزين المحلية + manifest في zip واحد.
      // لو الضغط فشل، الـ zip الناقص بيتمسح عشان مايتحسبش نسخة.
      try {
        await this.zipBackup(zipFilePath, dumpFilePath, tenantId, trigger, verification);
      } catch (err) {
        fs.rmSync(zipFilePath, { force: true });
        throw err;
      }
      return zipFilePath;
    } finally {
      // الـ dump الخام (بيانات حساسة من غير ضغط) مايفضلش على القرص في أي حالة
      fs.rmSync(dumpFilePath, { force: true });
    }
  }

  /**
   * BACKUP-008: فحص الـ dump.
   * 1) أول 5 bytes لازم تبقى "PGDMP" (توقيع الـ custom format).
   * 2) pg_restore بيقرا الملف كله ويطلّع SQL على stdout (`-f -`، وبنرميه) — لو فيه أي جزء بايظ
   *    أو الملف ناقص، بيخرج بخطأ. ده نفس اللي هيحصل وقت الاسترجاع الحقيقي.
   * لو pg_restore مش موجود جنب pg_dump، بنكتفي بالتوقيع ونسجّل تحذير.
   */
  async verifyDump(dumpFilePath: string, pgDumpPath: string): Promise<'full' | 'header-only'> {
    const fd = fs.openSync(dumpFilePath, 'r');
    const header = Buffer.alloc(5);
    try {
      fs.readSync(fd, header, 0, 5, 0);
    } finally {
      fs.closeSync(fd);
    }
    if (header.toString('latin1') !== 'PGDMP') {
      throw new AppError('BACKUP_VERIFY_FAILED', 'ملف النسخة طالع بايظ (التوقيع غلط). النسخة اتلغت.', 500);
    }

    const pgRestorePath = pgDumpPath === 'pg_dump'
      ? 'pg_restore'
      : path.join(path.dirname(pgDumpPath), path.basename(pgDumpPath).replace(/pg_dump/i, 'pg_restore'));
    if (pgRestorePath !== 'pg_restore' && !fs.existsSync(pgRestorePath)) {
      this.logger.warn(`pg_restore not found next to pg_dump (${pgRestorePath}); header-only verification`);
      return 'header-only';
    }

    return new Promise((resolve, reject) => {
      let stderr = '';
      let settled = false;
      const child = spawn(pgRestorePath, ['-f', '-', dumpFilePath], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
      const timer = setTimeout(() => { child.kill(); }, VERIFY_TIMEOUT_MS);
      child.stderr.on('data', (d) => { if (stderr.length < 2000) stderr += String(d); });
      child.on('error', (err: any) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.logger.warn(`pg_restore not runnable (${pgRestorePath}): ${err?.code ?? err?.message}; header-only verification`);
        resolve('header-only');
      });
      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (code === 0) return resolve('full');
        const reason = stderr.split('\n').filter(Boolean).slice(0, 2).join(' | ').slice(0, 200) || `exit ${code}`;
        reject(new AppError('BACKUP_VERIFY_FAILED', `ملف النسخة طالع بايظ ومش هينفع يترجع — السبب: ${reason}`, 500));
      });
    });
  }

  private zipBackup(
    zipFilePath: string,
    dumpFilePath: string,
    tenantId: string,
    trigger: BackupTrigger,
    verification: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipFilePath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve());
      output.on('error', (err: Error) => reject(err));
      archive.on('error', (err: Error) => reject(err));
      archive.pipe(output);

      archive.file(dumpFilePath, { name: 'database.dump' });

      const storageDir = this.getStorageDir();
      if (fs.existsSync(storageDir)) {
        archive.directory(storageDir, 'storage');
      }

      // ملفات صندوق الوارد (فويس نوت وصور أولياء الأمور — WA-110)، في فولدر خاص برّا /storage
      const inboxMediaDir = process.env.INBOX_MEDIA_PATH
        ?? path.join(process.env.APPDATA ?? process.cwd(), 'Nabgha', 'inbox-media');
      if (fs.existsSync(inboxMediaDir)) {
        archive.directory(inboxMediaDir, 'inbox-media');
      }

      const manifest = JSON.stringify({
        createdAt: new Date().toISOString(),
        trigger,
        tenantId,
        verification,
      }, null, 2);
      archive.append(manifest, { name: 'manifest.json' });

      archive.finalize();
    });
  }

  /** BACKUP-009: التنضيف بيلمس النسخ التلقائية بس — اليدوية مابتتمسحش */
  private cleanupOldBackups(backupsDir: string): void {
    const files = fs.readdirSync(backupsDir)
      .filter((f) => f.startsWith(AUTO_PREFIX) && f.endsWith('.zip'))
      .map((f) => ({ name: f, time: fs.statSync(path.join(backupsDir, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);

    for (const file of files.slice(MAX_AUTO_BACKUPS)) {
      fs.rmSync(path.join(backupsDir, file.name), { force: true });
      this.logger.log(`Old backup cleaned up: ${file.name}`);
    }
  }

  // ─── النسخ التلقائي (BACKUP-002 / BACKUP-003) ───────────────

  /**
   * بيتنادى كل ساعة وبعد تشغيل البرنامج بشوية. بيعمل نسخة لو:
   * النسخ التلقائي مفعّل، ومفيش نسخة شغالة، وآخر نسخة ناجحة أقدم من 24 ساعة (أو مفيش)،
   * وآخر فشل مش من أقل من 50 دقيقة. كده الجهاز اللي بيتقفل بالليل بياخد نسخته أول ما يتفتح.
   */
  async runScheduledIfDue(tenantId: string, now = Date.now()): Promise<'created' | 'skipped'> {
    if (!isBackupAvailable() || this.running) return 'skipped';
    if (!(await this.getAutoBackupEnabled(tenantId))) return 'skipped';

    const lastSuccess = await this.getLastSuccessAt(tenantId);
    if (lastSuccess && now - lastSuccess.getTime() < AUTO_BACKUP_INTERVAL_MS) return 'skipped';

    const lastFailure = await this.moduleSettings.get(tenantId, LAST_FAILURE_KEY);
    if (lastFailure && now - new Date(lastFailure).getTime() < RETRY_AFTER_FAILURE_MS) return 'skipped';

    await this.createBackup(tenantId, 'scheduled');
    return 'created';
  }

  /** آخر نسخة ناجحة: من السجل، ولو مفيش سجل (عملاء قبل التحديث) من أحدث ملف نسخة */
  private async getLastSuccessAt(tenantId: string): Promise<Date | null> {
    const recorded = await this.moduleSettings.get(tenantId, LAST_SUCCESS_KEY);
    if (recorded) return new Date(recorded);
    const newest = this.listBackupFiles()[0];
    return newest ? new Date(newest.createdAt) : null;
  }

  // ─── الحالة والقايمة ────────────────────────────────────────

  async getStatus(tenantId: string, now = Date.now()): Promise<BackupStatus> {
    if (!isBackupAvailable()) {
      return { available: false, autoEnabled: false, running: false, lastSuccessAt: null, lastFailureAt: null, lastError: null, stale: false };
    }
    const [autoEnabled, lastSuccess, lastFailureAt, lastError] = await Promise.all([
      this.getAutoBackupEnabled(tenantId),
      this.getLastSuccessAt(tenantId),
      this.moduleSettings.get(tenantId, LAST_FAILURE_KEY),
      this.moduleSettings.get(tenantId, LAST_ERROR_KEY),
    ]);
    const failedAfterSuccess = !!lastFailureAt && (!lastSuccess || new Date(lastFailureAt) > lastSuccess);
    const stale = lastSuccess
      ? now - lastSuccess.getTime() > BACKUP_STALE_AFTER_MS
      : !!lastFailureAt;
    return {
      available: true,
      autoEnabled,
      running: this.running,
      lastSuccessAt: lastSuccess ? lastSuccess.toISOString() : null,
      lastFailureAt: failedAfterSuccess ? lastFailureAt : null,
      lastError: failedAfterSuccess ? lastError : null,
      stale,
    };
  }

  private listBackupFiles(): Array<{ filename: string; sizeBytes: number; createdAt: string; kind: 'auto' | 'manual' }> {
    const backupsDir = this.getBackupsDir();
    return fs.readdirSync(backupsDir)
      .filter((f) => f.startsWith(ANY_PREFIX) && f.endsWith('.zip'))
      .map((f) => {
        const stat = fs.statSync(path.join(backupsDir, f));
        return {
          filename: f,
          sizeBytes: stat.size,
          createdAt: stat.mtime.toISOString(),
          kind: f.startsWith(AUTO_PREFIX) ? 'auto' as const : 'manual' as const,
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listBackups() {
    return this.listBackupFiles();
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

  // ─── الإعداد ────────────────────────────────────────────────

  /**
   * BACKUP-002: مفعّل افتراضياً. لو المستخدم قفله بنفسه بيتسجّل 'false' وبنحترمه.
   * (قبل كده: مفيش قيمة = مقفول، فمعظم العملاء ماكانش عندهم نسخ خالص)
   */
  async getAutoBackupEnabled(tenantId: string): Promise<boolean> {
    const value = await this.moduleSettings.get(tenantId, AUTO_BACKUP_SETTING_KEY);
    return value !== 'false';
  }

  async setAutoBackupEnabled(tenantId: string, enabled: boolean): Promise<void> {
    await this.moduleSettings.set(tenantId, AUTO_BACKUP_SETTING_KEY, enabled ? 'true' : 'false');
  }

  /** تسجيل الحالة مايوقعش النسخة نفسها (مثلاً لو قاعدة البيانات هي اللي بايظة) */
  private async safeSet(tenantId: string, key: string, value: string): Promise<void> {
    try {
      await this.moduleSettings.set(tenantId, key, value);
    } catch (err: any) {
      this.logger.warn(`Could not record ${key}: ${err?.message}`);
    }
  }
}
