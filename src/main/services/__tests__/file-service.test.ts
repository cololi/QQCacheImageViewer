import * as fileService from '../file-service';
import fs from 'fs-extra';
import { clipboard, nativeImage } from 'electron';
import path from 'path';

jest.mock('fs-extra');
jest.mock('electron', () => ({
  shell: { trashItem: jest.fn(), openPath: jest.fn() },
  dialog: { showSaveDialog: jest.fn(), showOpenDialog: jest.fn() },
  clipboard: { writeImage: jest.fn() },
  nativeImage: { createFromPath: jest.fn() },
}));
jest.mock('archiver', () =>
  jest.fn(() => ({
    on: jest.fn(),
    pipe: jest.fn(),
    file: jest.fn(),
    finalize: jest.fn(),
  })),
);

describe('deleteFilesPermanently', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses fs.unlink and reports deleted count', async () => {
    (fs.unlink as jest.Mock).mockResolvedValue(undefined);
    const result = await fileService.deleteFilesPermanently(['/a.jpg', '/b.jpg']);
    expect(fs.unlink).toHaveBeenCalledTimes(2);
    expect(fs.unlink).toHaveBeenCalledWith('/a.jpg');
    expect(fs.unlink).toHaveBeenCalledWith('/b.jpg');
    expect(result).toEqual({ deleted: 2, failed: 0 });
  });

  it('counts failures without throwing', async () => {
    (fs.unlink as jest.Mock)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('ENOENT'))
      .mockResolvedValueOnce(undefined);
    const result = await fileService.deleteFilesPermanently(['/a', '/missing', '/c']);
    expect(result).toEqual({ deleted: 2, failed: 1 });
  });

  it('returns zero counts on empty input', async () => {
    const result = await fileService.deleteFilesPermanently([]);
    expect(result).toEqual({ deleted: 0, failed: 0 });
    expect(fs.unlink).not.toHaveBeenCalled();
  });
});

describe('copyImageToClipboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('writes a readable image to the clipboard', async () => {
    const image = { isEmpty: jest.fn(() => false) };
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (nativeImage.createFromPath as jest.Mock).mockReturnValue(image);

    const result = await fileService.copyImageToClipboard('/a.jpg');

    expect(nativeImage.createFromPath).toHaveBeenCalledWith(path.resolve('/a.jpg'));
    expect(clipboard.writeImage).toHaveBeenCalledWith(image);
    expect(result).toEqual({ success: true, message: '已复制图片到剪贴板' });
  });

  it('reports unreadable images without touching the clipboard', async () => {
    const image = { isEmpty: jest.fn(() => true) };
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (nativeImage.createFromPath as jest.Mock).mockReturnValue(image);

    const result = await fileService.copyImageToClipboard('/bad.webp');

    expect(clipboard.writeImage).not.toHaveBeenCalled();
    expect(result).toEqual({ success: false, message: '无法读取图片' });
  });
});
