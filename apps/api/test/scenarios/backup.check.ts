import 'reflect-metadata';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BackupAvailabilityGuard } from '../../src/shared/infrastructure/guards/backup-availability.guard';
import { BackupUseCase } from '../../src/modules/settings/application/use-cases/backup.usecase';
import { PgDumpLocatorService } from '../../src/modules/settings/infrastructure/backup/pg-dump-locator.service';

// اختبارات النسخ الاحتياطي (BACKUP-002 → BACKUP-009). محتاجة pg_dump و pg_restore على الـ PATH (أو PG_DUMP_PATH).
let pass = 0, fail = 0;
const check = (n: string, c: boolean, x: any = '') => { if (c) { pass++; console.log('  ✅', n); } else { fail++; console.log('  ❌', n, x); } };
const errCode = (fn: () => any) => { try { fn(); return 'NO_ERROR'; } catch (e: any) { return `${e.code}/${e.statusCode}`; } };
const errCodeAsync = async (p: Promise<any>) => { try { await p; return 'NO_ERROR'; } catch (e: any) { return `${e.code}/${e.statusCode}`; } };
const HOUR = 3600_000;

/** قراية ملف من جوّه zip بـ zlib بس (من الـ central directory، عشان archiver بيكتب الأحجام بعد البيانات) */
function readZipEntry(zip: Buffer, name: string): string | null {
  const zlib = require('zlib');
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) return null;
  let p = zip.readUInt32LE(eocd + 16);
  const count = zip.readUInt16LE(eocd + 10);
  for (let i = 0; i < count; i++) {
    const method = zip.readUInt16LE(p + 10), csize = zip.readUInt32LE(p + 20);
    const nlen = zip.readUInt16LE(p + 28), xlen = zip.readUInt16LE(p + 30), clen = zip.readUInt16LE(p + 32);
    const local = zip.readUInt32LE(p + 42), entry = zip.toString('utf8', p + 46, p + 46 + nlen);
    if (entry === name) {
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const data = zip.subarray(start, start + csize);
      return (method === 8 ? zlib.inflateRawSync(data) : data).toString('utf8');
    }
    p += 46 + nlen + xlen + clen;
  }
  return null;
}

/** tenant_settings في الذاكرة */
function memSettings() {
  const m = new Map<string, string>();
  return { map: m, get: async (_t: string, k: string) => m.get(k) ?? null, set: async (_t: string, k: string, v: string) => { m.set(k, v); } };
}

