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
      message: `File copied to ${destination}`,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Failed to copy file: ${errorMsg}`,
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
      message: `Copied ${copied} files${failed > 0 ? `, ${failed} failed` : ''}`,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      copied: 0,
      failed: sources.length,
      message: `Failed to copy files: ${errorMsg}`,
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
    message: `Deleted ${deleted} files to recycle bin`,
  };
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
        if (fs.existsSync(image.filePath)) {
          const fileBuffer = fs.readFileSync(image.filePath);
          const fileName = path.basename(image.filePath);

          // Use yearMonth as subfolder in ZIP
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
      message: `Successfully exported ${images.length} images to ${outputPath}`,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Failed to export ZIP: ${errorMsg}`,
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
        message: 'Folder does not exist',
      };
    }

    shell.openPath(resolvedPath);

    return {
      success: true,
      message: 'Folder opened in explorer',
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Failed to open folder: ${errorMsg}`,
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
        message: 'File does not exist',
      };
    }

    await shell.openPath(filePath);

    return {
      success: true,
      message: 'File opened with default application',
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Failed to open file: ${errorMsg}`,
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
      { name: 'All Files', extensions: ['*'] },
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
