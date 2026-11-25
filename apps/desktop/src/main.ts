import { app, BrowserWindow, Tray, Menu, nativeImage, clipboard, ipcMain, shell, dialog } from 'electron';
import * as path from 'path';
import * as http from 'http';
import * as os from 'os';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { buildSplashHtml, SPLASH_WIDTH, SPLASH_HEIGHT } from './splash';

// ── سجل التشغيل في ملف ─────────────────────────────────────────
// قبل كده كل اللوج (Electron + API + migrations) كان على الكونسول بس، فلو البرنامج قفل عند
// عميل مكانش فيه أي طريقة نعرف السبب. دلوقتي بيتكتب في %APPDATA%\نبغة\logs\nabgha.log
// (آخر ~5 ميجا، والقديم بيتنقل لـ nabgha.old.log).
const LOG_DIR = path.join(app.getPath('userData'), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'nabgha.log');
try {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > 5 * 1024 * 1024) {
    fs.renameSync(LOG_FILE, path.join(LOG_DIR, 'nabgha.old.log'));
  }
} catch { /* اللوج مش لازم يوقف البرنامج */ }
function writeLog(level: string, args: unknown[]): void {
  const line = `${new Date().toISOString()} [${level}] ${args.map((a) => (a instanceof Error ? a.stack ?? a.message : typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}\n`;
  try { fs.appendFileSync(LOG_FILE, line); } catch { /* ignore */ }
}
for (const level of ['log', 'warn', 'error'] as const) {
  const original = console[level].bind(console);
  console[level] = (...args: unknown[]) => { writeLog(level.toUpperCase(), args); original(...args); };
}
process.on('uncaughtException', (err) => console.error('[Main] uncaughtException:', err));
process.on('unhandledRejection', (err) => console.error('[Main] unhandledRejection:', err));

/** ملفات assets جوّه البرنامج (بتشتغل من app.asar في النسخة المتسطبة) */
function assetPath(name: string): string {
  return path.join(__dirname, '..', 'assets', name);
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let apiProcess: ChildProcess | null = null;
let isQuitting = false;
let apiRestarts: number[] = [];

const API_PORT = 3001;
const IS_PACKAGED = app.isPackaged;
const RESOURCES = IS_PACKAGED ? process.resourcesPath : path.join(__dirname, '..', '..');

const API_ENTRY   = IS_PACKAGED
  ? path.join(RESOURCES, 'api', 'dist', 'main.js')
  : path.join(__dirname, '..', '..', 'api', 'dist', 'main.js');

const STATIC_PATH = IS_PACKAGED
  ? path.join(RESOURCES, 'web', 'dist')
  : path.join(__dirname, '..', '..', 'web', 'dist');

const STORAGE_PATH = path.join(app.getPath('userData'), 'storage');

const DB_PATH = IS_PACKAGED
  ? path.join(RESOURCES, 'db')
  : path.join(__dirname, '..', '..', '..', 'packages', 'db');

// مسار Chromium الحقيقي بتاع Puppeteer داخل المشروع نفسه — مش الـ cache الخاص
// بأي مستخدم على الجهاز. من غير ده، أول تشغيل بيفشل بصمت لأن Puppeteer بيدوّر
// على Chromium في C:\Users\{اسم المستخدم}\.cache\puppeteer وهو مش موجود هناك.
const PUPPETEER_CACHE_PATH = IS_PACKAGED
  ? path.join(RESOURCES, 'api', 'node_modules', 'puppeteer', '.local-chromium')
  : path.join(__dirname, '..', '..', 'api', 'node_modules', 'puppeteer', '.local-chromium');

// اكتشاف مسار Node.js الحقيقي — بحث في المسارات الثابتة الشائعة أولاً (نفس قائمة
// الـ installer)، و"where node" كملاذ أخير. لو محدش موجود، نرمي خطأ واضح بدل ما
// نسيب fallback قديم كان بيستبدل "electron.exe" بـ "node.exe" في مسار البرنامج
// نفسه — وده كان بيفشل بصمت على أي تطبيق مُجمّع اسمه مش فيه كلمة "electron"
// (زي "نبغة.exe")، فكان بيحاول يشغّل نبغة نفسها كأنها Node.js، وده سبب ظهور
// نافذة بيضة ثانية عالقة عند بعض العملاء.
function findNodePath(): string {
  const knownPaths = [
    path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'nodejs', 'node.exe'),
    'C:\\Program Files\\nodejs\\node.exe',
    'C:\\nvm4w\\nodejs\\node.exe',
  ];
  for (const p of knownPaths) {
    if (fs.existsSync(p)) return p;
  }

  try {
    const { execSync } = require('child_process');
    const cmd = process.platform === 'win32' ? 'where node' : 'which node';
    const result = execSync(cmd).toString().trim().split('\n')[0].trim();
    if (result && fs.existsSync(result)) return result;
  } catch {
    // تجاهل — هنرمي خطأ واضح تحت بدل fallback هش
  }

  throw new Error('لم يتم العثور على Node.js على هذا الجهاز — تثبيت نبغة غير مكتمل');
}

