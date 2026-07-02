/**
 * Centralized registration for every IPC handler.
 *
 * Architecture:
 *   - Channel constants live in `src/shared/ipc-channels.ts` (IPC.*)
 *   - Input validation schemas live in `src/shared/ipc-schemas.ts`
 *   - Generic registration + envelope wrapping lives in `./registry.ts`
 *   - This file glues channel + schema + handler body together.
 *
 * Settings channels use `registerRawHandler` (no envelope) to preserve back-compat
 * with `settingsSlice.ts`, which calls ipcRenderer.invoke directly. All other
 * channels return `{success, data}` envelopes which `ipc-client.ts` unwraps.
 */
import { BrowserWindow, ipcMain } from 'electron';
import path from 'path';

import { IPC } from '../../shared/ipc-channels';
import * as schemas from '../../shared/ipc-schemas';
import { AppSettings, UserPreferences } from '../../shared/settings-types';
import { Image, ImageMetadata } from '../../shared/types';

import { registerHandler, registerRawHandler } from './registry';

import {
  getMonths,
  getImages,
  saveImages,
  getImageCount,
  deleteImages as dbDeleteImages,
  deleteImagesByMonth,
} from '../services/db-service';
import {
  detectQQCachePaths,
  scanQQCacheDirectory,
  resetScanAbort,
} from '../services/image-scanner';
import {
  copyFile,
  copyFiles,
  deleteToRecycleBin,
  deleteFilesPermanently,
  exportAsZip,
  openFolderInExplorer,
  openFileWithDefaultApp,
  showSaveDialog,
  showOpenDirectoryDialog,
} from '../services/file-service';
import {
  getSettings,
  getSetting,
  setSettings,
  setPreference,
  updatePreferences,
  resetSettings,
} from '../services/settings-service';
import { addAllowedRoot } from '../utils/path-guard';

const DEFAULT_PAGE_SIZE = 200;
const SCAN_SAVE_BATCH_SIZE = 500;

/**
 * Register all 21 invocable IPC handlers.
 *
 * `getMainWindow` is injected so the scan handler can stream `scan-progress`
 * events to whichever BrowserWindow is currently active without coupling this
 * module to the lifecycle in index.ts.
 */
