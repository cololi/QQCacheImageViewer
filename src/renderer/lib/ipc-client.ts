/**
 * Typed IPC client for the renderer process.
 *
 * Wraps every invocable channel with a small function that:
 *   - constructs the right argument tuple
 *   - awaits ipcRenderer.invoke
 *   - unwraps the `{success, data}` envelope produced by the main-process registry
 *   - throws on failure so callers can use try/catch (instead of inspecting envelopes)
 *
 * Settings channels are NOT routed through here — settingsSlice.ts still calls
 * ipcRenderer.invoke directly, and those handlers are registered raw (no envelope)
 * to preserve back-compat. This file deliberately exposes only the enveloped channels.
 */
import { IPC } from '../../shared/ipc-channels';
import type { AppSettings, UserPreferences } from '../../shared/settings-types';
import type {
  Image,
  ImageMetadata,
  QueryParams,
  ScanProgress,
  ScanResult,
} from '../../shared/types';

/** Envelope shape returned by `registerHandler` in `src/main/ipc/registry.ts`. */
interface IpcEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: unknown;
}

interface FileOpResult {
  success: boolean;
  message: string;
}

interface CopyFilesResult {
  success: boolean;
  copied: number;
  failed: number;
  message: string;
}

interface DeleteToRecycleBinResult {
  success: boolean;
  deleted: number;
  message: string;
}

interface DeleteResult {
  success: boolean;
  deleted: number;
  failed: number;
}

interface ExportZipResult {
  success: boolean;
  message: string;
}

interface SaveDialogResult {
  canceled: boolean;
  filePath?: string;
}

interface OpenDirDialogResult {
  canceled: boolean;
  filePath?: string;
}

export interface ScanImagesOptions {
  paths?: string[];
  incremental?: boolean;
  includeTemp?: boolean;
}

/**
 * Invoke a channel and unwrap its envelope.
 * Throws on validation failure or handler error so callers can `try/catch`.
 */
async function call<T>(channel: string, ...args: unknown[]): Promise<T> {
  const electron = window.electron;
  if (!electron) {
    throw new Error('Electron API unavailable (renderer not running inside Electron?)');
  }
  const env = (await electron.ipcRenderer.invoke(channel, ...args)) as IpcEnvelope<T>;
  if (!env || env.success !== true) {
    const message = env?.error ?? 'IPC call failed';
    throw new Error(`[${channel}] ${message}`);
  }
  return env.data as T;
}

/**
 * Invoke a raw channel that returns the value directly (no envelope).
 * Used for settings channels registered via `registerRawHandler` in the main process.
 */
async function callRaw<T>(channel: string, ...args: unknown[]): Promise<T> {
  const electron = window.electron;
  if (!electron) {
    throw new Error('Electron API unavailable (renderer not running inside Electron?)');
  }
  return electron.ipcRenderer.invoke(channel, ...args) as Promise<T>;
}

/**
 * Public typed surface for renderer-side IPC calls.
 *
 * Each method maps 1:1 to a handler in `src/main/ipc/handlers.ts`.
 * Argument shapes match the corresponding zod schema in `src/shared/ipc-schemas.ts`.
 */
