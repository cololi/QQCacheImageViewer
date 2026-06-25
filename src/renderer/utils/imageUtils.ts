import { Image } from '../../shared/types';

/**
 * Format file size to human readable format
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Format date to readable string
 */
export const formatDate = (date: Date): string => {
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

/**
 * Get image URL for preview
 * Use thumbPath if available, otherwise use filePath
 */
export const getImageUrl = (image: Image): string => {
  const path = image.thumbPath || image.filePath;
  // Use custom protocol for secure local file access
  return `local-resource://${encodeURIComponent(path)}`;
};
