/**
 * Database service for QQ Cache Image Viewer
 * Handles database initialization and image data operations
 */

import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import { Image, ImageMetadata, QueryParams } from '../../shared/types';

let db: Database.Database | null = null;

/**
 * Whitelist of accepted sort field aliases mapped to safe SQL column expressions.
 * Renderer-supplied sortField values are untrusted; only keys present here are honored.
 * Includes both public SortField values (types.ts) and legacy/internal column names.
 */
const SORT_FIELD_MAP: Record<string, string> = {
  name: 'file_path',
  size: 'file_size',
  width: 'width',
  height: 'height',
  pixels: '(width * height)',
  ratio: 'ratio',
  mtime: 'file_time',
  file_time: 'file_time',
  file_size: 'file_size',
  file_path: 'file_path',
};

function safeOrderBy(field: string | undefined, order: string | undefined): string {
  const col = SORT_FIELD_MAP[field ?? ''] ?? 'file_time';
  const dir = order === 'asc' ? 'ASC' : 'DESC';
  return ` ORDER BY ${col} ${dir}`;
}

function addRangeClause(
  column: string,
  range: [number, number] | undefined,
  queryParts: string[],
  sqlParams: (string | number)[],
): void {
  if (!range) return;
  const [min, max] = range;
  if (Number.isFinite(min) && min > 0) {
    queryParts.push(` AND ${column} >= ?`);
    sqlParams.push(min);
  }
  if (Number.isFinite(max)) {
    queryParts.push(` AND ${column} <= ?`);
    sqlParams.push(max);
  }
}

/**
 * Defensive bounds for paginated queries.
 * Renderer-supplied limit/offset values are untrusted; clamp to safe ranges
 * so that a malicious or buggy `limit: 999999` cannot allocate huge arrays.
 */
const MAX_QUERY_LIMIT = 500;
const DEFAULT_QUERY_LIMIT = 100;

function clampLimit(limit: number | undefined): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit) || limit <= 0) {
    return DEFAULT_QUERY_LIMIT;
  }
  return Math.min(Math.floor(limit), MAX_QUERY_LIMIT);
}

function clampOffset(offset: number | undefined): number {
  if (typeof offset !== 'number' || !Number.isFinite(offset) || offset < 0) {
    return 0;
  }
  return Math.floor(offset);
}

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
    db.pragma('cache_size = -16000');
    db.pragma('mmap_size = 67108864');
    db.pragma('temp_store = FILE');
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

    const cols = db.prepare('PRAGMA table_info(images)').all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === 'file_time_month')) {
      db.exec(`ALTER TABLE images ADD COLUMN file_time_month TEXT`);
      db.exec(
        `UPDATE images SET file_time_month = strftime('%Y-%m', file_time) WHERE file_time IS NOT NULL`,
      );
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
          ftm,
        );
      }
    });

    for (let i = 0; i < images.length; i += DB_BATCH_SIZE) {
      const batch = images.slice(i, i + DB_BATCH_SIZE);
      insertBatch(batch);
      if (i + DB_BATCH_SIZE < images.length) {
        await new Promise((resolve) => setImmediate(resolve));
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
    const queryParts = ['SELECT * FROM images WHERE 1=1'];
    const sqlParams: (string | number)[] = [];

    if (params.yearMonth) {
      queryParts.push(' AND file_time_month = ?');
      sqlParams.push(params.yearMonth);
    }

    const formats = params.formats?.length ? params.formats : params.format ? [params.format] : [];
    if (formats.length > 0) {
      const placeholders = formats.map(() => '?').join(',');
      queryParts.push(` AND format IN (${placeholders})`);
      sqlParams.push(...formats.map((format) => format.toLowerCase()));
    }

    addRangeClause('file_size', params.sizeRange, queryParts, sqlParams);
    addRangeClause('ratio', params.ratioRange, queryParts, sqlParams);

    const categoryClauses: string[] = [];
    for (const category of params.categories ?? []) {
      if (category === 'portrait') categoryClauses.push('ratio < 0.8');
      if (category === 'landscape') categoryClauses.push('ratio > 1.25');
      if (category === 'square') categoryClauses.push('(ratio >= 0.8 AND ratio <= 1.25)');
    }
    if (categoryClauses.length > 0) {
      queryParts.push(` AND (${categoryClauses.join(' OR ')})`);
    }

    // Add sorting (whitelist field, fixed direction — prevents SQL injection)
    queryParts.push(safeOrderBy(params.sortField, params.sortOrder));

    // Always apply pagination — clamped values are guaranteed safe and positive
    queryParts.push(' LIMIT ? OFFSET ?');
    sqlParams.push(clampLimit(params.limit), clampOffset(params.offset));

    const stmt = db.prepare(queryParts.join(''));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = stmt.all(...sqlParams) as any[];

    return results.map((row) => ({
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
 * Delete images by ID list. Returns the file paths of deleted rows
 * so the caller can remove the physical files.
 */
export const deleteImages = (ids: number[]): { filePaths: string[] } => {
  if (!db || ids.length === 0) return { filePaths: [] };

  try {
    const work = (idsArg: number[]): string[] => {
      const placeholders = idsArg.map(() => '?').join(',');
      const rows = db!
        .prepare(`SELECT file_path FROM images WHERE id IN (${placeholders})`)
        .all(...idsArg) as Array<{ file_path: string }>;
      db!.prepare(`DELETE FROM images WHERE id IN (${placeholders})`).run(...idsArg);
      return rows.map((r) => r.file_path);
    };

    const filePaths = typeof db.transaction === 'function' ? db.transaction(work)(ids) : work(ids);

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
    const work = (ym: string): string[] => {
      const rows = db!
        .prepare('SELECT file_path FROM images WHERE file_time_month = ?')
        .all(ym) as Array<{ file_path: string }>;
      db!.prepare('DELETE FROM images WHERE file_time_month = ?').run(ym);
      return rows.map((r) => r.file_path);
    };

    const filePaths =
      typeof db.transaction === 'function' ? db.transaction(work)(yearMonth) : work(yearMonth);

    return { filePaths };
  } catch (error) {
    console.error('Failed to delete images by month:', error);
    return { filePaths: [] };
  }
};

export const closeDatabase = (): void => {
  if (db) {
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
    } catch (e) {
      console.warn('wal_checkpoint failed during close:', e);
    }
    db.close();
    db = null;
  }
};
