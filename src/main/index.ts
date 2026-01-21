import { app, BrowserWindow, ipcMain, Menu, protocol, net } from 'electron';
import path from 'path';
import { initializeDatabase, getMonths, getImages, saveImages, getImageCount, getExistingHashes } from './services/db-service';
import { detectQQCachePaths, scanQQCacheDirectory } from './services/image-scanner';
import {
  copyFile,
  copyFiles,
  deleteToRecycleBin,
  exportAsZip,
  openFolderInExplorer,
  openFileWithDefaultApp,
  showSaveDialog,
  showOpenDirectoryDialog,
} from './services/file-service';
import {
  getSettings,
  getSetting,
  setSettings,
  setPreference,
  updatePreferences,
  resetSettings,
} from './services/settings-service';
import { createApplicationMenu } from './menu';

import { ScanResult, Image, QueryParams } from '../shared/types';

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
      height: 30
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
    mainWindow = null;
  });
};

// IPC Handlers
ipcMain.handle('scan-images', async (_event, options: any): Promise<ScanResult> => {
  try {
    // Detect QQ cache path
    let scanPaths: string[] = options?.paths || [];

    // If no paths provided, auto-detect
    if (!scanPaths || scanPaths.length === 0) {
      scanPaths = await detectQQCachePaths();
      if (scanPaths.length === 0) {
        return {
          success: false,
          totalImages: 0,
          message: 'Could not detect QQ cache directories',
        };
      }
    }

    console.log('Scanning paths:', scanPaths);

    // Scan and save images
    const images = await scanQQCacheDirectory(scanPaths, options, (month, processed, total, percent) => {
      mainWindow?.webContents.send('scan-progress', {
        currentMonth: month,
        processedFiles: processed,
        totalFiles: total,
        percent: Math.round(percent),
      });
    });

    // Save to database
    saveImages(images);

    return {
      success: true,
      totalImages: images.length,
      message: `Successfully scanned ${images.length} images`,
    };
  } catch (error) {
    console.error('Scan error:', error);
    return {
      success: false,
      totalImages: 0,
      message: `Scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
});

ipcMain.handle('get-months', async () => {
  return getMonths();
});

ipcMain.handle('get-images', async (_event, params: QueryParams): Promise<Image[]> => {
  return getImages(params);
});

ipcMain.handle('get-image-count', async (_event, yearMonth?: string): Promise<number> => {
  return getImageCount(yearMonth);
});

// File Operations IPC Handlers
ipcMain.handle('copy-file', async (_event, source: string, destination: string) => {
  return copyFile(source, destination);
});

ipcMain.handle('copy-files', async (_event, sources: string[], destinationFolder: string) => {
  return copyFiles(sources, destinationFolder);
});

ipcMain.handle('delete-to-recycle-bin', async (_event, filePaths: string[]) => {
  return deleteToRecycleBin(filePaths);
});

ipcMain.handle('export-as-zip', async (_event, images: Image[], outputPath: string) => {
  return exportAsZip(images, outputPath);
});

ipcMain.handle('open-folder', async (_event, folderPath: string) => {
  return openFolderInExplorer(folderPath);
});

ipcMain.handle('open-file', async (_event, filePath: string) => {
  return openFileWithDefaultApp(filePath);
});

ipcMain.handle('show-save-dialog', async (_event, title: string, defaultFileName: string, filters?: any) => {
  return showSaveDialog(title, defaultFileName, filters);
});

ipcMain.handle('show-open-directory-dialog', async (_event, title: string) => {
  return showOpenDirectoryDialog(title);
});

ipcMain.handle('save-image', async (_event, image: Image) => {
  try {
    const settings = getSettings();
    let exportPath = settings.preferences.defaultExportPath;

    if (!exportPath) {
      const result = await showSaveDialog('保存图片', `${image.hash}.${image.format}`);
      if (result.canceled || !result.filePath) {
        return { success: false, message: 'Cancelled' };
      }
      exportPath = path.dirname(result.filePath);
      return copyFile(image.filePath, result.filePath);
    }

    const destination = path.join(exportPath, `${image.hash}.${image.format}`);
    return copyFile(image.filePath, destination);
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Settings IPC Handlers
ipcMain.handle('get-settings', async () => {
  try {
    return getSettings();
  } catch (error) {
    console.error('Get settings error:', error);
    throw error;
  }
});

ipcMain.handle('set-settings', async (_event, settings: any) => {
  try {
    setSettings(settings);
    return { success: true };
  } catch (error) {
    console.error('Set settings error:', error);
    throw error;
  }
});

ipcMain.handle('get-preference', async (_event, key: string) => {
  try {
    return getSetting(key as any);
  } catch (error) {
    console.error('Get preference error:', error);
    throw error;
  }
});

ipcMain.handle('set-preference', async (_event, key: string, value: any) => {
  try {
    setPreference(key as any, value);
    return { success: true };
  } catch (error) {
    console.error('Set preference error:', error);
    throw error;
  }
});

ipcMain.handle('update-preferences', async (_event, updates: any) => {
  try {
    updatePreferences(updates);
    return { success: true };
  } catch (error) {
    console.error('Update preferences error:', error);
    throw error;
  }
});

ipcMain.handle('reset-settings', async () => {
  try {
    resetSettings();
    return getSettings();
  } catch (error) {
    console.error('Reset settings error:', error);
    throw error;
  }
});

app.on('ready', () => {
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

app.on('will-quit', () => {
  console.log('App will quit');
});

app.on('before-quit', () => {
  console.log('App before quit');
});

app.on('quit', () => {
  console.log('App quit');
});
