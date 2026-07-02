import { app, BrowserWindow, Menu, protocol, net } from 'electron';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { initializeDatabase, closeDatabase } from './services/db-service';
import { abortScan } from './services/image-scanner';
import { setAllowedRoots, isSafePath } from './utils/path-guard';
import { getSettings } from './services/settings-service';
import { registerAllHandlers } from './ipc/handlers';

function initializePathGuard(): void {
  const roots = new Set<string>();
  const standardKeys = ['documents', 'downloads', 'desktop', 'pictures', 'userData'] as const;
  for (const key of standardKeys) {
    try {
      roots.add(app.getPath(key));
    } catch {
      // ignore: path may be unavailable on some platforms
    }
  }
  if (process.env.LOCALAPPDATA) {
    roots.add(process.env.LOCALAPPDATA);
  } else if (process.platform === 'win32' && process.env.USERPROFILE) {
    roots.add(path.join(process.env.USERPROFILE, 'AppData', 'Local'));
  }
  // Allow the configured export dir (default or user-typed) so SaveImage/export
  // copies don't fail PATH_NOT_ALLOWED. Re-read each launch so it survives restart.
  const exportPath = getSettings().preferences.defaultExportPath;
  if (exportPath) roots.add(exportPath);
  setAllowedRoots(Array.from(roots));
}

let mainWindow: BrowserWindow | null = null;

function showMainWindow(): void {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.center();
  mainWindow.show();
  mainWindow.focus();
}

function getRendererUrl(): string {
  if (app.isPackaged) {
    return pathToFileURL(path.join(__dirname, '../../renderer/index.html')).toString();
  }

  if (process.env.ELECTRON_START_URL) {
    return process.env.ELECTRON_START_URL;
  }

  const distRenderer = path.join(__dirname, '../../renderer/index.html');
  if (fs.existsSync(distRenderer)) {
    return pathToFileURL(distRenderer).toString();
  }

  const buildRenderer = path.join(app.getAppPath(), 'build/index.html');
  if (fs.existsSync(buildRenderer)) {
    return pathToFileURL(buildRenderer).toString();
  }

  return 'http://127.0.0.1:3001';
}

const createWindow = () => {
  console.log('Creating main window...');
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 600,
    show: false,
    backgroundColor: '#06080C',
    // Frameless but still resizable; the renderer draws custom min/max/close
    // buttons (see WindowControls) and drives them via IPC.
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const startUrl = getRendererUrl();

  console.log(`Loading URL: ${startUrl}`);
  mainWindow.loadURL(startUrl);

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Window content loaded');
    showMainWindow();
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
    mainWindow?.show();
  });

  mainWindow.on('ready-to-show', () => {
    console.log('Window ready to show');
    showMainWindow();
  });

  mainWindow.on('closed', () => {
    console.log('Window closed');
    // Stop any in-flight scan so we don't try to webContents.send to a
    // destroyed window and so the next launch starts cleanly.
    abortScan();
    mainWindow = null;
  });
};

app.on('ready', () => {
  initializePathGuard();

  // Register custom protocol for local resources
  protocol.handle('local-resource', (request) => {
    const url = request.url.replace('local-resource://', '');
    const decodedUrl = decodeURIComponent(url);
    try {
      // Trust boundary: the renderer can request any local-resource:// URL, so
      // reject anything outside the allowlist before reading bytes off disk.
      if (!isSafePath(decodedUrl)) {
        return new Response('Forbidden', { status: 403 });
      }
      // Use pathToFileURL to properly handle encoding (spaces, etc.)
      return net.fetch(pathToFileURL(decodedUrl).toString());
    } catch (error) {
      console.error('Protocol error:', error);
      return new Response('Not Found', { status: 404 });
    }
  });

  initializeDatabase();

  // Register every IPC handler before creating the window so the renderer
  // never observes a missing channel during cold start.
  registerAllHandlers(() => mainWindow);

  createWindow();

  // Remove application menu
  Menu.setApplicationMenu(null);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

let dbClosed = false;
function shutdownDatabase(reason: string): void {
  if (dbClosed) return;
  dbClosed = true;
  try {
    closeDatabase();
    console.log(`Database closed (${reason})`);
  } catch (error) {
    console.error(`Database close failed (${reason}):`, error);
  }
}

app.on('before-quit', () => {
  shutdownDatabase('before-quit');
});

app.on('will-quit', () => {
  shutdownDatabase('will-quit');
});

app.on('quit', () => {
  shutdownDatabase('quit');
  console.log('App quit');
});