// كروت الشبكة الافتراضية (VPN, VMware, VirtualBox, Docker/WSL, Hyper-V) بتاخد IP
// خاص بيها من غير أي وصول حقيقي للشبكة اللي باقي الأجهزة عليها — الكود القديم كان
// بياخد أول كارت IPv4 غير داخلي يلاقيه من غير أي فلترة، فلو الجهاز فيه كارت افتراضي
// كان ممكن يطلع IP مش قابل للوصول خالص من موبايل/تابلت على نفس الشبكة (نفس المنطق
// المستخدم في apps/api/src/core/health/health.controller.ts).
const VIRTUAL_ADAPTER_PATTERN = /virtualbox|vmware|vmnet|hyper-v|virtual|docker|wsl|npcap|tap-?windows|\btun\b|\bppp\b|bluetooth|isatap|loopback|vethernet/i;
const PHYSICAL_ADAPTER_HINT = /wi-?fi|wireless|ethernet|local area connection|lan\b/i;

function getLanIP(): string {
  const interfaces = os.networkInterfaces();
  const candidates: { name: string; address: string }[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        candidates.push({ name, address: iface.address });
      }
    }
  }
  if (candidates.length === 0) return 'localhost';

  const real = candidates.filter((c) => !VIRTUAL_ADAPTER_PATTERN.test(c.name));
  const pool = real.length > 0 ? real : candidates;
  const preferred = pool.find((c) => PHYSICAL_ADAPTER_HINT.test(c.name));
  return (preferred ?? pool[0]).address;
}

function waitForAPI(retries = 60): Promise<void> {
  return new Promise((resolve, reject) => {
    const check = (n: number) => {
      http.get(`http://localhost:${API_PORT}/api/v1/health`, (res) => {
        if (res.statusCode === 200) resolve();
        else if (n > 0) setTimeout(() => check(n - 1), 1000);
        else reject(new Error('API timeout'));
      }).on('error', () => {
        if (n > 0) setTimeout(() => check(n - 1), 1000);
        else reject(new Error('API not available'));
      });
    };
    check(retries);
  });
}

/**
 * يقتل أي process تستخدم البورت المحدد قبل التشغيل —
 * أكثر موثوقية من waitForPortFree لأننا نحرر البورت بنشاط
 * بدل الانتظار السلبي الذي كان يعاني من race condition
 * بين server.close() و resolve() على ويندوز.
 */
