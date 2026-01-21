import { app, BrowserWindow, Menu, protocol, net } from 'electron';
import path from 'path';
import { initializeDatabase, closeDatabase } from './services/db-service';
import { abortScan } from './services/image-scanner';
import { setAllowedRoots } from './utils/path-guard';
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
  setAllowedRoots(Array.from(roots));
}

let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
  console.log('Creating main window...');
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 600,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#00000000',
      symbolColor: '#555555',
      height: 30,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const startUrl = !app.isPackaged
    ? 'http://127.0.0.1:3001'
    : `file://${path.join(__dirname, '../../renderer/index.html')}`;

  console.log(`Loading URL: ${startUrl}`);
  mainWindow.loadURL(startUrl);

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Window content loaded');
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  mainWindow.on('ready-to-show', () => {
    console.log('Window ready to show');
    mainWindow?.show();
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
      // Use pathToFileURL to properly handle encoding (spaces, etc.)
      const { pathToFileURL } = require('url');
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
