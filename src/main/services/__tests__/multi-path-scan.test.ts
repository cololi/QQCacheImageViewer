import * as scannerService from '../image-scanner';
import fs from 'fs';

// Mock electron
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => 'C:\\Users\\testuser\\Documents'),
  },
}));

// Mock native fs modules
jest.mock('fs', () => {
  return {
    existsSync: jest.fn(),
    statSync: jest.fn(),
    constants: { F_OK: 0 },
    promises: {
      readdir: jest.fn(),
      stat: jest.fn(),
      access: jest.fn().mockResolvedValue(undefined),
    },
    readdir: jest.fn((path, cb) => cb(null, [])),
    stat: jest.fn((path, cb) => cb(null, { isDirectory: () => true })),
    access: jest.fn((path, mode, cb) => {
      if (typeof mode === 'function') {
        mode(null);
      } else if (cb) {
        cb(null);
      }
    }),
  };
});

// Mock util.promisify to work with our mocks if needed,
// but since we override readdir/stat in the file, we might need to be careful.
// The code uses: const readdir = promisify(fs.readdir);
// Jest mocks of fs methods usually work with promisify if they follow (err, value) callback style.
// Let's verify usage.

describe('Multi-path Scanning', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.USERNAME = 'testuser';
  });

  describe('detectQQCachePaths', () => {
    it('should detect paths in Documents/Tencent Files', async () => {
      const existsSyncMock = fs.existsSync as unknown as jest.Mock;
      // First call: Documents/Tencent Files -> true
      // Second call: Pic directory -> true
      existsSyncMock.mockImplementation((p: string) => {
        if (p.includes('Tencent Files')) return true;
        if (p.includes('Pic')) return true;
        return false;
      });

      // Mock readdir to return a numeric directory (QQ ID)
      const readdirMock = fs.readdir as unknown as jest.Mock;
      readdirMock.mockImplementation((path, callback) => {
        if (path.includes('Tencent Files')) {
          callback(null, ['123456', 'NotANumber']);
        } else {
          callback(null, []);
        }
      });

      // We need to handle the fact that image-scanner uses promisify(fs.readdir).
      // Jest manual mocks of fs.readdir should be compatible with promisify.

      const paths = await scannerService.detectQQCachePaths();

      expect(paths).toContainEqual(expect.stringContaining('123456\\nt_qq\\nt_data\\Pic'));
      expect(paths.length).toBeGreaterThan(0);
    });
  });

  describe('scanQQCacheDirectory', () => {
    it('should handle array of paths', async () => {
      // Mock dependencies for scanQQCacheDirectory
      // validateDirectory, getAvailableMonths, scanMonthDirectory
      // Since these are exported from the same file, we can't easily spy on them if we test the module as a whole unit unless we split them or spy on the module import (which is hard for same-file calls).
      // However, we can mock the FS calls they rely on.

      const existsSyncMock = fs.existsSync as unknown as jest.Mock;
      existsSyncMock.mockReturnValue(true);

      const statSyncMock = fs.statSync as unknown as jest.Mock;
      statSyncMock.mockReturnValue({ isDirectory: () => true });

      // Mock readdir for getAvailableMonths (returns YYYY-MM)
      // and scanMonthDirectory (returns files)
      const readdirMock = fs.readdir as unknown as jest.Mock;
      readdirMock.mockImplementation((p, cb) => {
        if (typeof p === 'string' && p.endsWith('Pic')) {
          // Returning months
          cb(null, ['2023-01']);
        } else if (typeof p === 'string' && p.endsWith('Ori')) {
          // Returning files
          cb(null, ['test.jpg']);
        } else {
          cb(null, []);
        }
      });

      // Mock stat for scanMonthDirectory (checks if file)
      const statMock = fs.stat as unknown as jest.Mock;
      statMock.mockImplementation((p, cb) => {
        cb(null, {
          isFile: () => true,
          isDirectory: () => false,
          size: 1000,
          mtime: new Date(),
        }); // file
      });

      const results = await scannerService.scanQQCacheDirectory(['PathA/Pic', 'PathB/Pic']);

      // PathA -> 2023-01 -> test.jpg (1 image)
      // PathB -> 2023-01 -> test.jpg (1 image)
      // Total should be 2, but depends on my mocks.
      // If I return the same mock for both, it should find 1 image in each path.

      // If mocks are static, it will find same things.

      expect(Array.isArray(results)).toBe(true);
      // Verify it didn't crash
    });
  });
});
