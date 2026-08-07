import { app, BrowserWindow, Tray, Menu, nativeImage, clipboard, ipcMain, shell } from 'electron';
import * as path from 'path';
import * as http from 'http';
import * as os from 'os';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let apiProcess: ChildProcess | null = null;
let isQuitting = false;

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

function getLanIP(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
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
      if (!isQuitting) {
        // startAPI دلوقتي بتعمل killPortUser تلقائياً قبل الـ spawn
        startAPI();
      }
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
  const iconPath = IS_PACKAGED
    ? path.join(RESOURCES, 'assets', 'icon.png')
    : path.join(__dirname, '../assets/icon.png');

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

function createSplashWindow(status = 'جاري التشغيل...'): BrowserWindow {
  // ملحوظة: transparent:true اتشال عمداً — غير موثوق على وندوز (بيفشل يترندر
  // شفاف على بعض كروت الشاشة/الدرايفرات أو لو تسريع الـ GPU متعطل، وبيظهر
  // كمربع أبيض صريح فاضي بدل التصميم المقصود). backgroundColor بديل ثابت
  // مايعتمدش على compositing الـ OS خالص. show:false + ready-to-show بيمنعوا
  // كمان أي فلاش أبيض قبل ما الـ HTML يخلص تحميل.
  const splash = new BrowserWindow({
    width: 400, height: 300,
    frame: false, alwaysOnTop: true,
    backgroundColor: '#0E3B2E',
    show: false,
    webPreferences: { nodeIntegration: false },
  });

  splash.once('ready-to-show', () => splash.show());

  const html = `<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      background:#0E3B2E; color:white;
      font-family:Cairo,Arial,sans-serif;
      display:flex; flex-direction:column;
      align-items:center; justify-content:center;
      height:100vh; border-radius:16px;
    }
    h1 { font-size:48px; color:#C9A227; margin-bottom:8px; }
    p  { font-size:14px; color:rgba(255,255,255,0.7); margin-bottom:32px; }
    .loader {
      width:40px; height:40px;
      border:3px solid rgba(255,255,255,0.2);
      border-top-color:#C9A227;
      border-radius:50%;
      animation:spin 1s linear infinite;
    }
    .status { margin-top:16px; font-size:12px; color:rgba(255,255,255,0.5); }
    @keyframes spin { to { transform:rotate(360deg); } }
  </style>
</head>
<body>
  <h1>نبغة</h1>
  <p>إدارة الدروس الخصوصية</p>
  <div class="loader"></div>
  <div class="status">${status}</div>
</body>
</html>`;

  splash.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  return splash;
}

function createMainWindow() {
  const PRELOAD_PATH = IS_PACKAGED
    ? path.join(RESOURCES, 'app.asar', 'dist', 'preload.js')
    : path.join(__dirname, 'preload.js');

  mainWindow = new BrowserWindow({
    width: 1280, height: 800,
    show: true,
    title: 'نبغة',
    autoHideMenuBar: true,
    // نفس منطق تفادي الفلاش الأبيض — لون خلفية ثابت مطابق لهوية التصميم
    // بدل الأبيض الافتراضي لحد ما محتوى localhost:3001 يخلص تحميل.
    backgroundColor: '#0E3B2E',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: PRELOAD_PATH,
    },
  });

  mainWindow.loadURL(`http://localhost:${API_PORT}`);

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });
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
// السبب الجذري لـ EADDRINUSE: كان في أكثر من Electron instance
// شغّال في نفس الوقت — كل واحد بيعمل killPortUser على API التاني
// وبيشغّل API جديدة على 3001 → فوضى كاملة.
// الحل: لو instance ثاني حاول يشتغل، نقفله فوراً ونرجع للأول.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  console.log('[App] Another instance is already running — quitting.');
  app.quit();
}

app.on('second-instance', () => {
  // لو المستخدم حاول يفتح نبغة تاني وهي شغّالة
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

// ── App Ready ─────────────────────────────────────────────────
app.whenReady().then(async () => {
  app.setAppUserModelId('com.nabgha.desktop');

  const splash = createSplashWindow('جاري تجهيز قاعدة البيانات...');
  createTray();

  try {
    await runMigrations();

    splash.webContents.executeJavaScript(
      `document.querySelector('.status').textContent = 'جاري تشغيل الخادم...'`
    ).catch(() => {});

    // نقتل أي API قديمة من run سابقة قبل ما نبدأ — يحمي من EADDRINUSE
    // لو الـ Electron اتغلق بشكل مش نظيف وسابت process على البورت
    await killPortUser(API_PORT);
    await startAPI();

    splash.webContents.executeJavaScript(
      `document.querySelector('.status').textContent = 'جاري الاتصال...'`
    ).catch(() => {});

    await waitForAPI();

  splash.destroy();
createMainWindow();

    const lanIP = getLanIP();
    console.log(`نبغة شغالة على http://localhost:${API_PORT}`);
    console.log(`من الموبايل: http://${lanIP}:${API_PORT}`);

  } catch (err) {
console.error('Startup failed:', err);
splash.destroy();
    app.quit();
  }
});

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