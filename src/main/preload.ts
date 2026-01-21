import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
    on: (channel: string, func: (...args: any[]) => void): (() => void) => {
      const wrapper = (_event: IpcRendererEvent, ...args: any[]) => func(...args);
      ipcRenderer.on(channel, wrapper);
      return () => ipcRenderer.removeListener(channel, wrapper);
    },
  },
});