export function registerAllHandlers(getMainWindow: () => BrowserWindow | null): void {
  // ---- Scanning + metadata ------------------------------------------------

  registerHandler(IPC.ScanImages, schemas.ScanImagesInput, async (input) => {
    // Reset cancellation flag at the start of every new scan.
    resetScanAbort();

    let scanPaths: string[] = input?.paths ?? [];

    if (scanPaths.length === 0) {
      scanPaths = await detectQQCachePaths();
      if (scanPaths.length === 0) {
        return {
          success: false,
          totalImages: 0,
          message: '无法检测到 QQ 缓存目录',
        };
      }
    }

    console.log('Scanning paths:', scanPaths);

    let scannedImages = 0;
    let pendingImages: ImageMetadata[] = [];
    const flushPendingImages = async () => {
      if (pendingImages.length === 0) return;
      const batch = pendingImages;
      pendingImages = [];
      const saved = await saveImages(batch);
      if (!saved) {
        throw new Error('保存扫描结果失败');
      }
    };

    await scanQQCacheDirectory(
      scanPaths,
      input ?? {},
      (month, processed, total, percent) => {
        const win = getMainWindow();
        if (!win || win.isDestroyed()) return;
        win.webContents.send(IPC.ScanProgress, {
          currentMonth: month,
          processedFiles: processed,
          totalFiles: total,
          percent: Math.round(percent),
        });
      },
      async (images) => {
        scannedImages += images.length;
        pendingImages.push(...images);
        if (pendingImages.length >= SCAN_SAVE_BATCH_SIZE) {
          await flushPendingImages();
        }
      },
    );

    await flushPendingImages();

    return {
      success: true,
      totalImages: scannedImages,
      message: `成功扫描 ${scannedImages} 张图片`,
    };
  });

  registerHandler(IPC.GetMonths, schemas.NoInput, async () => {
    return getMonths();
  });

  registerHandler(IPC.GetImages, schemas.GetImagesInput, async (params) => {
    // Mirror previous behavior: if limit is missing or non-positive, default it.
    const limit = params.limit && params.limit > 0 ? params.limit : DEFAULT_PAGE_SIZE;
    return getImages({
      yearMonth: params.yearMonth,
      format: params.format,
      formats: params.formats,
      categories: params.categories,
      sizeRange: params.sizeRange,
      ratioRange: params.ratioRange,
      // SortField is loosely typed at the schema layer; db-service has its own whitelist.
      sortField: params.sortField as never,
      sortOrder: params.sortOrder,
      offset: params.offset ?? 0,
      limit,
    });
  });

  registerHandler(IPC.GetImageCount, schemas.GetImageCountInput, async (yearMonth) => {
    return getImageCount(yearMonth);
  });

  // ---- File operations ----------------------------------------------------

  registerHandler(IPC.CopyFile, schemas.CopyFileInput, async ([source, destination]) => {
    return copyFile(source, destination);
  });

  registerHandler(IPC.CopyFiles, schemas.CopyFilesInput, async ([sources, destinationFolder]) => {
    return copyFiles(sources, destinationFolder);
  });

  registerHandler(IPC.DeleteToRecycleBin, schemas.DeleteToRecycleBinInput, async (filePaths) => {
    return deleteToRecycleBin(filePaths);
  });

  registerHandler(IPC.DeleteImages, schemas.DeleteImagesInput, async (ids) => {
    try {
      const { filePaths } = dbDeleteImages(ids);
      const fileResult = await deleteFilesPermanently(filePaths);
      return {
        success: fileResult.failed === 0,
        deleted: fileResult.deleted,
        failed: fileResult.failed,
      };
    } catch (error) {
      console.error('delete-images failed:', error);
      return { success: false, deleted: 0, failed: ids.length };
    }
  });

  registerHandler(IPC.DeleteMonthImages, schemas.DeleteMonthImagesInput, async (yearMonth) => {
    try {
      const { filePaths } = deleteImagesByMonth(yearMonth);
      const fileResult = await deleteFilesPermanently(filePaths);
      return {
        success: fileResult.failed === 0,
        deleted: fileResult.deleted,
        failed: fileResult.failed,
      };
    } catch (error) {
      console.error('delete-month-images failed:', error);
      return { success: false, deleted: 0, failed: 0 };
    }
  });

  registerHandler(IPC.ExportAsZip, schemas.ExportAsZipInput, async ([images, outputPath]) => {
    return exportAsZip(images as Image[], outputPath);
  });

  registerHandler(IPC.OpenFolder, schemas.OpenFolderInput, async (folderPath) => {
    return openFolderInExplorer(folderPath);
  });

  registerHandler(IPC.OpenFile, schemas.OpenFileInput, async (filePath) => {
    return openFileWithDefaultApp(filePath);
  });

  registerHandler(IPC.SaveImage, schemas.SaveImageInput, async (image) => {
    try {
      const settings = getSettings();
      const exportPath = settings.preferences.defaultExportPath;

      if (!exportPath) {
        const result = await showSaveDialog('保存图片', `${image.hash}.${image.format}`);
        if (result.canceled || !result.filePath) {
          return { success: false, message: '已取消' };
        }
        // Allow future writes anywhere under the chosen export directory.
        addAllowedRoot(path.dirname(result.filePath));
        return copyFile(image.filePath, result.filePath);
      }

      const destination = path.join(exportPath, `${image.hash}.${image.format}`);
      return copyFile(image.filePath, destination);
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '未知错误',
      };
    }
  });

  // ---- Dialogs ------------------------------------------------------------

  registerHandler(
    IPC.ShowSaveDialog,
    schemas.ShowSaveDialogInput,
    async ([title, defaultFileName, filters]) => {
      const result = await showSaveDialog(title, defaultFileName, filters);
      if (!result.canceled && result.filePath) {
        addAllowedRoot(path.dirname(result.filePath));
      }
      return result;
    },
  );

  registerHandler(
    IPC.ShowOpenDirectoryDialog,
    schemas.ShowOpenDirectoryDialogInput,
    async (title) => {
      const result = await showOpenDirectoryDialog(title);
      if (!result.canceled && result.filePath) {
        addAllowedRoot(result.filePath);
      }
      return result;
    },
  );

  // ---- Settings (raw / no envelope) ---------------------------------------
  // settingsSlice.ts still calls ipcRenderer.invoke directly and expects raw
  // values back. Keep these handlers non-enveloped until that slice is migrated.

  registerRawHandler(IPC.GetSettings, schemas.GetSettingsInput, () => {
    return getSettings();
  });

  registerRawHandler(IPC.SetSettings, schemas.SetSettingsInput, (settings) => {
    // Pass-through: settings-service merges/validates internally.
    setSettings(settings as unknown as AppSettings);
    return { success: true };
  });

  registerRawHandler(IPC.GetPreference, schemas.GetPreferenceInput, (key) => {
    return getSetting(key as keyof UserPreferences);
  });

  registerRawHandler(IPC.SetPreference, schemas.SetPreferenceInput, ([key, value]) => {
    setPreference(key as keyof UserPreferences, value as never);
    return { success: true };
  });

  registerRawHandler(IPC.UpdatePreferences, schemas.UpdatePreferencesInput, (updates) => {
    updatePreferences(updates as Partial<UserPreferences>);
    return { success: true };
  });

  registerRawHandler(IPC.ResetSettings, schemas.ResetSettingsInput, () => {
    resetSettings();
    return getSettings();
  });

  // ---- Custom window controls ---------------------------------------------
  // The dark design draws its own min/max/close buttons (native titleBarOverlay
  // is disabled), so the renderer drives the window through these channels.
  registerRawHandler(IPC.WindowMinimize, schemas.NoInput, () => {
    getMainWindow()?.minimize();
    return { success: true };
  });

  registerRawHandler(IPC.WindowMaximizeToggle, schemas.NoInput, () => {
    const win = getMainWindow();
    if (!win) return { maximized: false };
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
    return { maximized: win.isMaximized() };
  });

  registerRawHandler(IPC.WindowClose, schemas.NoInput, () => {
    getMainWindow()?.close();
    return { success: true };
  });

  // ---- Renderer diagnostics -----------------------------------------------
  ipcMain.handle('log-renderer-error', (_evt, payload: unknown) => {
    console.error('[renderer crash]', payload);
  });
}