function killPortUser(port: number): Promise<void> {
  return new Promise<void>((resolve) => {
    if (process.platform !== 'win32') {
      try { require('child_process').execSync(`fuser -k ${port}/tcp`, { stdio: 'ignore' }); } catch {}
      return setTimeout(resolve, 500);
    }

    try {
      const { execSync } = require('child_process');
      const raw = execSync('netstat -ano').toString();
      const pids = new Set<string>();

      for (const line of raw.split('\n')) {
        // نمسك أي LISTENING على البورت بغض النظر عن الـ address —
        // سواء كان 0.0.0.0 أو 127.0.0.1 أو [::] — كلهم بيمنعوا bind جديد.
        // `:${port} ` مع مسافة بعد الرقم يمنع التطابق الخاطئ مع :30010 مثلاً.
        if (line.includes(`:${port} `) && line.includes('LISTENING')) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && !isNaN(Number(pid)) && Number(pid) > 0) pids.add(pid);
        }
      }

      for (const pid of pids) {
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
          console.log(`[Port] Terminated stale PID ${pid} holding port ${port}`);
        } catch {}
      }
    } catch (err: any) {
      console.warn('[Port] Could not inspect port users:', err?.message);
    }

    // نستنّى لحد ما الـ OS يحرر البورت فعلاً بعد الـ kill
    setTimeout(resolve, 800);
  });
}

function startAPI(): Promise<void> {
  // تنظيف البورت أوّلاً في كل مرة — سواء كانت بداية أولى أو إعادة تشغيل
  // وضعناه هنا جوّا startAPI نفسها بدل الاعتماد على استدعاءات خارجية
  // عشان نضمن إن الـ kill يحصل مباشرة قبل الـ spawn في كل حالة
  return killPortUser(API_PORT).then(() => new Promise<void>((resolve, reject) => {
    let nodePath: string;
    try {
      nodePath = findNodePath();
    } catch (err) {
      return reject(err);
    }

    const dbUrl = process.env.DATABASE_URL ?? 'postgresql://nabgha:nabgha123@127.0.0.1:5432/nabgha';
    const staticPath = process.env.STATIC_PATH ?? STATIC_PATH;

    const env = {
      ...process.env,
      PORT: String(API_PORT),
      DEPLOY_MODE: 'desktop',
      STATIC_PATH: staticPath,
      STORAGE_LOCAL_PATH: STORAGE_PATH,
      STORAGE_PROVIDER: 'local',
      ALLOW_NETWORK: 'true',
      MULTI_TENANT: 'true',
      JWT_SECRET: 'nabgha-desktop-jwt-2026',
      PLATFORM_JWT_SECRET: 'nabgha-platform-jwt-2026',
      DATABASE_URL: dbUrl,
      DOTENV_DISABLED: 'true',
      DB_MIGRATIONS_PATH: path.join(DB_PATH, 'src', 'migrations'),
      PUPPETEER_CACHE_DIR: PUPPETEER_CACHE_PATH,
    };

    apiProcess = spawn(nodePath, [API_ENTRY], {
      env,
      cwd: path.dirname(API_ENTRY),
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    apiProcess.stdout?.on('data', (data: Buffer) => {
      console.log('[API]', data.toString().trim());
    });

    apiProcess.stderr?.on('data', (data: Buffer) => {
      console.error('[API ERR]', data.toString().trim());
    });

    apiProcess.on('exit', (code) => {
      console.log(`[API] exited with code ${code}`);
      if (isQuitting) return;
      // إعادة تشغيل تلقائي، بس بحد: لو وقع 5 مرات في دقيقة يبقى فيه مشكلة حقيقية (مش هنفضل في لفّة)
      const now = Date.now();
      apiRestarts = apiRestarts.filter((t) => now - t < 60_000);
      apiRestarts.push(now);
      if (apiRestarts.length > 5) {
        console.error('[API] crashed 5 times in a minute — not restarting');
        dialog.showErrorBox('نبغة', `الخادم الداخلي للبرنامج بيقف بشكل متكرر.\nاقفل البرنامج وافتحه تاني، ولو المشكلة فضلت كلّم الدعم الفني وابعتلهم ملف:\n${LOG_FILE}`);
        return;
      }
      setTimeout(() => { startAPI().catch((err) => console.error('[API] restart failed:', err)); }, 2000);
    });

    apiProcess.on('error', (err) => { reject(err); });
    setTimeout(() => resolve(), 1000);
  }));
}

function runMigrations(): Promise<void> {
  return new Promise((resolve, reject) => {
    const migrateScript = IS_PACKAGED
      ? path.join(RESOURCES, 'db', 'src', 'migrate.js')
      : path.join(DB_PATH, 'src', 'migrate.js');

    if (!fs.existsSync(migrateScript)) {
      console.log('[Migrate] Script not found — skipping');
      return resolve();
    }

    let nodePath: string;
    try {
      nodePath = findNodePath();
    } catch (err) {
      return reject(err as Error);
    }

    const dbUrl = process.env.DATABASE_URL ?? 'postgresql://nabgha:nabgha123@127.0.0.1:5432/nabgha';
    const env = { ...process.env, DATABASE_URL: dbUrl, DOTENV_DISABLED: 'true' };

    const proc = spawn(nodePath, [migrateScript], {
      env,
      cwd: path.dirname(migrateScript),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    proc.stdout?.on('data', (d: Buffer) => console.log('[Migrate]', d.toString().trim()));
    proc.stderr?.on('data', (d: Buffer) => console.error('[Migrate ERR]', d.toString().trim()));
    proc.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`Migration failed: ${code}`)));
    proc.on('error', reject);
  });
}

function createTray() {
  // قبل كده كان بيدوّر على assets/icon.png في resources، والملف ده مش موجود أصلاً،
  // فأيقونة التراي كانت بتطلع فاضية. الأيقونة الموجودة icon.ico جوّه البرنامج.
  const iconPath = [assetPath('icon.png'), assetPath('icon.ico')].find((p) => fs.existsSync(p)) ?? assetPath('icon.ico');

  const icon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath)
    : nativeImage.createEmpty();

  tray = new Tray(icon);
  const lanIP = getLanIP();

  const menu = Menu.buildFromTemplate([
    { label: 'نبغة — إدارة الدروس الخصوصية', enabled: false },
    { type: 'separator' },
    { label: `الشبكة: http://${lanIP}:${API_PORT}`, enabled: false },
    { type: 'separator' },
    { label: 'فتح البرنامج', click: () => mainWindow?.show() },
    {
      label: 'نسخ رابط الشبكة',
      click: () => clipboard.writeText(`http://${lanIP}:${API_PORT}`),
    },
    { type: 'separator' },
    {
      label: 'إغلاق نبغة',
      click: () => { isQuitting = true; app.quit(); },
    },
  ]);

  tray.setToolTip(`نبغة — http://${lanIP}:${API_PORT}`);
  tray.setContextMenu(menu);
  tray.on('double-click', () => mainWindow?.show());
}

