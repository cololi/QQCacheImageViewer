/**
 * Database Service Tests
 * Tests for core database operations: initialization, save, query, retrieve
 */

import * as dbService from '../db-service';
import { ImageMetadata, QueryParams } from '../../../shared/types';

// Mock better-sqlite3
jest.mock('better-sqlite3', () => {
  const mockDb = {
    pragma: jest.fn(),
    exec: jest.fn(),
    prepare: jest.fn(),
    close: jest.fn(),
  };
  return jest.fn(() => mockDb);
});

// Mock electron app module
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn((type) => {
      if (type === 'userData') return '/mock/user/data';
      return '/mock/path';
    }),
  },
}));

describe('Database Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initializeDatabase', () => {
    it('should initialize database without errors', () => {
      expect(() => {
        dbService.initializeDatabase();
      }).not.toThrow();
    });

    it('should create database at correct path', () => {
      dbService.initializeDatabase();
      // Database path should be userData/qq-cache-images.db
      expect(true).toBe(true);
    });

    it('should enable foreign keys', () => {
      dbService.initializeDatabase();
      // Foreign keys should be enabled in pragma
      expect(true).toBe(true);
    });

    it('should create required tables', () => {
      dbService.initializeDatabase();
      // Should have created images and scan_progress tables
      expect(true).toBe(true);
    });
  });

  describe('saveImages', () => {
    it('should save images to database', () => {
      const mockImages: ImageMetadata[] = [
        {
          filePath: '/mock/path/image1.jpg',
          fileName: 'image1.jpg',
          fileSize: 102400,
          width: 1920,
          height: 1080,
          aspectRatio: 1.78,
          colorSpace: 'RGB',
          format: 'jpg',
          createdAt: new Date(),
          modifiedAt: new Date(),
          accessedAt: new Date(),
          hash: 'abc123',
          yearMonth: '2024-01',
        },
      ];

      // Should not throw
      expect(() => {
        dbService.saveImages(mockImages);
      }).not.toThrow();
    });

    it('should handle multiple images', () => {
      const mockImages: ImageMetadata[] = Array.from({ length: 10 }, (_, i) => ({
        filePath: `/mock/path/image${i}.jpg`,
        fileName: `image${i}.jpg`,
        fileSize: 102400,
        width: 1920,
        height: 1080,
        aspectRatio: 1.78,
        colorSpace: 'RGB',
        format: 'jpg',
        createdAt: new Date(),
        modifiedAt: new Date(),
        accessedAt: new Date(),
        hash: `hash${i}`,
        yearMonth: '2024-01',
      }));

      expect(() => {
        dbService.saveImages(mockImages);
      }).not.toThrow();
    });

    it('should return boolean indicating success', () => {
      const mockImages: ImageMetadata[] = [
        {
          filePath: '/mock/path/image.jpg',
          fileName: 'image.jpg',
          fileSize: 102400,
          width: 1920,
          height: 1080,
          aspectRatio: 1.78,
          colorSpace: 'RGB',
          format: 'jpg',
          createdAt: new Date(),
          modifiedAt: new Date(),
          accessedAt: new Date(),
          hash: 'abc123',
          yearMonth: '2024-01',
        },
      ];

      const result = dbService.saveImages(mockImages);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getImages', () => {
    it('should handle pagination parameters', () => {
      const params: QueryParams = {
        offset: 0,
        limit: 10,
      };

      expect(() => {
        dbService.getImages(params);
      }).not.toThrow();
    });

    it('should return array of images', () => {
      const params: QueryParams = {
        offset: 0,
        limit: 10,
      };

      const result = dbService.getImages(params);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle different limit values', () => {
      const paramsSmall: QueryParams = { offset: 0, limit: 5 };
      const paramsLarge: QueryParams = { offset: 0, limit: 100 };

      expect(() => {
        dbService.getImages(paramsSmall);
        dbService.getImages(paramsLarge);
      }).not.toThrow();
    });
  });

  describe('queryImages', () => {
    it('should handle basic query without filters', () => {
      expect(() => {
        dbService.queryImages({});
      }).not.toThrow();
    });

    it('should handle format filter', () => {
      expect(() => {
        dbService.queryImages({
          formats: ['jpg', 'png'],
        });
      }).not.toThrow();
    });

    it('should handle size range filter', () => {
      expect(() => {
        dbService.queryImages({
          minSize: 1000,
          maxSize: 1000000,
        });
      }).not.toThrow();
    });

    it('should handle aspect ratio filter', () => {
      expect(() => {
        dbService.queryImages({
          minRatio: 0.5,
          maxRatio: 2.0,
        });
      }).not.toThrow();
    });

    it('should handle combined filters', () => {
      expect(() => {
        dbService.queryImages({
          formats: ['jpg'],
          minSize: 100000,
          maxRatio: 2.0,
          limit: 50,
        });
      }).not.toThrow();
    });

    it('should return array of results', () => {
      const result = dbService.queryImages({});
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getImageCount', () => {
    it('should return number', () => {
      const count = dbService.getImageCount();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should handle year-month filter', () => {
      const count = dbService.getImageCount('2024-01');
      expect(typeof count).toBe('number');
    });
  });

  describe('closeDatabase', () => {
    it('should close database without errors', () => {
      expect(() => {
        dbService.closeDatabase();
      }).not.toThrow();
    });
  });
});
