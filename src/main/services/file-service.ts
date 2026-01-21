import { shell, dialog } from 'electron';
import fs from 'fs-extra';
import path from 'path';
// @ts-ignore
import AdmZip from 'adm-zip';
import { Image } from '../../shared/types';

/**
 * Copy a single file to destination
 */
export async function copyFile(source: string, destination: string): Promise<{ success: boolean; message: string }> {
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
  destinationFolder: string
): Promise<{ success: boolean; copied: number; failed: number; message: string }> {
  let copied = 0;
  let failed = 0;

  try {
    // Ensure destination folder exists
    await fs.ensureDir(destinationFolder);

    for (const source of sources) {
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
export async function deleteToRecycleBin(filePaths: string[]): Promise<{ success: boolean; deleted: number; message: string }> {
  let deleted = 0;

  for (const filePath of filePaths) {
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
  filePaths: string[]
): Promise<{ deleted: number; failed: number }> {
  let deleted = 0;
  let failed = 0;

  for (const filePath of filePaths) {
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
 * Export images as ZIP
 */
export async function exportAsZip(
  images: Image[],
  outputPath: string
): Promise<{ success: boolean; message: string }> {
  try {
    const zip = new AdmZip();

    for (const image of images) {
      try {
        const exists = await fs.pathExists(image.filePath);
        if (exists) {
          const fileBuffer = await fs.readFile(image.filePath);
          const fileName = path.basename(image.filePath);
          const zipPath = path.join(image.yearMonth || 'images', fileName);
          zip.addFile(zipPath, fileBuffer);
        }
      } catch (error) {
        console.error(`Failed to add ${image.filePath} to ZIP:`, error);
      }
    }

    // Write ZIP file
    zip.writeZip(outputPath);

    return {
      success: true,
      message: `成功将 ${images.length} 张图片导出到 ${outputPath}`,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '未知错误';
    return {
      success: false,
      message: `导出 ZIP 失败: ${errorMsg}`,
    };
  }
}

/**
 * Open folder in file explorer
 */
export async function openFolderInExplorer(folderPath: string): Promise<{ success: boolean; message: string }> {
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
export async function openFileWithDefaultApp(filePath: string): Promise<{ success: boolean; message: string }> {
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
  filters?: { name: string; extensions: string[] }[]
): Promise<{ canceled: boolean; filePath?: string }> {
  const result = await dialog.showSaveDialog({
    title,
    defaultPath: defaultFileName,
    filters: filters || [
      { name: '所有文件', extensions: ['*'] },
    ],
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
  title: string
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
