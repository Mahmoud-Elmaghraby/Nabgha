import { app, BrowserWindow, Tray, Menu, nativeImage, clipboard } from 'electron';
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

// ── Paths ─────────────────────────────────────────────────────
const API_ENTRY   = IS_PACKAGED
  ? path.join(RESOURCES, 'api', 'dist', 'main.js')
  : path.join(__dirname, '..', '..', 'api', 'dist', 'main.js');

const STATIC_PATH = IS_PACKAGED
  ? path.join(RESOURCES, 'web', 'dist')
  : path.join(__dirname, '..', '..', 'web', 'dist');

const STORAGE_PATH = path.join(
  app.getPath('userData'),
  'storage'
);

const DB_PATH = IS_PACKAGED
  ? path.join(RESOURCES, 'db')
  : path.join(__dirname, '..', '..', '..', 'packages', 'db');

// ── Helpers ───────────────────────────────────────────────────
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

// ── Start NestJS API ──────────────────────────────────────────
function startAPI(): Promise<void> {
  return new Promise((resolve, reject) => {
    // نجيب الـ node path الصح
    // في dev mode نجيب الـ node path من which node
    let nodePath: string;
    if (IS_PACKAGED) {
      nodePath = path.join(RESOURCES, 'node', 'node.exe');
    } else {
      const { execSync } = require('child_process');
      try {
        nodePath = execSync('which node').toString().trim();
      } catch {
        nodePath = process.execPath.replace('electron', 'node');
      }
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
        // Auto-restart لو وقف بشكل غير متوقع
        setTimeout(() => startAPI(), 3000);
      }
    });

    apiProcess.on('error', (err) => {
      reject(err);
    });

    // نستنى شوية وبعدين نتحقق
    setTimeout(() => resolve(), 1000);
  });
}

// ── Run Migrations ────────────────────────────────────────────
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
    if (IS_PACKAGED) {
      nodePath = path.join(RESOURCES, 'node', 'node.exe');
    } else {
      try { nodePath = execSyncM('which node').toString().trim(); }
      catch { nodePath = process.execPath.replace('electron', 'node'); }
    }
    const dbUrl = process.env.DATABASE_URL ?? 'postgresql://nabgha:nabgha123@127.0.0.1:5432/nabgha';
    const env = {
      ...process.env,
      DATABASE_URL: dbUrl,
      DOTENV_DISABLED: 'true',
    };

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

// ── Tray ──────────────────────────────────────────────────────
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

// ── Splash ────────────────────────────────────────────────────
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

// ── Main Window ───────────────────────────────────────────────
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800,
    show: true,
    title: 'نبغة',
    autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false },
  });

  mainWindow.loadURL(`http://localhost:${API_PORT}`);

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });
}

// ── App Ready ─────────────────────────────────────────────────
app.whenReady().then(async () => {
  app.setAppUserModelId('com.nabgha.desktop');

  const splash = createSplashWindow('جاري تجهيز قاعدة البيانات...');
  createTray();

  try {
    // 1. تشغيل الـ migrations
    await runMigrations();

    // 2. تشغيل الـ API
    splash.webContents.executeJavaScript(
      `document.querySelector('.status').textContent = 'جاري تشغيل الخادم...'`
    ).catch(() => {});

    await startAPI();

    // 3. انتظار الـ API
    splash.webContents.executeJavaScript(
      `document.querySelector('.status').textContent = 'جاري الاتصال...'`
    ).catch(() => {});

    await waitForAPI();

    // 4. فتح النافذة الرئيسية
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