(async () => {
  const guard = new BackupAvailabilityGuard();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nabgha-backup-'));
  process.env.APPDATA = tmp;
  const dir = path.join(tmp, 'Nabgha', 'backups');
  const host = (process.env.TEST_PG_HOST ?? '/tmp').startsWith('/') ? 'localhost' : process.env.TEST_PG_HOST!;
  const pw = process.env.TEST_PG_PASSWORD ? `:${encodeURIComponent(process.env.TEST_PG_PASSWORD)}` : '';
  const goodUrl = `postgresql://${process.env.TEST_PG_USER ?? 'postgres'}${pw}@${host}:${process.env.TEST_PG_PORT ?? 5544}/${process.env.TEST_PG_DB ?? 'nabtest'}`;
  process.env.DATABASE_URL = goodUrl;
  const settings = memSettings();
  const useCase = new BackupUseCase(new PgDumpLocatorService(), settings as any);
  const zips = (prefix = 'nabgha-backup-') => fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.startsWith(prefix) && f.endsWith('.zip')) : [];
  const autoZips = () => zips('nabgha-backup-auto-');
  const wipe = () => { for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) fs.rmSync(path.join(dir, f)); settings.map.clear(); };

  console.log('— BACKUP-006: النسخ مقفول برّا الديسكتوب');
  for (const mode of ['saas', 'local', undefined]) {
    if (mode) process.env.DEPLOY_MODE = mode; else delete process.env.DEPLOY_MODE;
    check(`guard يرفض (DEPLOY_MODE=${mode ?? 'unset'})`, errCode(() => guard.canActivate({} as any)) === 'BACKUP_DESKTOP_ONLY/403', errCode(() => guard.canActivate({} as any)));
    check(`createBackup يرفض من غير ما يشغّل pg_dump (${mode ?? 'unset'})`, (await errCodeAsync(useCase.createBackup('t', 'manual'))) === 'BACKUP_DESKTOP_ONLY/403');
  }
  check('التلقائي مابيشتغلش برّا الديسكتوب', (await useCase.runScheduledIfDue('t')) === 'skipped');
  check('الحالة برّا الديسكتوب: available=false', (await useCase.getStatus('t')).available === false);
  check('مفيش ولا ملف نسخة اتعمل', zips().length === 0);

  process.env.DEPLOY_MODE = 'desktop';
  check('guard يسمح في الديسكتوب', guard.canActivate({} as any) === true);

  console.log('— BACKUP-002: مفعّل افتراضياً');
  check('مفيش قيمة متسجلة = مفعّل', (await useCase.getAutoBackupEnabled('t')) === true);
  await useCase.setAutoBackupEnabled('t', false);
  check('المستخدم قفله بنفسه = مقفول', (await useCase.getAutoBackupEnabled('t')) === false);
  check('ومابيعملش نسخة تلقائي', (await useCase.runScheduledIfDue('t')) === 'skipped' && autoZips().length === 0);
  await useCase.setAutoBackupEnabled('t', true);

  console.log('— BACKUP-003: بيلحق اللي فاته');
  wipe();
  const t0 = Date.now();
  check('أول تشغيل ومفيش نسخة → بيعمل نسخة', (await useCase.runScheduledIfDue('t', t0)) === 'created' && autoZips().length === 1, autoZips());
  check('بعدها على طول → مش بيكرر', (await useCase.runScheduledIfDue('t', t0 + HOUR)) === 'skipped' && autoZips().length === 1);
  check('بعد 23 ساعة → لسه', (await useCase.runScheduledIfDue('t', t0 + 23 * HOUR)) === 'skipped');
  check('بعد 25 ساعة (الجهاز كان مقفول) → نسخة جديدة', (await useCase.runScheduledIfDue('t', t0 + 25 * HOUR)) === 'created' && autoZips().length === 2);
  wipe();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'nabgha-backup-2026-01-01.zip'), 'old');
  check('عميل قديم عنده نسخة النهارده ومفيش سجل → مش بيكرر', (await useCase.runScheduledIfDue('t')) === 'skipped');

  console.log('— BACKUP-008: فحص النسخة');
  wipe();
  const zipPath = await useCase.createBackup('t', 'manual');
  const buf = fs.readFileSync(zipPath);
  const manifest = JSON.parse(readZipEntry(buf, 'manifest.json') ?? '{}');
  const dumpInZip = readZipEntry(buf, 'database.dump');
  check('نسخة يدوية اتعملت (zip فيه database.dump و manifest.json)', !!dumpInZip && manifest.trigger === 'manual');
  check('الـ dump اللي جوّه الـ zip سليم (PGDMP)', !!dumpInZip && dumpInZip.startsWith('PGDMP'));
  check('الـ manifest بيقول إنها اتفحصت بالكامل', manifest.verification === 'full', manifest);
  check('ملف الـ dump الخام اتمسح', fs.readdirSync(dir).every(f => !f.endsWith('.dump')));
  const bad = path.join(tmp, 'bad.dump');
  fs.writeFileSync(bad, 'this is not a dump');
  check('ملف مش dump → بيترفض', (await errCodeAsync(useCase.verifyDump(bad, 'pg_dump'))) === 'BACKUP_VERIFY_FAILED/500');
  const real = path.join(tmp, 'real.dump');
  const { execFileSync } = require('child_process');
  const u = new URL(goodUrl);
  execFileSync('pg_dump', ['-U', u.username, '-h', u.hostname, '-p', u.port, '-d', u.pathname.slice(1), '-F', 'c', '-f', real], { env: { ...process.env, PGPASSWORD: decodeURIComponent(u.password) } });
  check('dump سليم → full', (await useCase.verifyDump(real, 'pg_dump')) === 'full');
  const full = fs.readFileSync(real);
  fs.writeFileSync(real, full.subarray(0, Math.floor(full.length / 2)));
  check('dump مقطوع من النص (التوقيع سليم) → بيترفض', (await errCodeAsync(useCase.verifyDump(real, 'pg_dump'))) === 'BACKUP_VERIFY_FAILED/500');

  console.log('— BACKUP-007: الفشل بيظهر');
  wipe();
  process.env.DATABASE_URL = goodUrl.replace(/:(\d+)\//, ':1/');
  check('قاعدة بيانات مش واصلة → BACKUP_FAILED', (await errCodeAsync(useCase.createBackup('t', 'scheduled'))) === 'BACKUP_FAILED/500');
  let st = await useCase.getStatus('t');
  check('الحالة فيها آخر فشل والسبب', !!st.lastFailureAt && !!st.lastError && st.lastSuccessAt === null, st);
  check('مفيش نسخة قبل كده + فشل → stale', st.stale === true);
  check('مفيش zip ناقص ولا dump متساب', fs.readdirSync(dir).length === 0, fs.readdirSync(dir));
  check('مش بيعيد المحاولة قبل 50 دقيقة', (await useCase.runScheduledIfDue('t')) === 'skipped');
  process.env.DATABASE_URL = goodUrl;
  check('بعد ساعة بيحاول تاني وبينجح', (await useCase.runScheduledIfDue('t', Date.now() + HOUR)) === 'created');
  st = await useCase.getStatus('t');
  check('بعد النجاح: الفشل القديم مابيظهرش، ومش stale', st.lastFailureAt === null && st.lastError === null && !!st.lastSuccessAt && st.stale === false, st);
  check('بعد 3 أيام من غير نسخة → stale', (await useCase.getStatus('t', Date.now() + 72 * HOUR)).stale === true);

  console.log('— نسختين في نفس الوقت');
  const [a, b] = await Promise.all([errCodeAsync(useCase.createBackup('t', 'manual')), errCodeAsync(useCase.createBackup('t', 'manual'))]);
  check('واحدة بتنجح والتانية 409', [a, b].sort().join() === 'BACKUP_IN_PROGRESS/409,NO_ERROR', [a, b]);

  console.log('— BACKUP-009: التنضيف للتلقائي بس');
  wipe();
  fs.mkdirSync(dir, { recursive: true });
  for (let i = 0; i < 9; i++) {
    const f = path.join(dir, `nabgha-backup-auto-old-${i}.zip`);
    fs.writeFileSync(f, 'x');
    fs.utimesSync(f, new Date(Date.now() - (i + 2) * 24 * HOUR), new Date(Date.now() - (i + 2) * 24 * HOUR));
  }
  for (let i = 0; i < 2; i++) {
    const f = path.join(dir, `nabgha-backup-manual-${i}.zip`);
    fs.writeFileSync(f, 'x');
    fs.utimesSync(f, new Date(Date.now() - 30 * 24 * HOUR), new Date(Date.now() - 30 * 24 * HOUR));
  }
  check('نسخة تلقائية جديدة اتعملت', (await useCase.runScheduledIfDue('t')) === 'created');
  check('فاضل آخر 7 تلقائي', autoZips().length === 7, autoZips().length);
  check('النسخ اليدوية القديمة لسه موجودة', zips('nabgha-backup-manual-').length === 2);
  const list = await useCase.listBackups();
  check('القايمة بتفرّق بين تلقائي ويدوي', list.filter(x => x.kind === 'auto').length === 7 && list.filter(x => x.kind === 'manual').length === 2);

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
