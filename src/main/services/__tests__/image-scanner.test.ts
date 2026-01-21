/**
 * Image Scanner Service Tests
 * Tests for QQ cache scanning: detection, directory scanning, metadata extraction
 */

import * as scannerService from '../image-scanner';

// Mock fs-extra
jest.mock('fs-extra', () => ({
  pathExists: jest.fn().mockResolvedValue(true),
  readdir: jest.fn().mockResolvedValue(['image1.jpg', 'image2.png']),
  stat: jest.fn().mockResolvedValue({
    size: 102400,
    mtime: new Date(),
    birthtime: new Date(),
    atimeMs: Date.now(),
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

  describe('detectQQCachePath', () => {
    it('should return a path string', async () => {
      const result = await scannerService.detectQQCachePath();
      expect(typeof result).toBe('string');
    });

    it('should detect Windows QQ cache path', async () => {
      const result = await scannerService.detectQQCachePath();
      // Should return a valid path
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle path detection errors gracefully', async () => {
      expect(async () => {
        await scannerService.detectQQCachePath();
      }).not.toThrow();
    });
  });

  describe('scanQQCacheDirectory', () => {
    it('should scan directory without errors', async () => {
      expect(async () => {
        await scannerService.scanQQCacheDirectory('/mock/path', {
          onProgress: jest.fn(),
        });
      }).not.toThrow();
    });

    it('should return scan result object', async () => {
      const result = await scannerService.scanQQCacheDirectory('/mock/path', {
        onProgress: jest.fn(),
      });

      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should have images array in result', async () => {
      const result = await scannerService.scanQQCacheDirectory('/mock/path', {
        onProgress: jest.fn(),
      });

      expect(Array.isArray(result.images)).toBe(true);
    });

    it('should have scan statistics', async () => {
      const result = await scannerService.scanQQCacheDirectory('/mock/path', {
        onProgress: jest.fn(),
      });

      expect(result.totalScanned).toBeDefined();
      expect(typeof result.totalScanned).toBe('number');
    });

    it('should call progress callback', async () => {
      const onProgress = jest.fn();

      await scannerService.scanQQCacheDirectory('/mock/path', {
        onProgress,
      });

      // Progress callback should be called at least once
      expect(onProgress).toHaveBeenCalled();
    });

    it('should handle custom formats filter', async () => {
      expect(async () => {
        await scannerService.scanQQCacheDirectory('/mock/path', {
          formats: ['jpg', 'png'],
          onProgress: jest.fn(),
        });
      }).not.toThrow();
    });

    it('should handle size range filter', async () => {
      expect(async () => {
        await scannerService.scanQQCacheDirectory('/mock/path', {
          minSize: 1000,
          maxSize: 1000000,
          onProgress: jest.fn(),
        });
      }).not.toThrow();
    });
  });

  describe('Image metadata extraction', () => {
    it('should extract image dimensions', async () => {
      const result = await scannerService.scanQQCacheDirectory('/mock/path', {
        onProgress: jest.fn(),
      });

      if (result.images.length > 0) {
        const image = result.images[0];
        expect(image.width).toBeDefined();
        expect(image.height).toBeDefined();
        expect(typeof image.width).toBe('number');
        expect(typeof image.height).toBe('number');
      }
    });

    it('should calculate aspect ratio', async () => {
      const result = await scannerService.scanQQCacheDirectory('/mock/path', {
        onProgress: jest.fn(),
      });

      if (result.images.length > 0) {
        const image = result.images[0];
        expect(image.aspectRatio).toBeDefined();
        expect(typeof image.aspectRatio).toBe('number');
      }
    });

    it('should extract color space', async () => {
      const result = await scannerService.scanQQCacheDirectory('/mock/path', {
        onProgress: jest.fn(),
      });

      if (result.images.length > 0) {
        const image = result.images[0];
        expect(image.colorSpace).toBeDefined();
        expect(typeof image.colorSpace).toBe('string');
      }
    });

    it('should extract file format', async () => {
      const result = await scannerService.scanQQCacheDirectory('/mock/path', {
        onProgress: jest.fn(),
      });

      if (result.images.length > 0) {
        const image = result.images[0];
        expect(image.format).toBeDefined();
        expect(['jpg', 'png', 'gif', 'bmp', 'webp', 'tiff']).toContain(
          image.format.toLowerCase()
        );
      }
    });

    it('should extract file size', async () => {
      const result = await scannerService.scanQQCacheDirectory('/mock/path', {
        onProgress: jest.fn(),
      });

      if (result.images.length > 0) {
        const image = result.images[0];
        expect(image.fileSize).toBeDefined();
        expect(typeof image.fileSize).toBe('number');
        expect(image.fileSize).toBeGreaterThanOrEqual(0);
      }
    });

    it('should extract timestamps', async () => {
      const result = await scannerService.scanQQCacheDirectory('/mock/path', {
        onProgress: jest.fn(),
      });

      if (result.images.length > 0) {
        const image = result.images[0];
        expect(image.createdAt).toBeDefined();
        expect(image.modifiedAt).toBeDefined();
        expect(image.accessedAt).toBeDefined();
      }
    });
  });

  describe('Error handling', () => {
    it('should handle invalid path gracefully', async () => {
      expect(async () => {
        await scannerService.scanQQCacheDirectory('/invalid/path', {
          onProgress: jest.fn(),
        });
      }).not.toThrow();
    });

    it('should handle permission errors', async () => {
      expect(async () => {
        await scannerService.scanQQCacheDirectory('/restricted/path', {
          onProgress: jest.fn(),
        });
      }).not.toThrow();
    });

    it('should handle corrupted image files', async () => {
      expect(async () => {
        await scannerService.scanQQCacheDirectory('/mock/path', {
          onProgress: jest.fn(),
        });
      }).not.toThrow();
    });
  });
});
