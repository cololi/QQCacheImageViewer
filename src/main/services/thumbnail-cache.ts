/**
 * Thumbnail caching service
 * Generates and caches image thumbnails for faster loading
 */

import sharp from 'sharp';
import path from 'path';
import fs from 'fs-extra';
import { app } from 'electron';
import crypto from 'crypto';

const THUMBNAIL_SIZE = 200;
const THUMBNAIL_QUALITY = 80;

// Concurrency limits — sharp is CPU-bound, fs.stat is cheap
const SHARP_CONCURRENCY = 4;
const STAT_CONCURRENCY = 16;

// Dynamically import p-limit (ESM-only module) — mirrors image-scanner.ts pattern
type Limiter = ReturnType<typeof import('p-limit').default>;
let sharpLimit: Limiter;
let statLimit: Limiter;

const initSharpLimit = async (): Promise<Limiter> => {
  if (!sharpLimit) {
    const pLimit = (await import('p-limit')).default;
    sharpLimit = pLimit(SHARP_CONCURRENCY);
  }
  return sharpLimit;
};

const initStatLimit = async (): Promise<Limiter> => {
  if (!statLimit) {
    const pLimit = (await import('p-limit')).default;
    statLimit = pLimit(STAT_CONCURRENCY);
  }
  return statLimit;
};

// Memoization layer for cache stats — UI doesn't need real-time accuracy
interface CachedValue<T> {
  value: T;
  expiresAt: number;
}
const CACHE_TTL_MS = 30_000;
let cachedSize: CachedValue<number> | null = null;
let cachedCount: CachedValue<number> | null = null;

function isFresh<T>(c: CachedValue<T> | null): c is CachedValue<T> {
  return c !== null && c.expiresAt > Date.now();
}

function invalidateCacheStats(): void {
  cachedSize = null;
  cachedCount = null;
}

const getThumbnailCacheDir = () => {
  const dataPath = app.getPath('userData');
  return path.join(dataPath, 'thumbnails');
};

const generateThumbnailPath = (filePath: string): string => {
  const hash = crypto.createHash('md5').update(filePath).digest('hex');
  const cacheDir = getThumbnailCacheDir();
  return path.join(cacheDir, `${hash}.jpg`);
};

export async function generateThumbnail(imagePath: string, force = false): Promise<string | null> {
  try {
    const thumbnailPath = generateThumbnailPath(imagePath);
    const cacheDir = getThumbnailCacheDir();
    await fs.ensureDir(cacheDir);

    if (!force && fs.existsSync(thumbnailPath)) {
      return thumbnailPath;
    }

    await sharp(imagePath)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: THUMBNAIL_QUALITY, progressive: true })
      .toFile(thumbnailPath);

    // A new file was (re)written — invalidate stats. Cost is negligible vs sharp.
    invalidateCacheStats();

    return thumbnailPath;
  } catch (error) {
    console.error(`Failed to generate thumbnail for ${imagePath}:`, error);
    return null;
  }
}

export async function getThumbnail(imagePath: string): Promise<string | null> {
  try {
    const thumbnailPath = generateThumbnailPath(imagePath);
    if (fs.existsSync(thumbnailPath)) {
      return thumbnailPath;
    }
    return await generateThumbnail(imagePath);
  } catch (error) {
    console.error(`Failed to get thumbnail for ${imagePath}:`, error);
    return null;
  }
}

/**
 * Generate thumbnails in batch with bounded concurrency
 */
export async function generateThumbnailsBatch(
  imagePaths: string[],
): Promise<{ success: number; failed: number }> {
  const limit = await initSharpLimit();

  const results = await Promise.allSettled(
    imagePaths.map((imagePath) =>
      limit(async () => {
        try {
          return await generateThumbnail(imagePath);
        } catch (error) {
          console.error(`Failed to process ${imagePath}:`, error);
          return null;
        }
      }),
    ),
  );

  let success = 0;
  let failed = 0;
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) {
      success++;
    } else {
      failed++;
    }
  }

  return { success, failed };
}

/**
 * Clear all cached thumbnails
 */
export async function clearThumbnailCache(): Promise<boolean> {
  try {
    const cacheDir = getThumbnailCacheDir();
    if (fs.existsSync(cacheDir)) {
      await fs.remove(cacheDir);
    }
    invalidateCacheStats();
    return true;
  } catch (error) {
    console.error('Failed to clear thumbnail cache:', error);
    return false;
  }
}

/**
 * Get thumbnail cache size in bytes (memoized 30s, concurrent stat)
 */
export async function getThumbnailCacheSize(): Promise<number> {
  if (isFresh(cachedSize)) {
    return cachedSize.value;
  }

  try {
    const cacheDir = getThumbnailCacheDir();
    if (!(await fs.pathExists(cacheDir))) {
      cachedSize = { value: 0, expiresAt: Date.now() + CACHE_TTL_MS };
      return 0;
    }

    const limit = await initStatLimit();
    const files = await fs.readdir(cacheDir);

    const sizes = await Promise.all(
      files.map((file) =>
        limit(async () => {
          try {
            const fileStat = await fs.stat(path.join(cacheDir, file));
            return fileStat.isFile() ? fileStat.size : 0;
          } catch {
            return 0;
          }
        }),
      ),
    );

    const totalSize = sizes.reduce((a, b) => a + b, 0);
    cachedSize = { value: totalSize, expiresAt: Date.now() + CACHE_TTL_MS };
    return totalSize;
  } catch (error) {
    console.error('Failed to get thumbnail cache size:', error);
    return 0;
  }
}

/**
 * Get thumbnail file count (memoized 30s)
 */
export async function getThumbnailCount(): Promise<number> {
  if (isFresh(cachedCount)) {
    return cachedCount.value;
  }

  try {
    const cacheDir = getThumbnailCacheDir();
    if (!(await fs.pathExists(cacheDir))) {
      cachedCount = { value: 0, expiresAt: Date.now() + CACHE_TTL_MS };
      return 0;
    }

    const files = await fs.readdir(cacheDir);
    const count = files.filter((file) => file.endsWith('.jpg')).length;
    cachedCount = { value: count, expiresAt: Date.now() + CACHE_TTL_MS };
    return count;
  } catch (error) {
    console.error('Failed to get thumbnail count:', error);
    return 0;
  }
}

/**
 * Clean up old thumbnails with concurrent stat + unlink
 */
export async function cleanupOldThumbnails(
  maxAgeMs: number = 7 * 24 * 60 * 60 * 1000,
): Promise<number> {
  try {
    const cacheDir = getThumbnailCacheDir();
    if (!(await fs.pathExists(cacheDir))) {
      return 0;
    }

    const limit = await initStatLimit();
    const now = Date.now();
    const files = await fs.readdir(cacheDir);

    const results = await Promise.all(
      files.map((file) =>
        limit(async () => {
          const filePath = path.join(cacheDir, file);
          try {
            const fileStat = await fs.stat(filePath);
            const age = now - fileStat.mtimeMs;

            if (age > maxAgeMs && fileStat.isFile()) {
              try {
                await fs.unlink(filePath);
                return 1;
              } catch (error) {
                console.error(`Failed to delete ${filePath}:`, error);
                return 0;
              }
            }
          } catch {
            // ignore stat errors — file may have been removed concurrently
          }
          return 0;
        }),
      ),
    );

    const deletedCount = results.reduce<number>((a, b) => a + b, 0);
    if (deletedCount > 0) {
      invalidateCacheStats();
    }
    return deletedCount;
  } catch (error) {
    console.error('Failed to cleanup old thumbnails:', error);
    return 0;
  }
}
