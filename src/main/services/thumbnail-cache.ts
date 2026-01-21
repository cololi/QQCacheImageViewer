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

const getThumbnailCacheDir = () => {
  const dataPath = app.getPath('userData');
  return path.join(dataPath, 'thumbnails');
};

const generateThumbnailPath = (filePath: string): string => {
  const hash = crypto.createHash('md5').update(filePath).digest('hex');
  const cacheDir = getThumbnailCacheDir();
  return path.join(cacheDir, `${hash}.jpg`);
};

/**
 * Generate thumbnail for an image (不使用缓存，每次都重新生成)
 */
export async function generateThumbnail(imagePath: string): Promise<string | null> {
  try {
    const thumbnailPath = generateThumbnailPath(imagePath);

    // 确保缓存目录存在
    const cacheDir = getThumbnailCacheDir();
    await fs.ensureDir(cacheDir);

    // 删除旧的缩略图（如果存在）
    if (fs.existsSync(thumbnailPath)) {
      await fs.remove(thumbnailPath);
    }

    // 每次都重新生成缩略图
    await sharp(imagePath)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: THUMBNAIL_QUALITY, progressive: true })
      .toFile(thumbnailPath);

    return thumbnailPath;
  } catch (error) {
    console.error(`Failed to generate thumbnail for ${imagePath}:`, error);
    return null;
  }
}

/**
 * 获取缩略图（每次都重新生成）
 */
export async function getThumbnail(imagePath: string): Promise<string | null> {
  try {
    // 每次都生成新的缩略图
    return await generateThumbnail(imagePath);
  } catch (error) {
    console.error(`Failed to get thumbnail for ${imagePath}:`, error);
    return null;
  }
}

/**
 * Generate thumbnails in batch
 */
export async function generateThumbnailsBatch(imagePaths: string[]): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const imagePath of imagePaths) {
    try {
      const result = await generateThumbnail(imagePath);
      if (result) {
        success++;
      } else {
        failed++;
      }
    } catch (error) {
      failed++;
      console.error(`Failed to process ${imagePath}:`, error);
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
    return true;
  } catch (error) {
    console.error('Failed to clear thumbnail cache:', error);
    return false;
  }
}

/**
 * Get thumbnail cache size in bytes
 */
export async function getThumbnailCacheSize(): Promise<number> {
  try {
    const cacheDir = getThumbnailCacheDir();
    if (!fs.existsSync(cacheDir)) {
      return 0;
    }

    let totalSize = 0;
    const files = fs.readdirSync(cacheDir);

    for (const file of files) {
      const filePath = path.join(cacheDir, file);
      const stat = fs.statSync(filePath);
      if (stat.isFile()) {
        totalSize += stat.size;
      }
    }

    return totalSize;
  } catch (error) {
    console.error('Failed to get thumbnail cache size:', error);
    return 0;
  }
}

/**
 * Get thumbnail file count
 */
export async function getThumbnailCount(): Promise<number> {
  try {
    const cacheDir = getThumbnailCacheDir();
    if (!fs.existsSync(cacheDir)) {
      return 0;
    }

    const files = fs.readdirSync(cacheDir);
    return files.filter((file) => file.endsWith('.jpg')).length;
  } catch (error) {
    console.error('Failed to get thumbnail count:', error);
    return 0;
  }
}

/**
 * Clean up old thumbnails
 */
export async function cleanupOldThumbnails(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
  try {
    const cacheDir = getThumbnailCacheDir();
    if (!fs.existsSync(cacheDir)) {
      return 0;
    }

    const now = Date.now();
    let deletedCount = 0;
    const files = fs.readdirSync(cacheDir);

    for (const file of files) {
      const filePath = path.join(cacheDir, file);
      const stat = fs.statSync(filePath);
      const age = now - stat.mtimeMs;

      if (age > maxAgeMs && stat.isFile()) {
        try {
          fs.unlinkSync(filePath);
          deletedCount++;
        } catch (error) {
          console.error(`Failed to delete ${filePath}:`, error);
        }
      }
    }

    return deletedCount;
  } catch (error) {
    console.error('Failed to cleanup old thumbnails:', error);
    return 0;
  }
}
