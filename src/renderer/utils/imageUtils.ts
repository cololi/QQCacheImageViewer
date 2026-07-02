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
 * Get image URL for preview.
 * Use thumbPath if available, otherwise use filePath.
 */
export const getImageUrl = (image: Image): string => {
  const path = image.thumbPath || image.filePath;
  // Use custom protocol for secure local file access
  return `local-resource://${encodeURIComponent(path)}`;
};

/** Serve the original file (full-res image or playable video). */
export const getMediaUrl = (image: Image): string =>
  `local-resource://${encodeURIComponent(image.filePath)}`;

// ---- Media metadata derivation (for the QQ media browser UI) ----------------

const VIDEO_FORMATS = ['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v'];
export const isVideoFormat = (format?: string): boolean =>
  !!format && VIDEO_FORMATS.includes(format.toLowerCase());

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const pad = (n: number): string => String(n).padStart(2, '0');

/** Seconds → "m:ss" (empty string for unknown/NaN/Infinity durations). */
export const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  return `${Math.floor(seconds / 60)}:${pad(Math.floor(seconds % 60))}`;
};

export type Orient = 'portrait' | 'landscape' | 'square' | 'unknown';
export type SizeBucket = '<100kb' | '100kb-1mb' | '1mb-5mb' | '>5mb';

const sizeBucketOf = (bytes: number): SizeBucket =>
  bytes < 102400 ? '<100kb' : bytes < 1048576 ? '100kb-1mb' : bytes < 5242880 ? '1mb-5mb' : '>5mb';

const orientOf = (ratio?: number): Orient =>
  ratio == null ? 'unknown' : ratio < 0.8 ? 'portrait' : ratio > 1.25 ? 'landscape' : 'square';

/**
 * View-model wrapping a raw {@link Image} with everything the gallery renders:
 * media type, orientation, date grouping/labels, size bucket/label, aspect ratio
 * and the URLs to load. Mirrors the fields the design prototype computed inline.
 */
export interface MediaItem {
  raw: Image;
  id: number;
  isVideo: boolean;
  orient: Orient;
  ratio?: number;
  /** YYYYMMDD, used for grouping + custom date-range comparison. */
  dayKey: string;
  /** Whole days between the item's date and today (0 = today). */
  off: number;
  dateLabel: string; // 今天 / 昨天 / M月D日
  weekday: string; // 周X
  fullDate: string; // YYYY年M月D日 周X
  sizeBucket: SizeBucket;
  sizeLabel: string;
  /** CSS aspect-ratio string, e.g. "4 / 3". */
  ar: string;
  name: string; // filename without extension (QQ hash)
  ext: string; // ".jpg"
  srcUrl: string; // thumbnail for grid
  fullUrl: string; // original for the lightbox / video playback
}

/** Local-midnight epoch ms for a Date (for whole-day offset math). */
const midnight = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/**
 * Derive a {@link MediaItem} from a raw image record.
 * `todayMid` is the caller's local-midnight epoch (passed in so a whole page of
 * items shares one "today" reference and stays cheap to compute).
 */
export const deriveMediaItem = (image: Image, todayMid: number): MediaItem => {
  const fmt = (image.format || '').toLowerCase();
  const isVideo = isVideoFormat(fmt);
  const ratio =
    image.ratio ?? (image.width && image.height ? image.width / image.height : undefined);

  const t = new Date(image.fileTime || image.createdAt || 0);
  const y = t.getFullYear();
  const mo = t.getMonth() + 1;
  const d = t.getDate();
  const dayKey = `${y}${pad(mo)}${pad(d)}`;
  const off = Math.round((todayMid - midnight(t)) / 86400000);
  const weekday = WEEKDAYS[t.getDay()];

  return {
    raw: image,
    id: image.id,
    isVideo,
    orient: orientOf(ratio),
    ratio,
    dayKey,
    off,
    dateLabel: off === 0 ? '今天' : off === 1 ? '昨天' : `${mo}月${d}日`,
    weekday,
    fullDate: `${y}年${mo}月${d}日 ${weekday}`,
    sizeBucket: sizeBucketOf(image.fileSize),
    sizeLabel: formatFileSize(image.fileSize),
    ar:
      image.width && image.height
        ? `${image.width} / ${image.height}`
        : isVideo
          ? '16 / 9'
          : '1 / 1',
    name: image.hash,
    ext: `.${fmt}`,
    // Video grid stills load the file itself (seeked to 0.5s to force a frame);
    // images use their thumbnail.
    srcUrl: isVideo ? `${getMediaUrl(image)}#t=0.5` : getImageUrl(image),
    fullUrl: getMediaUrl(image),
  };
};

/** ISO yyyy-mm-dd from a YYYYMMDD day key (for native <input type="date">). */
export const dayKeyToISO = (k?: string): string =>
  k ? `${k.slice(0, 4)}-${k.slice(4, 6)}-${k.slice(6, 8)}` : '';

/** YYYYMMDD from an ISO yyyy-mm-dd date-input value. */
export const isoToDayKey = (iso: string): string | null => (iso ? iso.replace(/-/g, '') : null);
