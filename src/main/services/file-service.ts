import { shell, dialog } from 'electron';
import fs from 'fs-extra';
import { createWriteStream } from 'fs';
import path from 'path';
import archiver from 'archiver';
import { Image } from '../../shared/types';
import { assertSafePath } from '../utils/path-guard';

/**
 * Copy a single file to destination
 */
export async function copyFile(
  source: string,
  destination: string,
): Promise<{ success: boolean; message: string }> {
  try {
    assertSafePath(source);
  } catch (e) {
    return { success: false, message: `不允许的路径: ${source}` };
  }
  try {
    assertSafePath(destination);
  } catch (e) {
    return { success: false, message: `不允许的路径: ${destination}` };
  }

  try {
    // Ensure destination directory exists
    const destDir = path.dirname(destination);
    await fs.ensureDir(destDir);

    // Copy the file
    await fs.copy(source, destination);

    return {
      success: true,
      message: `文件已复制到 ${destination}`,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '未知错误';
    return {
      success: false,
      message: `复制文件失败: ${errorMsg}`,
    };
  }
}

/**
 * Copy multiple files to destination
 */
export async function copyFiles(
  sources: string[],
  destinationFolder: string,
): Promise<{ success: boolean; copied: number; failed: number; message: string }> {
  let copied = 0;
  let failed = 0;

  try {
    assertSafePath(destinationFolder);
  } catch (e) {
    return {
      success: false,
      copied: 0,
      failed: sources.length,
      message: `不允许的目标路径: ${destinationFolder}`,
    };
  }

  try {
    // Ensure destination folder exists
    await fs.ensureDir(destinationFolder);

    for (const source of sources) {
      try {
        assertSafePath(source);
      } catch {
        failed++;
        console.error(`Rejected unsafe source path: ${source}`);
        continue;
      }
      try {
        const fileName = path.basename(source);
        const destination = path.join(destinationFolder, fileName);
        await fs.copy(source, destination);
        copied++;
      } catch (error) {
        failed++;
        console.error(`Failed to copy ${source}:`, error);
      }
    }

    return {
      success: failed === 0,
      copied,
      failed,
      message: `成功复制 ${copied} 个文件${failed > 0 ? `，${failed} 个失败` : ''}`,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '未知错误';
    return {
      success: false,
      copied: 0,
      failed: sources.length,
      message: `复制文件失败: ${errorMsg}`,
    };
  }
}

/**
 * Delete file(s) to recycle bin
 */
export async function deleteToRecycleBin(
  filePaths: string[],
): Promise<{ success: boolean; deleted: number; message: string }> {
  let deleted = 0;

  for (const filePath of filePaths) {
    try {
      assertSafePath(filePath);
    } catch {
      console.error(`Rejected unsafe path for trash: ${filePath}`);
      continue;
    }
    try {
      await shell.trashItem(filePath);
      deleted++;
    } catch (error) {
      console.error(`Failed to delete ${filePath}:`, error);
    }
  }

  return {
    success: deleted === filePaths.length,
    deleted,
    message: `已将 ${deleted} 个文件删除到回收站`,
  };
}

/**
 * Permanently delete files using fs.unlink (bypasses recycle bin).
 * Counts failures rather than throwing — caller can decide to surface them.
 */
export async function deleteFilesPermanently(
  filePaths: string[],
): Promise<{ deleted: number; failed: number }> {
  let deleted = 0;
  let failed = 0;

  for (const filePath of filePaths) {
    try {
      assertSafePath(filePath);
    } catch {
      failed++;
      console.error(`Rejected unsafe path for unlink: ${filePath}`);
      continue;
    }
    try {
      await fs.unlink(filePath);
      deleted++;
    } catch (error) {
      failed++;
      console.error(`Failed to delete ${filePath}:`, error);
    }
  }

  return { deleted, failed };
}

/**
 * Export images as ZIP using streaming archiver — bounded memory regardless of payload size.
 */
export async function exportAsZip(
  images: Image[],
  outputPath: string,
): Promise<{ success: boolean; message: string }> {
  let safeOutput: string;
  try {
    safeOutput = assertSafePath(outputPath);
  } catch {
    return { success: false, message: `不允许的导出路径: ${outputPath}` };
  }

  // Pre-validate source paths; collect failures
  const validImages: Array<{ image: Image; safePath: string }> = [];
  let skipped = 0;
  for (const image of images) {
    try {
      const safePath = assertSafePath(image.filePath);
      validImages.push({ image, safePath });
    } catch {
      skipped++;
      console.error(`Rejected unsafe image path for ZIP: ${image.filePath}`);
    }
  }
  if (validImages.length === 0) {
    return { success: false, message: '没有有效的图片可导出' };
  }

  return new Promise<{ success: boolean; message: string }>((resolve) => {
    const out = createWriteStream(safeOutput);
    const zip = archiver('zip', { zlib: { level: 6 } });

    let resolved = false;
    const settle = (result: { success: boolean; message: string }) => {
      if (resolved) return;
      resolved = true;
      resolve(result);
    };

    out.on('close', () => {
      const msg =
        skipped > 0
          ? `已导出 ${validImages.length} 张图片(跳过 ${skipped} 张无效路径)`
          : `已导出 ${validImages.length} 张图片`;
      settle({ success: true, message: msg });
    });
    out.on('error', (err) => {
      settle({ success: false, message: `写入失败: ${err.message}` });
    });
    zip.on('error', (err) => {
      settle({ success: false, message: `压缩失败: ${err.message}` });
    });
    zip.on('warning', (err) => {
      // ENOENT for missing source file — log but don't fail the whole archive
      console.warn('archiver warning:', err);
    });

    zip.pipe(out);
    for (const { image, safePath } of validImages) {
      const inZipName = `${image.yearMonth || 'images'}/${path.basename(safePath)}`;
      zip.file(safePath, { name: inZipName });
    }
    zip.finalize();
  });
}

/**
 * Open folder in file explorer
 */
export async function openFolderInExplorer(
  folderPath: string,
): Promise<{ success: boolean; message: string }> {
  try {
    assertSafePath(folderPath);
  } catch (e) {
    return { success: false, message: `不允许的路径: ${folderPath}` };
  }

  try {
    const resolvedPath = path.resolve(folderPath);

    if (!fs.existsSync(resolvedPath)) {
      return {
        success: false,
        message: '文件夹不存在',
      };
    }

    shell.openPath(resolvedPath);

    return {
      success: true,
      message: '已在文件资源管理器中打开文件夹',
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '未知错误';
    return {
      success: false,
      message: `打开文件夹失败: ${errorMsg}`,
    };
  }
}

/**
 * Open file with default application
 */
export async function openFileWithDefaultApp(
  filePath: string,
): Promise<{ success: boolean; message: string }> {
  try {
    assertSafePath(filePath);
  } catch (e) {
    return { success: false, message: `不允许的路径: ${filePath}` };
  }

  try {
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        message: '文件不存在',
      };
    }

    await shell.openPath(filePath);

    return {
      success: true,
      message: '已使用默认应用打开文件',
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '未知错误';
    return {
      success: false,
      message: `打开文件失败: ${errorMsg}`,
    };
  }
}

/**
 * Show save dialog and return selected path
 */
export async function showSaveDialog(
  title: string,
  defaultFileName: string,
  filters?: { name: string; extensions: string[] }[],
): Promise<{ canceled: boolean; filePath?: string }> {
  const result = await dialog.showSaveDialog({
    title,
    defaultPath: defaultFileName,
    filters: filters || [{ name: '所有文件', extensions: ['*'] }],
  });

  return {
    canceled: result.canceled,
    filePath: result.filePath,
  };
}

/**
 * Show open directory dialog and return selected path
 */
export async function showOpenDirectoryDialog(
  title: string,
): Promise<{ canceled: boolean; filePath?: string }> {
  const result = await dialog.showOpenDialog({
    title,
    properties: ['openDirectory'],
  });

  return {
    canceled: result.canceled,
    filePath: result.filePaths?.[0],
  };
}
