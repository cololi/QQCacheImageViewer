/**
 * Tests for delete-related db-service functions.
 * Kept separate from db-service.test.ts which has pre-existing TS errors
 * unrelated to this feature.
 */

import * as dbService from '../db-service';

jest.mock('better-sqlite3', () => {
  const mockDb = {
    pragma: jest.fn(),
    exec: jest.fn(),
    prepare: jest.fn(),
    close: jest.fn(),
  };
  return jest.fn(() => mockDb);
});

jest.mock('electron', () => ({
  app: {
    getPath: jest.fn((type) => {
      if (type === 'userData') return '/mock/user/data';
      return '/mock/path';
    }),
  },
}));

describe('Database Service — delete operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('deleteImages', () => {
    let mockPrepareImpl: jest.Mock;
    let mockSelectStmt: { all: jest.Mock };
    let mockDeleteStmt: { run: jest.Mock };

    beforeEach(() => {
      mockSelectStmt = {
        all: jest
          .fn()
          .mockReturnValue([{ file_path: '/path/a.jpg' }, { file_path: '/path/b.png' }]),
      };
      mockDeleteStmt = { run: jest.fn() };
      mockPrepareImpl = jest.fn((sql: string) => {
        if (sql.toUpperCase().startsWith('SELECT')) return mockSelectStmt;
        return mockDeleteStmt;
      });

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Database = require('better-sqlite3');
      Database.mockImplementation(() => ({
        pragma: jest.fn(),
        exec: jest.fn(),
        prepare: mockPrepareImpl,
        close: jest.fn(),
      }));
      dbService.initializeDatabase();
    });

    it('returns the file paths of deleted rows', () => {
      const result = dbService.deleteImages([1, 2]);
      expect(result.filePaths).toEqual(['/path/a.jpg', '/path/b.png']);
    });

    it('runs SELECT then DELETE with the same id list', () => {
      dbService.deleteImages([10, 20, 30]);
      expect(mockSelectStmt.all).toHaveBeenCalledWith(10, 20, 30);
      expect(mockDeleteStmt.run).toHaveBeenCalledWith(10, 20, 30);
    });

    it('returns empty filePaths for empty id list without querying', () => {
      const result = dbService.deleteImages([]);
      expect(result.filePaths).toEqual([]);
      expect(mockSelectStmt.all).not.toHaveBeenCalled();
    });
  });

  describe('deleteImagesByMonth', () => {
    let mockSelectStmt: { all: jest.Mock };
    let mockDeleteStmt: { run: jest.Mock };

    beforeEach(() => {
      mockSelectStmt = {
        all: jest
          .fn()
          .mockReturnValue([{ file_path: '/path/jan-a.jpg' }, { file_path: '/path/jan-b.png' }]),
      };
      mockDeleteStmt = { run: jest.fn() };

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Database = require('better-sqlite3');
      Database.mockImplementation(() => ({
        pragma: jest.fn(),
        exec: jest.fn(),
        prepare: jest.fn((sql: string) =>
          sql.toUpperCase().startsWith('SELECT') ? mockSelectStmt : mockDeleteStmt,
        ),
        close: jest.fn(),
      }));
      dbService.initializeDatabase();
    });

    it('returns file paths from rows matching the year-month', () => {
      const result = dbService.deleteImagesByMonth('2026-01');
      expect(result.filePaths).toEqual(['/path/jan-a.jpg', '/path/jan-b.png']);
    });

    it('uses strftime year-month filter on file_time', () => {
      dbService.deleteImagesByMonth('2026-01');
      expect(mockSelectStmt.all).toHaveBeenCalledWith('2026-01');
      expect(mockDeleteStmt.run).toHaveBeenCalledWith('2026-01');
    });

    it('returns empty filePaths on empty yearMonth', () => {
      const result = dbService.deleteImagesByMonth('');
      expect(result.filePaths).toEqual([]);
    });
  });
});
