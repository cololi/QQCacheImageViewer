import { Image } from '../../../shared/types';
import { deriveMediaItem, getImageUrl, getMediaUrl, isGifFormat } from '../imageUtils';

const baseImage: Image = {
  id: 1,
  hash: 'sample',
  yearMonth: '2026-07',
  format: 'jpg',
  filePath: 'E:\\QQ\\Ori\\sample.jpg',
  thumbPath: 'E:\\QQ\\Thumb\\sample_0.jpg',
  fileSize: 2048,
  width: 320,
  height: 240,
  ratio: 4 / 3,
  fileTime: '2026-07-02T08:00:00.000Z',
  createdAt: '2026-07-02T08:00:00.000Z',
  updatedAt: '2026-07-02T08:00:00.000Z',
};

describe('imageUtils', () => {
  it('uses thumbnails for normal still images', () => {
    expect(getImageUrl(baseImage)).toBe(
      `local-resource://${encodeURIComponent(baseImage.thumbPath as string)}`,
    );
  });

  it('uses the original file for GIFs so animation is preserved', () => {
    const gifImage: Image = {
      ...baseImage,
      format: 'gif',
      filePath: 'E:\\QQ\\Ori\\animated.gif',
      thumbPath: 'E:\\QQ\\Thumb\\animated_0.gif',
    };

    const item = deriveMediaItem(gifImage, new Date(2026, 6, 2).getTime());

    expect(isGifFormat(gifImage.format)).toBe(true);
    expect(item.isGif).toBe(true);
    expect(getImageUrl(gifImage)).toBe(getMediaUrl(gifImage));
    expect(item.srcUrl).toBe(getMediaUrl(gifImage));
    expect(item.fullUrl).toBe(getMediaUrl(gifImage));
  });
});
