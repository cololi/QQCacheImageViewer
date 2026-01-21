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
