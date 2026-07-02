import '@testing-library/jest-dom';

// Mock electron module - MUST be defined inline to avoid scope issues with jest.mock
jest.mock('electron', () => ({
  ipcRenderer: {
    invoke: jest.fn(),
    send: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    once: jest.fn(),
  },
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
  },
  app: {
    getPath: jest.fn((type) => {
      if (type === 'userData') return '/mock/user/data';
      return '/mock/path';
    }),
  },
  BrowserWindow: jest.fn(),
  Menu: {
    setApplicationMenu: jest.fn(),
    buildFromTemplate: jest.fn(),
  },
  clipboard: {
    writeImage: jest.fn(),
  },
  nativeImage: {
    createFromPath: jest.fn(() => ({ isEmpty: jest.fn(() => false) })),
  },
}));

// Mock Electron IPC for window.electron (separate instance for renderer)
const mockIpcRenderer = {
  invoke: jest.fn(),
  send: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  once: jest.fn(),
};

Object.defineProperty(window, 'electron', {
  value: {
    ipcRenderer: mockIpcRenderer,
  },
  writable: true,
});

// Suppress console errors during tests (optional)
const originalError = console.error;
beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') ||
        args[0].includes('Not implemented: HTMLFormElement.prototype.submit'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// Initialize path-guard for tests with permissive roots so tests can use
// arbitrary temp/absolute paths (e.g. '/a.jpg'). Production wires real roots
// in src/main/index.ts (separate task).
import os from 'os';
import path from 'path';
import { setAllowedRoots } from './main/utils/path-guard';

const fsRoot = path.parse(process.cwd()).root; // 'e:\\' on Windows, '/' on POSIX
setAllowedRoots([fsRoot, os.tmpdir(), process.cwd(), os.homedir()]);
