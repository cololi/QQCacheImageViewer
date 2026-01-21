/**
 * Shared type definitions for QQ Cache Image Viewer
 */

export interface Image {
  id: number;
  hash: string;
  yearMonth: string;
  format: string;
  filePath: string;
  thumbPath?: string;
  fileSize: number;
  width?: number;
  height?: number;
  ratio?: number;
  fileTime?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ImageMetadata {
  hash: string;
  format: string;
  yearMonth: string;
  filePath: string;
  thumbPath?: string;
  fileSize: number;
  width?: number;
  height?: number;
  ratio?: number;
  fileTime?: string;
}

export interface ScanProgress {
  currentMonth: string;
  processedFiles: number;
  totalFiles: number;
  percent: number;
  speed: string;
  estimatedTime: string;
}

export interface ScanResult {
  success: boolean;
  totalImages: number;
  message: string;
}

export type SortField = 'name' | 'size' | 'width' | 'height' | 'pixels' | 'ratio' | 'mtime';
export type SortOrder = 'asc' | 'desc';

export interface QueryParams {
  yearMonth?: string;
  format?: string;
  sizeRange?: [number, number];
  ratioRange?: [number, number];
  sortField?: SortField;
  sortOrder?: SortOrder;
  offset: number;
  limit: number;
}
