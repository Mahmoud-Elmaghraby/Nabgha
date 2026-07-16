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

function startAPI(): Promise<void> {
  return new Promise((resolve, reject) => {
    let nodePath: string;
    const { execSync } = require('child_process');
    try {
      const cmd = process.platform === 'win32' ? 'where node' : 'which node';
      nodePath = execSync(cmd).toString().trim().split('\n')[0].trim();
    } catch {
      nodePath = process.execPath.replace('electron.exe', 'node.exe').replace('electron', 'node');
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
        setTimeout(() => startAPI(), 3000);
      }
    });

    apiProcess.on('error', (err) => { reject(err); });
    setTimeout(() => resolve(), 1000);
  });
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

    const { execSync: execSyncM } = require('child_process');
    let nodePath: string;
    try {
      const cmd = process.platform === 'win32' ? 'where node' : 'which node';
      nodePath = execSyncM(cmd).toString().trim().split('\n')[0].trim();
    } catch {
      nodePath = process.execPath.replace('electron.exe', 'node.exe').replace('electron', 'node');
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
  const splash = new BrowserWindow({
    width: 400, height: 300,
    frame: false, alwaysOnTop: true, transparent: true,
    webPreferences: { nodeIntegration: false },
  });

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
// الطريقة الأساسية: توليد PDF بمقاس اللاصقة وفتحه للطباعة
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

    // Build HTML: one label per page
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

    // Write HTML to temp file
    const tmpDir = app.getPath('temp');
    const tmpHtml = path.join(tmpDir, `nabgha-labels-${Date.now()}.html`);
    fs.writeFileSync(tmpHtml, html, 'utf-8');

    // Create a hidden window to render the HTML
    const pxPerMm = 96 / 25.4;
    const printWin = new BrowserWindow({
      show: false,
      width: Math.ceil(labelWidthMm * pxPerMm) + 20,
      height: Math.ceil(labelHeightMm * pxPerMm) + 20,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    await printWin.loadFile(tmpHtml);
    console.log('[Print] Loaded HTML in hidden window');

    // Wait for all images to render
    await printWin.webContents.executeJavaScript(`
      new Promise(resolve => {
        const imgs = document.querySelectorAll('img');
        let loaded = 0;
        if (imgs.length === 0) return resolve();
        imgs.forEach(img => {
          if (img.complete) { loaded++; if (loaded === imgs.length) resolve(); }
          else { img.onload = () => { loaded++; if (loaded === imgs.length) resolve(); }; }
        });
        setTimeout(resolve, 3000); // fallback timeout
      })
    `);
    console.log('[Print] All images loaded');

    // Convert mm to microns (1mm = 1000 microns)
    const widthMicrons = labelWidthMm * 1000;
    const heightMicrons = labelHeightMm * 1000;

    if (silent && deviceName) {
      // محاولة طباعة صامتة مباشرة
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

    // الطريقة الأساسية: توليد PDF وفتحه
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

      // فتح الـ PDF — المستخدم يطبع منه مباشرة
      // shell مستوردة من فوق
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

    await startAPI();

    splash.webContents.executeJavaScript(
      `document.querySelector('.status').textContent = 'جاري الاتصال...'`
    ).catch(() => {});

    await waitForAPI();

    splash.close();
    createMainWindow();

    const lanIP = getLanIP();
    console.log(`نبغة شغالة على http://localhost:${API_PORT}`);
    console.log(`من الموبايل: http://${lanIP}:${API_PORT}`);

  } catch (err) {
    console.error('Startup failed:', err);
    splash.close();
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