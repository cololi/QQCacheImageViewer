/**
 * Image scanner service for QQ cache directory
 * Handles scanning QQ cache paths and extracting image metadata
 */

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import sharp from 'sharp';
import { ImageMetadata } from '../../shared/types';

import { app } from 'electron';

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const access = promisify(fs.access);


// 并发控制
const SHARP_CONCURRENCY = 4;
const FILE_BATCH_SIZE = 8;

// 动态导入 p-limit (ESM 模块)
let sharpLimit: ReturnType<typeof import('p-limit').default>;
const initPLimit = async () => {
  if (!sharpLimit) {
    const pLimit = (await import('p-limit')).default;
    sharpLimit = pLimit(SHARP_CONCURRENCY);
  }
  return sharpLimit;
};

const SUPPORTED_FORMATS = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'tif'];

export interface ScanOptions {
  paths?: string[];
  incremental?: boolean;
  includeTemp?: boolean;
}

/**
 * Detect all available QQ cache directories
 */
export const detectQQCachePaths = async (): Promise<string[]> => {
  const validPaths: string[] = [];
  try {
    const roots = new Set<string>();

    // Add standard system paths
    try {
      roots.add(path.join(app.getPath('documents'), 'Tencent Files'));
    } catch (e) {
      console.warn('Could not get documents path', e);
    }

    // Add fallback paths
    const username = process.env.USERNAME || 'admin';
    roots.add(`C:\\Users\\${username}\\Documents\\Tencent Files`);
    roots.add(`C:\\Users\\${username}\\AppData\\Local\\Tencent`);

    console.log('Scanning for QQ directories in roots:', [...roots]);

    // 并发检查所有根目录
    const rootResults = await Promise.allSettled(
      Array.from(roots).map(async (basePath) => {
        try {
          await access(basePath, fs.constants.F_OK);
          return basePath;
        } catch {
          return null;
        }
      })
    );

    const existingRoots = rootResults
      .filter(r => r.status === 'fulfilled' && r.value !== null)
      .map(r => (r as PromiseFulfilledResult<string>).value);

    // 并发扫描所有根目录
    for (const basePath of existingRoots) {
      try {
        const entries = await readdir(basePath);

        // 并发检查所有QQ账号目录
        const pathChecks = entries
          .filter(entry => /^\d+$/.test(entry))
          .map(async (entry) => {
            const accountBase = path.join(basePath, entry, 'nt_qq', 'nt_data');
            const paths: string[] = [];

            // 并发检查 Pic 和 Thumb 目录
            const [picExists, thumbExists] = await Promise.all([
              access(path.join(accountBase, 'Pic'), fs.constants.F_OK)
                .then(() => true)
                .catch(() => false),
              access(path.join(accountBase, 'File', 'Thumb'), fs.constants.F_OK)
                .then(() => true)
                .catch(() => false),
            ]);

            if (picExists) {
              const picPath = path.join(accountBase, 'Pic');
              console.log('Found QQ Pic directory:', picPath);
              paths.push(picPath);
            }

            if (thumbExists) {
              const thumbPath = path.join(accountBase, 'File', 'Thumb');
              console.log('Found QQ Thumb directory:', thumbPath);
              paths.push(thumbPath);
            }

            return paths;
          });

        const allPaths = await Promise.all(pathChecks);
        validPaths.push(...allPaths.flat());
      } catch (err) {
        console.warn(`Error scanning root ${basePath}:`, err);
      }
    }
  } catch (error) {
    console.error('Failed to detect QQ cache paths:', error);
  }
  return [...new Set(validPaths)];
};

/**
 * Validate if directory is a valid QQ cache directory (async)
 */
export const validateDirectory = async (dirPath: string): Promise<boolean> => {
  try {
    await access(dirPath, fs.constants.F_OK);
    const statResult = await stat(dirPath);
    return statResult.isDirectory();
  } catch (error) {
    return false;
  }
};

/**
 * Get image dimensions from file with concurrency limit
 */
export const getImageDimensions = async (filePath: string): Promise<{ width?: number; height?: number }> => {
  const limit = await initPLimit();
  return limit(async () => {
    try {
      const metadata = await sharp(filePath).metadata();
      return {
        width: metadata.width,
        height: metadata.height,
      };
    } catch (error) {
      console.error(`Failed to get dimensions for ${filePath}:`, error);
      return {};
    }
  });
};

/**
 * Check if thumbnail exists and return path (async version)
 */