/**
 * شاشة التحميل (splash.ts): اللوجو + الاسم + شريط تقدّم. بتفضل ظاهرة لحد ما الشاشة الرئيسية
 * تترسم فعلاً — قبل كده كانت بتتقفل الأول، فكان فيه لحظة مفيش فيها أي شباك ("بيقوم ويقفل")
 * وبعدين شباك أخضر فاضي لحد ما الواجهة تحمّل.
 */
function createSplashWindow(): BrowserWindow {
  let mark = '';
  try {
    mark = `data:image/png;base64,${fs.readFileSync(assetPath('splash-mark.png')).toString('base64')}`;
  } catch (err) {
    console.warn('[Splash] logo not found:', (err as Error).message);
  }
  // transparent:true مش موثوق على وندوز (بيطلع مربع أبيض مع بعض كروت الشاشة)، فالخلفية لون ثابت
  const splash = new BrowserWindow({
    width: SPLASH_WIDTH, height: SPLASH_HEIGHT,
    frame: false, resizable: false, movable: true, center: true,
    skipTaskbar: false, alwaysOnTop: false,
    backgroundColor: '#0E3B2E',
    title: 'نبغة',
    icon: assetPath('icon.ico'),
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  splash.once('ready-to-show', () => splash.show());
  splashLoaded.set(splash, new Promise<void>((resolve) => splash.webContents.once('did-finish-load', () => resolve())));
  splash.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildSplashHtml(mark, app.getVersion()))}`);
  return splash;
}

/** الحالة بتتكتب بعد ما شاشة التحميل تخلص تحميل (مش قبلها فتضيع) */
const splashLoaded = new WeakMap<BrowserWindow, Promise<void>>();
function runInSplash(splash: BrowserWindow, js: string): void {
  if (splash.isDestroyed()) return;
  (splashLoaded.get(splash) ?? Promise.resolve())
    .then(() => { if (!splash.isDestroyed()) return splash.webContents.executeJavaScript(js); })
    .catch(() => {});
}

const STARTUP_STEPS = 4;
function setSplashStatus(splash: BrowserWindow, text: string, step: number): void {
  runInSplash(splash, `window.setStatus && window.setStatus(${JSON.stringify(text)}, ${step}, ${STARTUP_STEPS})`);
}

function createMainWindow(): BrowserWindow {
  const PRELOAD_PATH = IS_PACKAGED
    ? path.join(RESOURCES, 'app.asar', 'dist', 'preload.js')
    : path.join(__dirname, 'preload.js');

  mainWindow = new BrowserWindow({
    width: 1280, height: 800,
    minWidth: 960, minHeight: 600,
    // مخفي لحد ما الواجهة تترسم فعلاً (waitForAppRendered) — مفيش شاشة خضرا فاضية
    show: false,
    title: 'نبغة',
    icon: assetPath('icon.ico'),
    autoHideMenuBar: true,
    backgroundColor: '#F7F7F7',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: PRELOAD_PATH,
    },
  });

  mainWindow.loadURL(`http://localhost:${API_PORT}`).catch((err) => console.error('[Main] loadURL failed:', err));

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });
  return mainWindow;
}

