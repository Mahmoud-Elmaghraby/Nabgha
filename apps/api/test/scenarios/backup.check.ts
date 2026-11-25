import 'reflect-metadata';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BackupAvailabilityGuard } from '../../src/shared/infrastructure/guards/backup-availability.guard';
import { BackupUseCase } from '../../src/modules/settings/application/use-cases/backup.usecase';
import { PgDumpLocatorService } from '../../src/modules/settings/infrastructure/backup/pg-dump-locator.service';

// اختبارات النسخ الاحتياطي (BACKUP-006 وما بعدها). محتاجة pg_dump على الـ PATH أو PG_DUMP_PATH.
let pass = 0, fail = 0;
const check = (n: string, c: boolean, x: any = '') => { if (c) { pass++; console.log('  ✅', n); } else { fail++; console.log('  ❌', n, x); } };
const errCode = (fn: () => any) => { try { fn(); return 'NO_ERROR'; } catch (e: any) { return `${e.code}/${e.statusCode}`; } };
const errCodeAsync = async (p: Promise<any>) => { try { await p; return 'NO_ERROR'; } catch (e: any) { return `${e.code}/${e.statusCode}`; } };

(async () => {
  const guard = new BackupAvailabilityGuard();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nabgha-backup-'));
  process.env.APPDATA = tmp;
  const host = (process.env.TEST_PG_HOST ?? '/tmp').startsWith('/') ? 'localhost' : process.env.TEST_PG_HOST!;
  const pw = process.env.TEST_PG_PASSWORD ? `:${encodeURIComponent(process.env.TEST_PG_PASSWORD)}` : '';
  process.env.DATABASE_URL = `postgresql://${process.env.TEST_PG_USER ?? 'postgres'}${pw}@${host}:${process.env.TEST_PG_PORT ?? 5544}/${process.env.TEST_PG_DB ?? 'nabtest'}`;
  const useCase = new BackupUseCase(new PgDumpLocatorService(), {} as any);
  const zips = () => fs.readdirSync(path.join(tmp, 'Nabgha', 'backups')).filter(f => f.endsWith('.zip'));

  console.log('— BACKUP-006: النسخ مقفول برّا الديسكتوب');
  for (const mode of ['saas', 'local', undefined]) {
    if (mode) process.env.DEPLOY_MODE = mode; else delete process.env.DEPLOY_MODE;
    check(`guard يرفض (DEPLOY_MODE=${mode ?? 'unset'})`, errCode(() => guard.canActivate({} as any)) === 'BACKUP_DESKTOP_ONLY/403', errCode(() => guard.canActivate({} as any)));
    check(`createBackup يرفض من غير ما يشغّل pg_dump (${mode ?? 'unset'})`, (await errCodeAsync(useCase.createBackup('t', 'manual'))) === 'BACKUP_DESKTOP_ONLY/403');
  }
  check('مفيش ولا ملف نسخة اتعمل', !fs.existsSync(path.join(tmp, 'Nabgha', 'backups')) || zips().length === 0);

  console.log('— الديسكتوب: النسخ شغال');
  process.env.DEPLOY_MODE = 'desktop';
  check('guard يسمح', guard.canActivate({} as any) === true);
  const zipPath = await useCase.createBackup('t', 'manual');
  const buf = fs.readFileSync(zipPath);
  check('ملف zip اتعمل', fs.existsSync(zipPath) && buf.length > 1000, buf.length);
  check('فيه database.dump و manifest.json', buf.includes('database.dump') && buf.includes('manifest.json'));
  check('ملف الـ dump الخام اتمسح', fs.readdirSync(path.dirname(zipPath)).every(f => !f.endsWith('.dump')));

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
