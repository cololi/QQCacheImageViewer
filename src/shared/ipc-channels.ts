/**
 * Centralized catalog of all IPC channel names used across main and renderer processes.
 *
 * String values MUST exactly match the historical handler names so existing renderer code
 * (e.g. settingsSlice direct invokes) continues to work during migration.
 *
 * Counts:
 *  - 24 invocable channels (request/response via ipcRenderer.invoke / ipcMain.handle)
 *  -  1 event channel    (one-way main -> renderer via webContents.send)
 */
export const IPC = {
  // Scanning + metadata reads
  ScanImages: 'scan-images',
  ScanProgress: 'scan-progress', // event-only: main -> renderer
  GetMonths: 'get-months',
  GetImages: 'get-images',
  GetImageCount: 'get-image-count',

  // File operations
  CopyFile: 'copy-file',
  CopyFiles: 'copy-files',
  DeleteToRecycleBin: 'delete-to-recycle-bin',
  DeleteImages: 'delete-images',
  DeleteMonthImages: 'delete-month-images',
  ExportAsZip: 'export-as-zip',
  OpenFolder: 'open-folder',
  OpenFile: 'open-file',
  SaveImage: 'save-image',

  // System dialogs
  ShowSaveDialog: 'show-save-dialog',
  ShowOpenDirectoryDialog: 'show-open-directory-dialog',

  // Custom window chrome (design draws its own min/max/close buttons)
  WindowMinimize: 'window-minimize',
  WindowMaximizeToggle: 'window-maximize-toggle',
  WindowClose: 'window-close',

  // Settings (envelope opt-out — preserves legacy direct-invoke shape used by settingsSlice)
  GetSettings: 'get-settings',
  SetSettings: 'set-settings',
  GetPreference: 'get-preference',
  SetPreference: 'set-preference',
  UpdatePreferences: 'update-preferences',
  ResetSettings: 'reset-settings',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