export const getThumbnailPath = async (basePath: string, yearMonth: string, hash: string, format: string): Promise<string | undefined> => {
  const sizes = [0, 720];
  const thumbPaths = sizes.map(size =>
    path.join(basePath, yearMonth, 'Thumb', `${hash}_${size}.${format}`)
  );

  // 并发检查所有路径
  const results = await Promise.allSettled(
    thumbPaths.map(p => access(p, fs.constants.F_OK).then(() => p))
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      return result.value;
    }
  }

  return undefined;
};

/**
 * Process a single file and extract metadata
 */
const processFile = async (
  file: string,
  basePath: string,
  yearMonth: string,
  oriPath: string,
  existingHashes?: Set<string>
): Promise<ImageMetadata | null> => {
  try {
    const hash = path.basename(file, path.extname(file));

    // 增量扫描: 跳过已存在的图片
    if (existingHashes && existingHashes.has(hash)) {
      return null;
    }

    const filePath = path.join(oriPath, file);
    const fileStat = await stat(filePath);

    if (!fileStat.isFile()) return null;

    const ext = path.extname(file).slice(1).toLowerCase();
    if (!SUPPORTED_FORMATS.includes(ext)) return null;

    const thumbPath = await getThumbnailPath(basePath, yearMonth, hash, ext);

    // Get dimensions from thumbnail if available, otherwise from original
    let dimensions: { width?: number; height?: number } = {};
    const imageSource = thumbPath || filePath;
    try {
      await access(imageSource, fs.constants.F_OK);
      dimensions = await getImageDimensions(imageSource);
    } catch {
      // Skip if file not accessible
    }

    const ratio = dimensions.width && dimensions.height
      ? dimensions.width / dimensions.height
      : undefined;

    return {
      hash,
      format: ext,
      yearMonth,
      filePath,
      thumbPath,
      fileSize: fileStat.size,
      width: dimensions.width,
      height: dimensions.height,
      ratio,
      fileTime: fileStat.mtime.toISOString(),
    };
  } catch (error) {
    console.error(`Error processing file ${file}:`, error);
    return null;
  }
};

/**
 * Scan a single month directory with batch processing
 */
export const scanMonthDirectory = async (
  basePath: string,
  yearMonth: string,
  onProgress?: (processed: number, total: number) => void,
  existingHashes?: Set<string>
): Promise<ImageMetadata[]> => {
  const images: ImageMetadata[] = [];
  const monthPath = path.join(basePath, yearMonth);
  const oriPath = path.join(monthPath, 'Ori');

  try {
    // 异步检查目录是否存在
    try {
      await access(oriPath, fs.constants.F_OK);
    } catch {
      return images;
    }

    const files = await readdir(oriPath);
    const totalFiles = files.length;
    let processed = 0;

    // 批量并发处理文件
    for (let i = 0; i < files.length; i += FILE_BATCH_SIZE) {
      const batch = files.slice(i, Math.min(i + FILE_BATCH_SIZE, files.length));

      const results = await Promise.all(
        batch.map(file => processFile(file, basePath, yearMonth, oriPath, existingHashes))
      );

      // 收集成功处理的图片
      for (const result of results) {
        if (result) {
          images.push(result);
        }
        processed++;
      }

      // 报告进度
      if (onProgress) {
        onProgress(processed, totalFiles);
      }
    }

    return images;
  } catch (error) {
    console.error(`Failed to scan month directory ${yearMonth}:`, error);
    return images;
  }
};

/**
 * Get all available months in QQ cache directory (async)
 */
export const getAvailableMonths = async (basePath: string): Promise<string[]> => {
  try {
    // 异步检查基础路径是否存在
    try {
      await access(basePath, fs.constants.F_OK);
    } catch {
      return [];
    }

    const entries = await readdir(basePath);

    // 并发检查所有条目是否为目录
    const checkResults = await Promise.allSettled(
      entries.map(async (entry) => {
        // Match format: YYYY-MM
        if (!/^\d{4}-\d{2}$/.test(entry)) {
          return null;
        }

        const entryPath = path.join(basePath, entry);
        try {
          const statResult = await stat(entryPath);
          return statResult.isDirectory() ? entry : null;
        } catch {
          return null;
        }
      })
    );

    const months = checkResults
      .filter(result => result.status === 'fulfilled' && result.value !== null)
      .map(result => (result as PromiseFulfilledResult<string>).value);

    return months.sort().reverse();
  } catch (error) {
    console.error('Failed to get available months:', error);
    return [];
  }
};

