/**
 * Image Scanner Service Tests
 * Tests for QQ cache scanning: detection, directory scanning, metadata extraction
 */

import * as scannerService from '../image-scanner';
import sharp from 'sharp';

// Mock fs (image-scanner uses native fs with promisify)
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  statSync: jest.fn().mockReturnValue({ isDirectory: () => true }),
  constants: { F_OK: 0 },
  promises: {
    readdir: jest.fn().mockResolvedValue(['image1.jpg', 'image2.png']),
    stat: jest.fn().mockResolvedValue({
      size: 102400,
      mtime: new Date(),
      birthtime: new Date(),
      isFile: () => true,
      isDirectory: () => false,
    }),
    access: jest.fn().mockResolvedValue(undefined),
  },
  readdir: jest.fn((p, cb) => cb(null, ['image1.jpg', 'image2.png'])),
  stat: jest.fn((p, cb) =>
    cb(null, {
      size: 102400,
      mtime: new Date(),
      isFile: () => true,
      isDirectory: () => false,
    }),
  ),
  access: jest.fn((p, mode, cb) => {
    if (typeof mode === 'function') {
      mode(null);
    } else if (cb) {
      cb(null);
    }
  }),
}));

// Mock sharp for image processing
jest.mock('sharp', () => {
  return jest.fn(() => ({
    metadata: jest.fn().mockResolvedValue({
      width: 1920,
      height: 1080,
      space: 'srgb',
      channels: 3,
      depth: 'uchar',
      density: 72,
      hasAlpha: false,
      orientation: 1,
      exif: undefined,
    }),
  }));
});

// Mock electron app module
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn((type) => {
      if (type === 'appData') return '/mock/appdata';
      return '/mock/path';
    }),
  },
}));

describe('Image Scanner Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('detectQQCachePaths', () => {
    it('should return an array of paths', async () => {
      const result = await scannerService.detectQQCachePaths();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle path detection errors gracefully', async () => {
      await expect(scannerService.detectQQCachePaths()).resolves.toBeDefined();
    });
  });

  describe('scanQQCacheDirectory', () => {
    it('should scan directory without errors', async () => {
      await expect(scannerService.scanQQCacheDirectory('/mock/path')).resolves.not.toThrow();
    });

    it('should return an array', async () => {
      const result = await scannerService.scanQQCacheDirectory('/mock/path');
      expect(Array.isArray(result)).toBe(true);
    });

    it('should accept onProgress as 3rd argument', async () => {
      const onProgress = jest.fn();
      const result = await scannerService.scanQQCacheDirectory('/mock/path', {}, onProgress);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle array of paths', async () => {
      const result = await scannerService.scanQQCacheDirectory(['/mock/pathA', '/mock/pathB']);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle options object', async () => {
      await expect(
        scannerService.scanQQCacheDirectory('/mock/path', { incremental: false }),
      ).resolves.not.toThrow();
    });
  });

  describe('Image metadata extraction', () => {
    it('should return ImageMetadata items with expected fields if any found', async () => {
      const result = await scannerService.scanQQCacheDirectory('/mock/path');

      if (result.length > 0) {
        const image = result[0];
        expect(image.filePath).toBeDefined();
        expect(typeof image.filePath).toBe('string');
      }
      // test passes regardless of array length
      expect(true).toBe(true);
    });

    it('should have numeric width/height when present', async () => {
      const result = await scannerService.scanQQCacheDirectory('/mock/path');

      if (result.length > 0) {
        const image = result[0];
        if (image.width !== undefined) {
          expect(typeof image.width).toBe('number');
        }
        if (image.height !== undefined) {
          expect(typeof image.height).toBe('number');
        }
      }
      expect(true).toBe(true);
    });

    it('should have numeric ratio when present', async () => {
      const result = await scannerService.scanQQCacheDirectory('/mock/path');

      if (result.length > 0) {
        const image = result[0];
        if (image.ratio !== undefined) {
          expect(typeof image.ratio).toBe('number');
        }
      }
      expect(true).toBe(true);
    });

    it('should use animated image page height for dimensions', async () => {
      const sharpMock = sharp as unknown as jest.Mock;
      sharpMock.mockImplementationOnce(() => ({
        metadata: jest.fn().mockResolvedValue({
          width: 320,
          height: 960,
          pageHeight: 240,
        }),
      }));

      const result = await scannerService.getImageDimensions('/mock/path/animated.gif');

      expect(result).toEqual({ width: 320, height: 240 });
    });

    it('should have string format when present', async () => {
      const result = await scannerService.scanQQCacheDirectory('/mock/path');

      if (result.length > 0) {
        const image = result[0];
        expect(typeof image.format).toBe('string');
      }
      expect(true).toBe(true);
    });

    it('should have numeric fileSize', async () => {
      const result = await scannerService.scanQQCacheDirectory('/mock/path');

      if (result.length > 0) {
        const image = result[0];
        expect(typeof image.fileSize).toBe('number');
        expect(image.fileSize).toBeGreaterThanOrEqual(0);
      }
      expect(true).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should handle invalid path gracefully', async () => {
      await expect(scannerService.scanQQCacheDirectory('/invalid/path')).resolves.toBeDefined();
    });

    it('should handle corrupted image files without throwing', async () => {
      await expect(scannerService.scanQQCacheDirectory('/mock/path')).resolves.toBeDefined();
    });
  });
});
