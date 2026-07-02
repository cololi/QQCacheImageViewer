/**
 * Renderer-side IPC hook.
 *
 * Public surface (preserved verbatim for back-compat with App.tsx):
 *   - useImageAPI() -> {scanImages, getMonths, getImages, getImageCount, deleteImages, deleteMonthImages}
 *   - useImageListener(callback) -> unsubscribe function
 *
 * Implementation now delegates to the typed `ipc` client in `../lib/ipc-client`,
 * which centralizes channel constants and envelope unwrapping.
 */
import { useCallback } from 'react';
import { Image, QueryParams, ScanProgress } from '../../shared/types';
import { ipc, ScanImagesOptions } from '../lib/ipc-client';

export const useImageAPI = () => {
  const scanImages = useCallback((options?: ScanImagesOptions) => ipc.scanImages(options), []);

  const getMonths = useCallback(() => ipc.getMonths(), []);

  const getImages = useCallback((params: QueryParams) => ipc.getImages(params), []);

  const getImageCount = useCallback((yearMonth?: string) => ipc.getImageCount(yearMonth), []);

  const deleteImages = useCallback(
    (ids: number[]): Promise<{ success: boolean; deleted: number; failed: number }> =>
      ipc.deleteImages(ids),
    [],
  );
  const saveImage = useCallback((image: Image) => ipc.saveImage(image), []);
  const copyImageToClipboard = useCallback((image: Image) => ipc.copyImageToClipboard(image), []);

  const deleteMonthImages = useCallback(
    (yearMonth: string): Promise<{ success: boolean; deleted: number; failed: number }> =>
      ipc.deleteMonthImages(yearMonth),
    [],
  );

  return {
    scanImages,
    getMonths,
    getImages,
    getImageCount,
    deleteImages,
    saveImage,
    copyImageToClipboard,
    deleteMonthImages,
  };
};

export const useImageListener = (callback: (data: ScanProgress) => void): (() => void) => {
  return ipc.onScanProgress(callback);
};