/**
 * Scan entire QQ cache directory
 */
/**
 * Scan entire QQ cache directory (supports multiple roots)
 */
export const scanQQCacheDirectory = async (
  basePathOrPaths: string | string[],
  options: ScanOptions = {},
  onProgress?: (month: string, processed: number, total: number, percent: number) => void
): Promise<ImageMetadata[]> => {
  const allImages: ImageMetadata[] = [];
  const basePaths = Array.isArray(basePathOrPaths) ? basePathOrPaths : [basePathOrPaths];

  if (basePaths.length === 0) {
    throw new Error('未提供扫描路径');
  }

  try {
    // 1. Collect all valid months from all paths
    const tasks: { basePath: string; month: string }[] = [];

    for (const basePath of basePaths) {
      if (!(await validateDirectory(basePath))) {
        console.warn(`Skipping invalid directory: ${basePath}`);
        continue;
      }

      const months = await getAvailableMonths(basePath);
      for (const month of months) {
        tasks.push({ basePath, month });
      }
    }

    if (tasks.length === 0) {
      console.warn('No scan tasks found (no months directories in any provided paths)');
      return [];
    }

    // 2. Scan each task
    let totalScanned = 0;
    // We don't know total files ahead of time unless we count them first, 
    // but we can estimate or just use task count for coarse progress, 
    // or rely on the previous implementation's style which accumulates total files as it goes? 
    // The previous implementation used `totalFiles` (accumulated) and `totalScanned` (accumulated count of files).
    // It passed `files.length` to onProgress.

    // To provide consistent progress, we might want to just count tasks (months) or do a quick file count.
    // Let's stick to the previous pattern: 
    // It passed: onProgress(month, totalScanned, totalFiles + total, percent)

    // Since we are iterating multiple paths/months, let's treat the progress bar as 0-100% based on TASKS (months) 
    // or keep the file counter if possible.
    // The original code calculated percent based on `totalScanned` / `months.length` which is WRONG if it meant files vs months. 
    // Original: `const percent = (totalScanned / (months.length * 100)) * 100;` 
    // Wait, `processed` passed from `scanMonthDirectory` is number of files.
    // So `totalScanned` is total files scanned so far.
    // But it divided by `months.length`? That seems weird in the original code unless `months.length * 100` was an arbitrary estimate that 1 month = 100 files?
    // Actually looking at original: `const percent = (totalScanned / (months.length * 100)) * 100` -> `totalScanned / months.length`. 
    // This implies `totalScanned` is NOT files but... wait:
    // `scanMonthDirectory` calls callback with `(processed, total_files_in_month)`.
    // In `scanQQCacheDirectory`: `totalScanned++` is inside the callback.
    // So `totalScanned` counts callback invocations? 
    // NO! `scanMonthDirectory` calls `onProgress` for EVERY file?
    // Let's check `scanMonthDirectory`.
    // Line 165: `onProgress(processed, files.length)`.
    // Yes, it's called per file.
    // So `totalScanned` in `scanQQCacheDirectory` tracks total files across all months.
    // And `percent` calculation `(totalScanned / (months.length * 100)) * 100` assumes roughly 100 files per month? That's a very rough heuristic.

    // Let's improve this. We know `tasks.length` (total months).
    // We can't easily know total files without listing them all first.
    // Let's use `tasks.length` to determine completion percentage roughly, OR update percent based on `taskIndex / tasks.length`.

    let currentTaskIndex = 0;

    for (const task of tasks) {
      try {
        const images = await scanMonthDirectory(task.basePath, task.month, (processed, total) => {
          const basePercent = (currentTaskIndex / tasks.length) * 100;
          const taskPercent = (processed / total) * (100 / tasks.length);
          const totalPercent = Math.min(100, Math.round(basePercent + taskPercent));
          if (onProgress) {
            onProgress(task.month, totalScanned + processed, 0, totalPercent);
          }
        });

        allImages.push(...images);
        totalScanned += images.length;
        currentTaskIndex++;

      } catch (error) {
        console.error(`Error scanning month ${task.month} in ${task.basePath}:`, error);
        currentTaskIndex++; // Still advance task index
        continue;
      }
    }

    return allImages;
  } catch (error) {
    console.error('Failed to scan QQ cache directory:', error);
    throw error;
  }
};

