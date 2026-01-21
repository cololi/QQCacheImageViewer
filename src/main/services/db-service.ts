/**
 * Database service for QQ Cache Image Viewer
 * Handles database initialization and image data operations
 */

import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import { Image, ImageMetadata, QueryParams } from '../../shared/types';

let db: Database.Database | null = null;

const getDBPath = () => {
  const dataPath = app.getPath('userData');
  return path.join(dataPath, 'qq-cache-images.db');
};

export const initializeDatabase = () => {
  try {
    const dbPath = getDBPath();
    db = new Database(dbPath);

    db.pragma('foreign_keys = ON');
    db.pragma('journal_mode = WAL');
    db.pragma('cache_size = -64000');
    db.pragma('mmap_size = 268435456');
    db.pragma('temp_store = MEMORY');
    db.pragma('synchronous = NORMAL');

    db.exec(`
      CREATE TABLE IF NOT EXISTS images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hash TEXT UNIQUE NOT NULL,
        year_month TEXT NOT NULL,
        format TEXT NOT NULL,
        file_path TEXT NOT NULL,
        thumb_path TEXT,
        file_size INTEGER,
        width INTEGER,
        height INTEGER,
        ratio REAL,
        file_time DATETIME,
        file_time_month TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(hash, year_month)
      );
    `);

    const cols = db.prepare("PRAGMA table_info(images)").all() as Array<{name:string}>;
    if (!cols.some(c => c.name === 'file_time_month')) {
      db.exec(`ALTER TABLE images ADD COLUMN file_time_month TEXT`);
      db.exec(`UPDATE images SET file_time_month = strftime('%Y-%m', file_time) WHERE file_time IS NOT NULL`);
    }

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_year_month ON images(year_month);
      CREATE INDEX IF NOT EXISTS idx_format ON images(format);
      CREATE INDEX IF NOT EXISTS idx_file_size ON images(file_size);
      CREATE INDEX IF NOT EXISTS idx_ratio ON images(ratio);
      CREATE INDEX IF NOT EXISTS idx_width ON images(width);
      CREATE INDEX IF NOT EXISTS idx_height ON images(height);
      CREATE INDEX IF NOT EXISTS idx_file_time ON images(file_time);
      CREATE INDEX IF NOT EXISTS idx_hash ON images(hash);
      CREATE INDEX IF NOT EXISTS idx_file_time_month ON images(file_time_month);
    `);

    // Create scan progress table
    db.exec(`
      CREATE TABLE IF NOT EXISTS scan_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scan_id TEXT UNIQUE,
        total_months INTEGER,
        scanned_months INTEGER,
        total_files INTEGER,
        scanned_files INTEGER,
        current_month TEXT,
        status TEXT,
        error_message TEXT,
        started_at DATETIME,
        completed_at DATETIME,
        progress_percent REAL
      );
    `);

    console.log('Database initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    return false;
  }
};

const DB_BATCH_SIZE = 500;

export const saveImages = async (images: ImageMetadata[]): Promise<boolean> => {
  if (!db) return false;

  try {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO images
      (hash, year_month, format, file_path, thumb_path, file_size, width, height, ratio, file_time, file_time_month, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    const insertBatch = db.transaction((imgs: ImageMetadata[]) => {
      for (const img of imgs) {
        const ftm = img.fileTime ? img.fileTime.substring(0, 7) : null;
        stmt.run(
          img.hash,
          img.yearMonth,
          img.format,
          img.filePath,
          img.thumbPath ?? null,
          img.fileSize,
          img.width ?? null,
          img.height ?? null,
          img.ratio ?? null,
          img.fileTime ?? null,
          ftm
        );
      }
    });

    for (let i = 0; i < images.length; i += DB_BATCH_SIZE) {
      const batch = images.slice(i, i + DB_BATCH_SIZE);
      insertBatch(batch);
      if (i + DB_BATCH_SIZE < images.length) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }
    return true;
  } catch (error) {
    console.error('Failed to save images:', error);
    return false;
  }
};

export const getImages = (params: QueryParams): Image[] => {
  if (!db) return [];

  try {
    let query = 'SELECT * FROM images WHERE 1=1';
    const sqlParams: any[] = [];

    if (params.yearMonth) {
      query += ' AND file_time_month = ?';
      sqlParams.push(params.yearMonth);
    }

    if (params.format) {
      query += ' AND format = ?';
      sqlParams.push(params.format);
    }

    if (params.sizeRange) {
      query += ' AND file_size BETWEEN ? AND ?';
      sqlParams.push(params.sizeRange[0], params.sizeRange[1]);
    }

    // Add sorting
    const sortField = params.sortField || 'file_time';
    const sortOrder = params.sortOrder === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${sortField} ${sortOrder}`;

    // Add pagination only if limit > 0
    if (params.limit > 0) {
      query += ' LIMIT ? OFFSET ?';
      sqlParams.push(params.limit, params.offset);
    }

    const stmt = db.prepare(query);
    const results = stmt.all(...sqlParams) as any[];

    return results.map(row => ({
      id: row.id,
      hash: row.hash,
      yearMonth: row.year_month,
      format: row.format,
      filePath: row.file_path,
      thumbPath: row.thumb_path,
      fileSize: row.file_size,
      width: row.width,
      height: row.height,
      ratio: row.ratio,
      fileTime: row.file_time ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (error) {
    console.error('Failed to get images:', error);
    return [];
  }
};

export const getImageCount = (yearMonth?: string): number => {
  if (!db) return 0;

  try {
    let query = 'SELECT COUNT(*) as count FROM images';
    if (yearMonth) {
      query += ` WHERE file_time_month = ?`;
      const result = db.prepare(query).get(yearMonth) as { count: number };
      return result.count;
    }
    const result = db.prepare(query).get() as { count: number };
    return result.count;
  } catch (error) {
    console.error('Failed to get image count:', error);
    return 0;
  }
};

export const getMonths = (): Array<{ yearMonth: string; count: number }> => {
  if (!db) return [];

  try {
    const query = `
      SELECT 
        file_time_month as yearMonth, 
        COUNT(*) as count
      FROM images
      WHERE file_time_month IS NOT NULL
      GROUP BY file_time_month
      ORDER BY yearMonth DESC
    `;
    return db.prepare(query).all() as Array<{ yearMonth: string; count: number }>;
  } catch (error) {
    console.error('Failed to get months:', error);
    return [];
  }
};

/**
 * Get existing image hashes for incremental scanning
 */
export const getExistingHashes = (yearMonth: string): Set<string> => {
  if (!db) return new Set();

  try {
    const query = 'SELECT hash FROM images WHERE year_month = ?';
    const results = db.prepare(query).all(yearMonth) as Array<{ hash: string }>;
    return new Set(results.map(r => r.hash));
  } catch (error) {
    console.error('Failed to get existing hashes:', error);
    return new Set();
  }
};

/**
 * Advanced query with multiple filters
 */
export const queryImages = (filters: {
  yearMonth?: string;
  formats?: string[];
  sizeRange?: [number, number];
  ratioRange?: [number, number];
  widthRange?: [number, number];
  heightRange?: [number, number];
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  offset: number;
  limit: number;
}): Image[] => {
  if (!db) return [];

  try {
    let query = 'SELECT * FROM images WHERE 1=1';
    const sqlParams: any[] = [];

    if (filters.yearMonth) {
      query += ' AND file_time_month = ?';
      sqlParams.push(filters.yearMonth);
    }

    if (filters.formats && filters.formats.length > 0) {
      const placeholders = filters.formats.map(() => '?').join(',');
      query += ` AND format IN (${placeholders})`;
      sqlParams.push(...filters.formats);
    }

    if (filters.sizeRange) {
      query += ' AND file_size BETWEEN ? AND ?';
      sqlParams.push(filters.sizeRange[0], filters.sizeRange[1]);
    }

    if (filters.ratioRange) {
      query += ' AND ratio BETWEEN ? AND ?';
      sqlParams.push(filters.ratioRange[0], filters.ratioRange[1]);
    }

    if (filters.widthRange) {
      query += ' AND width BETWEEN ? AND ?';
      sqlParams.push(filters.widthRange[0], filters.widthRange[1]);
    }

    if (filters.heightRange) {
      query += ' AND height BETWEEN ? AND ?';
      sqlParams.push(filters.heightRange[0], filters.heightRange[1]);
    }

    const sortField = filters.sortField || 'file_time';
    const sortOrder = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${sortField} ${sortOrder}`;

    if (filters.limit > 0) {
      query += ' LIMIT ? OFFSET ?';
      sqlParams.push(filters.limit, filters.offset);
    }

    const stmt = db.prepare(query);
    const results = stmt.all(...sqlParams) as any[];

    return results.map(row => ({
      id: row.id,
      hash: row.hash,
      yearMonth: row.year_month,
      format: row.format,
      filePath: row.file_path,
      thumbPath: row.thumb_path,
      fileSize: row.file_size,
      width: row.width,
      height: row.height,
      ratio: row.ratio,
      fileTime: row.file_time ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (error) {
    console.error('Failed to query images:', error);
    return [];
  }
};

/**
 * Get image statistics for caching
 */
export const getImageStats = (): {
  totalImages: number;
  totalSize: number;
  formats: Record<string, number>;
  dateRange: { min: string; max: string } | null;
} => {
  if (!db) return { totalImages: 0, totalSize: 0, formats: {}, dateRange: null };

  try {
    // Total images and size
    const statsQuery = `
      SELECT COUNT(*) as totalImages, SUM(file_size) as totalSize
      FROM images
    `;
    const stats = db.prepare(statsQuery).get() as { totalImages: number; totalSize: number };

    // Format distribution
    const formatsQuery = `
      SELECT format, COUNT(*) as count
      FROM images
      GROUP BY format
    `;
    const formats: Record<string, number> = {};
    (db.prepare(formatsQuery).all() as Array<{ format: string; count: number }>).forEach((row) => {
      formats[row.format.toLowerCase()] = row.count;
    });

    // Date range
    const dateRangeQuery = `
      SELECT MIN(file_time) as minDate, MAX(file_time) as maxDate
      FROM images
    `;
    const dateResult = db.prepare(dateRangeQuery).get() as { minDate: string; maxDate: string } | null;

    return {
      totalImages: stats.totalImages || 0,
      totalSize: stats.totalSize || 0,
      formats,
      dateRange: dateResult ? { min: dateResult.minDate, max: dateResult.maxDate } : null,
    };
  } catch (error) {
    console.error('Failed to get image stats:', error);
    return { totalImages: 0, totalSize: 0, formats: {}, dateRange: null };
  }
};

/**
 * Search images by keywords
 */
export const searchImages = (
  keyword: string,
  limit: number = 100
): Image[] => {
  if (!db || !keyword) return [];

  try {
    const searchTerm = `%${keyword}%`;
    const query = `
      SELECT * FROM images
      WHERE hash LIKE ? OR file_path LIKE ?
      LIMIT ?
    `;
    const results = db.prepare(query).all(searchTerm, searchTerm, limit) as any[];

    return results.map(row => ({
      id: row.id,
      hash: row.hash,
      yearMonth: row.year_month,
      format: row.format,
      filePath: row.file_path,
      thumbPath: row.thumb_path,
      fileSize: row.file_size,
      width: row.width,
      height: row.height,
      ratio: row.ratio,
      fileTime: row.file_time ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (error) {
    console.error('Failed to search images:', error);
    return [];
  }
};

/**
 * Clear old cache data
 */
export const clearOldCache = (daysOld: number = 90): boolean => {
  if (!db) return false;

  try {
    const query = `
      DELETE FROM images
      WHERE updated_at < datetime('now', '-${daysOld} days')
    `;
    db.prepare(query).run();
    return true;
  } catch (error) {
    console.error('Failed to clear old cache:', error);
    return false;
  }
};

/**
 * Delete images by ID list. Returns the file paths of deleted rows
 * so the caller can remove the physical files.
 */
export const deleteImages = (ids: number[]): { filePaths: string[] } => {
  if (!db || ids.length === 0) return { filePaths: [] };

  try {
    const placeholders = ids.map(() => '?').join(',');
    const selectStmt = db.prepare(
      `SELECT file_path FROM images WHERE id IN (${placeholders})`
    );
    const rows = selectStmt.all(...ids) as Array<{ file_path: string }>;
    const filePaths = rows.map((r) => r.file_path);

    const deleteStmt = db.prepare(
      `DELETE FROM images WHERE id IN (${placeholders})`
    );
    deleteStmt.run(...ids);

    return { filePaths };
  } catch (error) {
    console.error('Failed to delete images:', error);
    return { filePaths: [] };
  }
};

/**
 * Delete all images whose file_time falls within the given year-month.
 * Returns the file paths so the caller can remove the physical files.
 */
export const deleteImagesByMonth = (yearMonth: string): { filePaths: string[] } => {
  if (!db || !yearMonth) return { filePaths: [] };

  try {
    const selectStmt = db.prepare(
      'SELECT file_path FROM images WHERE file_time_month = ?'
    );
    const rows = selectStmt.all(yearMonth) as Array<{ file_path: string }>;
    const filePaths = rows.map((r) => r.file_path);

    const deleteStmt = db.prepare(
      'DELETE FROM images WHERE file_time_month = ?'
    );
    deleteStmt.run(yearMonth);

    return { filePaths };
  } catch (error) {
    console.error('Failed to delete images by month:', error);
    return { filePaths: [] };
  }
};

/**
 * Optimize database (VACUUM)
 */
export const optimizeDatabase = (): boolean => {
  if (!db) return false;

  try {
    db.prepare('VACUUM').run();
    return true;
  } catch (error) {
    console.error('Failed to optimize database:', error);
    return false;
  }
};

export const closeDatabase = () => {
  if (db) {
    db.close();
    db = null;
  }
};