/**
 * بيستنى لحد ما React يرسم الواجهة (index.html فيه #nabgha-boot جوّه #root، وReact بيشيله أول ما يرسم).
 * أقصى حاجة 20 ثانية وبعدين بيظهر الشباك على أي حال.
 */
async function waitForAppRendered(win: BrowserWindow, timeoutMs = 20_000): Promise<void> {
  const started = Date.now();
  while (!win.isDestroyed() && Date.now() - started < timeoutMs) {
    try {
      const ready = await win.webContents.executeJavaScript(
        `(() => { const r = document.getElementById('root'); return !!r && r.children.length > 0 && !document.getElementById('nabgha-boot'); })()`,
      );
      if (ready) return;
    } catch { /* الصفحة لسه بتحمّل */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  console.warn('[Main] app did not report rendered in time — showing anyway');
}

// ── IPC: Get Printers ─────────────────────────────────────────
ipcMain.handle('get-printers', async () => {
  const { execSync } = require('child_process');
  try {
    const output = execSync('wmic printer get name,default /format:list')
      .toString()
      .trim();

    const printers: any[] = [];
    const blocks = output.split('\r\n\r\n').filter((b: string) => b.trim());

    for (const block of blocks) {
      const lines = block.split('\r\n');
      const nameLine = lines.find((l: string) => l.startsWith('Name='));
      const defaultLine = lines.find((l: string) => l.startsWith('Default='));
      if (nameLine) {
        const name = nameLine.replace('Name=', '').trim();
        const isDefault = (defaultLine || '').replace('Default=', '').trim().toLowerCase() === 'true';
        if (name) printers.push({ name, displayName: name, isDefault });
      }
    }
    return printers;
  } catch {
    return [];
  }
});
// ── IPC: Print Labels ─────────────────────────────────────────
ipcMain.handle(
  'print-labels',
  async (
    _event,
    options: { deviceName?: string; images?: string[]; labelWidthMm?: number; labelHeightMm?: number; silent?: boolean } = {}
  ) => {
    const { deviceName = '', images = [], labelWidthMm = 38, labelHeightMm = 25, silent = false } = options;
    console.log(`[Print] Received ${images.length} images, printer: "${deviceName}", size: ${labelWidthMm}x${labelHeightMm}mm, silent: ${silent}`);

    if (images.length === 0) {
      console.log('[Print] No images — aborting');
      return { success: false, errorType: 'no-images' };
    }

    const labelsHtml = images
      .map(
        (src) =>
          `<div class="label"><img src="${src}" /></div>`
      )
      .join('\n');

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page {
    size: ${labelWidthMm}mm ${labelHeightMm}mm;
    margin: 0;
  }
  html, body {
    margin: 0;
    padding: 0;
    width: ${labelWidthMm}mm;
    background: white;
  }
  .label {
    width: ${labelWidthMm}mm;
    height: ${labelHeightMm}mm;
    page-break-after: always;
    page-break-inside: avoid;
    overflow: hidden;
    position: relative;
  }
  .label:last-child {
    page-break-after: auto;
  }
  .label img {
    position: absolute;
    top: 0;
    left: 0;
    width: ${labelWidthMm}mm;
    height: ${labelHeightMm}mm;
    object-fit: fill;
  }
</style>
</head>
<body>${labelsHtml}</body>
</html>`;

    const tmpDir = app.getPath('temp');
    const tmpHtml = path.join(tmpDir, `nabgha-labels-${Date.now()}.html`);
    fs.writeFileSync(tmpHtml, html, 'utf-8');

    const pxPerMm = 96 / 25.4;
    const printWin = new BrowserWindow({
      show: false,
      width: Math.ceil(labelWidthMm * pxPerMm) + 20,
      height: Math.ceil(labelHeightMm * pxPerMm) + 20,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    await printWin.loadFile(tmpHtml);
    console.log('[Print] Loaded HTML in hidden window');

    await printWin.webContents.executeJavaScript(`
      new Promise(resolve => {
        const imgs = document.querySelectorAll('img');
        let loaded = 0;
        if (imgs.length === 0) return resolve();
        imgs.forEach(img => {
          if (img.complete) { loaded++; if (loaded === imgs.length) resolve(); }
          else { img.onload = () => { loaded++; if (loaded === imgs.length) resolve(); }; }
        });
        setTimeout(resolve, 3000);
      })
    `);
    console.log('[Print] All images loaded');

    const widthMicrons = labelWidthMm * 1000;
    const heightMicrons = labelHeightMm * 1000;

    if (silent && deviceName) {
      return new Promise((resolve) => {
        console.log(`[Print] Silent print to "${deviceName}"...`);
        printWin.webContents.print(
          {
            silent: true,
            printBackground: true,
            deviceName,
            pageSize: { width: widthMicrons, height: heightMicrons },
            margins: { marginType: 'none' },
            scaleFactor: 100,
          },
          (success, errorType) => {
            console.log(`[Print] Silent result: success=${success}, error=${errorType || 'none'}`);
            printWin.close();
            try { fs.unlinkSync(tmpHtml); } catch {}
            resolve({ success, errorType });
          }
        );
      });
    }

    try {
      const pdfData = await printWin.webContents.printToPDF({
        landscape: false,
        printBackground: true,
        pageSize: { width: widthMicrons, height: heightMicrons },
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      });

      const pdfPath = path.join(tmpDir, `nabgha-labels-${Date.now()}.pdf`);
      fs.writeFileSync(pdfPath, pdfData);
      console.log(`[Print] PDF saved: ${pdfPath} (${pdfData.length} bytes)`);

      printWin.close();
      try { fs.unlinkSync(tmpHtml); } catch {}

      await shell.openPath(pdfPath);
      console.log('[Print] PDF opened for printing');

      return { success: true, pdfPath };
    } catch (err: any) {
      console.error('[Print] PDF generation failed:', err);
      printWin.close();
      try { fs.unlinkSync(tmpHtml); } catch {}
      return { success: false, errorType: err?.message || 'pdf-error' };
    }
  }
);

// ── Single Instance Lock ───────────────────────────────────────
// لو النسخة دي تانية (المستخدم داس على الأيقونة مرتين مثلاً)، تقفل على طول ومتعملش أي حاجة.
// قبل كده app.quit() كان بيتنادى بس الكود كان بيكمل: النسخة التانية كانت بتفتح شاشة تحميل،
// وتشغّل migrations، و**تقتل سيرفر النسخة الأولى** (killPortUser) قبل ما تقفل.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  console.log('[App] Another instance is already running — quitting.');
  app.exit(0);
} else {
  app.on('second-instance', () => {
    // لو المستخدم حاول يفتح نبغة تاني وهي شغّالة
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    app.setAppUserModelId('com.nabgha.desktop');
    console.log(`[App] starting v${app.getVersion()} — log: ${LOG_FILE}`);
    createTray();
    void startup(createSplashWindow());
  });
}

/** تسلسل التشغيل. لو حاجة فشلت: رسالة واضحة + إعادة المحاولة، بدل ما البرنامج يقفل من غير ولا كلمة */
async function startup(splash: BrowserWindow): Promise<void> {
  try {
    setSplashStatus(splash, 'جاري تجهيز قاعدة البيانات…', 1);
    await runMigrations();

    setSplashStatus(splash, 'جاري تشغيل الخادم…', 2);
    // نقتل أي API قديمة من run سابقة قبل ما نبدأ — يحمي من EADDRINUSE
    await killPortUser(API_PORT);
    await startAPI();

    setSplashStatus(splash, 'جاري الاتصال…', 3);
    await waitForAPI(90);

    setSplashStatus(splash, 'جاري فتح البرنامج…', 4);
    const win = createMainWindow();
    await waitForAppRendered(win);
    win.maximize();
    win.show();
    win.focus();
    if (!splash.isDestroyed()) splash.destroy();

    const lanIP = getLanIP();
    console.log(`نبغة شغالة على http://localhost:${API_PORT}`);
    console.log(`من الموبايل: http://${lanIP}:${API_PORT}`);
  } catch (err) {
    console.error('Startup failed:', err);
    const reason = (err as Error)?.message ?? String(err);
    runInSplash(splash, `window.setError && window.setError(${JSON.stringify('البرنامج ماقدرش يشتغل')})`);
    const { response } = await dialog.showMessageBox(splash.isDestroyed() ? (undefined as any) : splash, {
      type: 'error',
      title: 'نبغة',
      message: 'البرنامج ماقدرش يشتغل',
      detail: `${friendlyStartupError(reason)}\n\nلو المشكلة اتكررت، كلّم الدعم الفني وابعتلهم الملف ده:\n${LOG_FILE}`,
      buttons: ['إعادة المحاولة', 'فتح ملف السجل', 'إغلاق'],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
    });
    if (response === 0) {
      if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.destroy(); mainWindow = null; }
      if (apiProcess) {
        // نوقف الـ API القديم من غير ما الـ exit handler يشغّله تاني
        apiProcess.removeAllListeners('exit');
        apiProcess.kill();
        apiProcess = null;
      }
      apiRestarts = [];
      if (!splash.isDestroyed()) splash.destroy();
      return startup(createSplashWindow());
    }
    if (response === 1) await shell.openPath(LOG_FILE);
    isQuitting = true;
    if (!splash.isDestroyed()) splash.destroy();
    app.quit();
  }
}

function friendlyStartupError(reason: string): string {
  if (/Node\.js/.test(reason)) return 'Node.js مش موجود على الجهاز — التثبيت ناقص. أعد تثبيت البرنامج.';
  if (/Migration failed|ECONNREFUSED|password authentication|database/i.test(reason)) {
    return 'قاعدة البيانات مش شغالة أو مش بترد. اتأكد إن خدمة PostgreSQL شغالة، أو اعمل Restart للجهاز وجرّب تاني.';
  }
  if (/API timeout|API not available/.test(reason)) return 'الخادم الداخلي للبرنامج ماقامش في الوقت المتوقع.';
  return reason;
}

// ── Cleanup ───────────────────────────────────────────────────
app.on('before-quit', () => {
  isQuitting = true;
  if (apiProcess) {
    apiProcess.kill();
    apiProcess = null;
  }
});

app.on('window-all-closed', (e: any) => {
  e.preventDefault();
});