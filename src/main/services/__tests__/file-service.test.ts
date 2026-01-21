import * as fileService from '../file-service';
import fs from 'fs-extra';

jest.mock('fs-extra');
jest.mock('electron', () => ({
  shell: { trashItem: jest.fn(), openPath: jest.fn() },
  dialog: { showSaveDialog: jest.fn(), showOpenDialog: jest.fn() },
}));
jest.mock('adm-zip', () => jest.fn(() => ({ addFile: jest.fn(), writeZip: jest.fn() })));

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
