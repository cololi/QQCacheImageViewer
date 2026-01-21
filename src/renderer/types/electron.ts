/**
 * Type definitions for Electron IPC API
 */

export interface ElectronAPI {
  ipcRenderer: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    invoke: (channel: string, ...args: any[]) => Promise<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    on: (channel: string, func: (...args: any[]) => void) => () => void;
  };
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}
