import { app, BrowserWindow, Tray, Menu, nativeImage } from 'electron';
import * as path from 'path';
import * as http from 'http';
import * as os from 'os';
import * as fs from 'fs';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

const API_PORT = 3001;
const IS_PACKAGED = app.isPackaged;
const RESOURCES = IS_PACKAGED ? process.resourcesPath : path.join(__dirname, '../..');

function getLanIP(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
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
        else reject(new Error('API not available'));
      }).on('error', () => {
        if (n > 0) setTimeout(() => check(n - 1), 1000);
        else reject(new Error('API timeout'));
      });
    };
    check(retries);
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
    {
      label: 'فتح البرنامج',
      click: () => mainWindow?.show(),
    },
    {
      label: 'نسخ رابط الشبكة',
      click: () => {
        const { clipboard } = require('electron');
        clipboard.writeText(`http://${lanIP}:${API_PORT}`);
      },
    },
    { type: 'separator' },
    {
      label: 'إغلاق نبغة',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip(`نبغة — http://${lanIP}:${API_PORT}`);
  tray.setContextMenu(menu);
  tray.on('double-click', () => mainWindow?.show());
}

function createSplashWindow() {
  const splash = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    webPreferences: { nodeIntegration: false },
  });

  const splashHTML = `
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          background: #0E3B2E;
          color: white;
          font-family: Cairo, Arial, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          border-radius: 16px;
        }
        h1 { font-size: 48px; color: #C9A227; margin-bottom: 8px; }
        p { font-size: 14px; color: rgba(255,255,255,0.7); margin-bottom: 32px; }
        .loader {
          width: 40px; height: 40px;
          border: 3px solid rgba(255,255,255,0.2);
          border-top-color: #C9A227;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        .status { margin-top: 16px; font-size: 12px; color: rgba(255,255,255,0.5); }
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
    </head>
    <body>
      <h1>نبغة</h1>
      <p>إدارة الدروس الخصوصية</p>
      <div class="loader"></div>
      <div class="status">جاري التشغيل...</div>
    </body>
    </html>
  `;

  splash.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHTML)}`);
  return splash;
}

app.whenReady().then(async () => {
  app.setAppUserModelId('com.nabgha.desktop');

  const splash = createSplashWindow();
  createTray();

  try {
    await waitForAPI();
    splash.close();

    const lanIP = getLanIP();

    mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      show: true,
      title: 'نبغة',
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
      },
    });

    mainWindow.loadURL(`http://localhost:${API_PORT}`);

    mainWindow.on('close', (e) => {
      if (!isQuitting) {
        e.preventDefault();
        mainWindow?.hide();
      }
    });

    console.log(`نبغة شغالة على http://localhost:${API_PORT}`);
    console.log(`من الموبايل: http://${lanIP}:${API_PORT}`);
  } catch (err) {
    console.error('Failed to connect to API:', err);
    splash.close();
    app.quit();
  }
});

app.on('window-all-closed', (e: any) => {
  e.preventDefault();
});

app.on('before-quit', () => {
  isQuitting = true;
});