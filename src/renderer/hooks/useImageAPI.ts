import { useCallback } from 'react';
import { Image, QueryParams } from '../../shared/types';

export const useImageAPI = () => {
  const scanImages = useCallback(async (options?: any) => {
    return window.electron?.ipcRenderer.invoke('scan-images', options);
  }, []);

  const getMonths = useCallback(async () => {
    return window.electron?.ipcRenderer.invoke('get-months');
  }, []);

  const getImages = useCallback(async (params: QueryParams) => {
    return window.electron?.ipcRenderer.invoke('get-images', params);
  }, []);

  const getImageCount = useCallback(async (yearMonth?: string) => {
    return window.electron?.ipcRenderer.invoke('get-image-count', yearMonth);
  }, []);

  const deleteImages = useCallback(async (ids: number[]): Promise<{ success: boolean; deleted: number; failed: number }> => {
    return window.electron?.ipcRenderer.invoke('delete-images', ids);
  }, []);

  const deleteMonthImages = useCallback(async (yearMonth: string): Promise<{ success: boolean; deleted: number; failed: number }> => {
    return window.electron?.ipcRenderer.invoke('delete-month-images', yearMonth);
  }, []);

  return {
    scanImages,
    getMonths,
    getImages,
    getImageCount,
    deleteImages,
    deleteMonthImages,
  };
};

export const useImageListener = (callback: (data: any) => void) => {
  window.electron?.ipcRenderer.on('scan-progress', callback);

  return () => {
    window.electron?.ipcRenderer.off('scan-progress', callback);
  };
};