export const ipc = {
  // ---- Scanning + metadata ----------------------------------------------
  scanImages: (options?: ScanImagesOptions): Promise<ScanResult> =>
    call<ScanResult>(IPC.ScanImages, options ?? {}),

  getMonths: (): Promise<Array<{ yearMonth: string; count: number }>> =>
    call<Array<{ yearMonth: string; count: number }>>(IPC.GetMonths),

  getImages: (params: QueryParams): Promise<Image[]> => call<Image[]>(IPC.GetImages, params),

  getImageCount: (yearMonth?: string): Promise<number> =>
    call<number>(IPC.GetImageCount, yearMonth),

  // ---- File operations --------------------------------------------------
  copyFile: (source: string, destination: string): Promise<FileOpResult> =>
    call<FileOpResult>(IPC.CopyFile, source, destination),

  copyFiles: (sources: string[], destinationFolder: string): Promise<CopyFilesResult> =>
    call<CopyFilesResult>(IPC.CopyFiles, sources, destinationFolder),

  deleteToRecycleBin: (filePaths: string[]): Promise<DeleteToRecycleBinResult> =>
    call<DeleteToRecycleBinResult>(IPC.DeleteToRecycleBin, filePaths),

  deleteImages: (ids: number[]): Promise<DeleteResult> => call<DeleteResult>(IPC.DeleteImages, ids),

  deleteMonthImages: (yearMonth: string): Promise<DeleteResult> =>
    call<DeleteResult>(IPC.DeleteMonthImages, yearMonth),

  exportAsZip: (images: Image[] | ImageMetadata[], outputPath: string): Promise<ExportZipResult> =>
    call<ExportZipResult>(IPC.ExportAsZip, images, outputPath),

  openFolder: (folderPath: string): Promise<FileOpResult> =>
    call<FileOpResult>(IPC.OpenFolder, folderPath),

  openFile: (filePath: string): Promise<FileOpResult> => call<FileOpResult>(IPC.OpenFile, filePath),

  saveImage: (image: Image): Promise<FileOpResult> => call<FileOpResult>(IPC.SaveImage, image),

  // ---- Dialogs ----------------------------------------------------------
  showSaveDialog: (
    title: string,
    defaultFileName: string,
    filters?: Array<{ name: string; extensions: string[] }>,
  ): Promise<SaveDialogResult> =>
    call<SaveDialogResult>(IPC.ShowSaveDialog, title, defaultFileName, filters),

  showOpenDirectoryDialog: (title: string): Promise<OpenDirDialogResult> =>
    call<OpenDirDialogResult>(IPC.ShowOpenDirectoryDialog, title),

  // ---- Custom window controls (raw — registered with registerRawHandler) ----
  minimizeWindow: (): Promise<{ success: boolean }> =>
    callRaw<{ success: boolean }>(IPC.WindowMinimize),

  toggleMaximizeWindow: (): Promise<{ maximized: boolean }> =>
    callRaw<{ maximized: boolean }>(IPC.WindowMaximizeToggle),

  closeWindow: (): Promise<{ success: boolean }> => callRaw<{ success: boolean }>(IPC.WindowClose),

  // ---- Settings (use callRaw — registered with registerRawHandler, no envelope) ----
  getSettings: (): Promise<AppSettings> => callRaw<AppSettings>(IPC.GetSettings),

  setSettings: (settings: AppSettings): Promise<{ success: boolean }> =>
    callRaw<{ success: boolean }>(IPC.SetSettings, settings),

  getPreference: <K extends keyof UserPreferences>(key: K): Promise<UserPreferences[K]> =>
    callRaw<UserPreferences[K]>(IPC.GetPreference, key),

  setPreference: <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ): Promise<{ success: boolean }> => callRaw<{ success: boolean }>(IPC.SetPreference, key, value),

  updatePreferences: (updates: Partial<UserPreferences>): Promise<{ success: boolean }> =>
    callRaw<{ success: boolean }>(IPC.UpdatePreferences, updates),

  resetSettings: (): Promise<AppSettings> => callRaw<AppSettings>(IPC.ResetSettings),

  // ---- Events (one-way main -> renderer) --------------------------------
  /**
   * Subscribe to scan progress events. Returns an unsubscribe function.
   * Safe to call before electron is available — returns a no-op unsubscribe.
   */
  onScanProgress: (callback: (data: ScanProgress) => void): (() => void) => {
    const electron = window.electron;
    if (!electron) return () => undefined;
    const unsub = electron.ipcRenderer.on(IPC.ScanProgress, (data: ScanProgress) => callback(data));
    return () => {
      unsub?.();
    };
  },
};

export type IpcClient = typeof ipc;
