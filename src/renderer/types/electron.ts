/**
 * Type definitions for Electron IPC API
 */

export interface ElectronAPI {
  ipcRenderer: {
    invoke: (channel: string, ...args: any[]) => Promise<any>;
    on: (channel: string, func: (...args: any[]) => void) => void;
    off: (channel: string, func: (...args: any[]) => void) => void;
  };
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}
