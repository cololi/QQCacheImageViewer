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

const sharpRuntime = sharp as typeof sharp & {
  concurrency?: (concurrency?: number) => number;
  cache?: (options?: { memory?: number; files?: number; items?: number }) => unknown;
};

sharpRuntime.concurrency?.(SHARP_CONCURRENCY);
sharpRuntime.cache?.({ memory: 32, files: 0, items: 128 });

type Task<T> = () => Promise<T>;
type Limit = <T>(task: Task<T>) => Promise<T>;
type ImageBatchHandler = (images: ImageMetadata[]) => Promise<void> | void;

function createLimit(concurrency: number): Limit {
  let activeCount = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    activeCount--;
    queue.shift()?.();
  };

  return <T>(task: Task<T>) =>
    new Promise<T>((resolve, reject) => {
      const run = () => {
        activeCount++;
        task().then(resolve, reject).finally(next);
      };

      if (activeCount < concurrency) {
        run();
      } else {
        queue.push(run);
      }
    });
}

let sharpLimit: Limit | null = null;
const getSharpLimit = (): Limit => {
  if (!sharpLimit) {
    sharpLimit = createLimit(SHARP_CONCURRENCY);
  }
  return sharpLimit;
};

const SUPPORTED_FORMATS = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'tif'];

export interface ScanOptions {
  paths?: string[];
  incremental?: boolean;
  includeTemp?: boolean;
}

// ---- Scan cancellation ------------------------------------------------------
// Module-level flag (rather than a token threaded through every call) keeps
// the cancellation surface small. The scan loop checks `isScanAborted()`
// between per-month tasks. Callers (window-close, new scan request) flip the
// flag via `abortScan()`/`resetScanAbort()`.
let scanAborted = false;

export function abortScan(): void {
  scanAborted = true;
}

export function resetScanAbort(): void {
  scanAborted = false;
}

export function isScanAborted(): boolean {
  return scanAborted;
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
      }),
    );

    const existingRoots = rootResults
      .filter((r) => r.status === 'fulfilled' && r.value !== null)
      .map((r) => (r as PromiseFulfilledResult<string>).value);

    // 并发扫描所有根目录
    for (const basePath of existingRoots) {
      try {
        const entries = await readdir(basePath);

        // 并发检查所有QQ账号目录
        const pathChecks = entries
          .filter((entry) => /^\d+$/.test(entry))
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
    const statResult = await stat(dirPath);
    return statResult.isDirectory();
  } catch (error) {
    return false;
  }
};

/**
 * Get image dimensions from file with concurrency limit
 */
export const getImageDimensions = async (
  filePath: string,
): Promise<{ width?: number; height?: number }> => {
  const limit = getSharpLimit();
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
export const getThumbnailPath = async (
  basePath: string,
  yearMonth: string,
  hash: string,
  format: string,
): Promise<string | undefined> => {
  const sizes = [0, 720];
  const thumbPaths = sizes.map((size) =>
    path.join(basePath, yearMonth, 'Thumb', `${hash}_${size}.${format}`),
  );

  // 并发检查所有路径
  const results = await Promise.allSettled(
    thumbPaths.map((p) => access(p, fs.constants.F_OK).then(() => p)),
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
  existingHashes?: Set<string>,
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

    // Get dimensions from thumbnail if available, otherwise from original.
    // sharp's own open handles a missing/unreadable file (returns {}), no pre-check needed.
    const imageSource = thumbPath || filePath;
    const dimensions = await getImageDimensions(imageSource);

    const ratio =
      dimensions.width && dimensions.height ? dimensions.width / dimensions.height : undefined;

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
  existingHashes?: Set<string>,
  onImages?: ImageBatchHandler,
): Promise<ImageMetadata[]> => {
  const images: ImageMetadata[] = [];
  const monthPath = path.join(basePath, yearMonth);
  const oriPath = path.join(monthPath, 'Ori');
  let batchHandlerError: unknown;

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
      if (scanAborted) break;

      const batch = files.slice(i, Math.min(i + FILE_BATCH_SIZE, files.length));

      const results = await Promise.all(
        batch.map((file) => processFile(file, basePath, yearMonth, oriPath, existingHashes)),
      );

      const validImages = results.filter((result): result is ImageMetadata => result !== null);
      if (validImages.length > 0) {
        if (onImages) {
          try {
            await onImages(validImages);
          } catch (error) {
            batchHandlerError = error;
            throw error;
          }
        } else {
          images.push(...validImages);
        }
      }
      processed += batch.length;

      // 报告进度
      if (onProgress) {
        onProgress(processed, totalFiles);
      }
    }

    return images;
  } catch (error) {
    if (batchHandlerError === error) {
      throw error;
    }
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
      }),
    );

    const months = checkResults
      .filter((result) => result.status === 'fulfilled' && result.value !== null)
      .map((result) => (result as PromiseFulfilledResult<string>).value);

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
  _options: ScanOptions = {},
  onProgress?: (month: string, processed: number, total: number, percent: number) => void,
  onImages?: ImageBatchHandler,
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

    // 2. Scan each task. Progress is coarse per-month: basePercent from completed
    //    tasks + the current task's fractional share. Total file count is unknown
    //    up front (would require pre-listing every Ori dir), so we don't report it.
    let processedFilesBeforeTask = 0;
    let currentTaskIndex = 0;

    for (const task of tasks) {
      if (scanAborted) {
        console.log('Scan aborted; stopping after task index', currentTaskIndex);
        break;
      }
      try {
        let processedInTask = 0;
        const images = await scanMonthDirectory(
          task.basePath,
          task.month,
          (processed, total) => {
            processedInTask = processed;
            const basePercent = (currentTaskIndex / tasks.length) * 100;
            const taskPercent = (processed / total) * (100 / tasks.length);
            const totalPercent = Math.min(100, Math.round(basePercent + taskPercent));
            if (onProgress) {
              onProgress(task.month, processedFilesBeforeTask + processed, 0, totalPercent);
            }
          },
          undefined,
          onImages,
        );

        if (!onImages) {
          allImages.push(...images);
        }
        processedFilesBeforeTask += processedInTask;
        currentTaskIndex++;
      } catch (error) {
        if (onImages) {
          throw error;
        }
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
