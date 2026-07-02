/**
 * Fullscreen media viewer overlay. Presentational: the parent owns the current
 * index and wires keyboard navigation. Renders an <img> or a playable <video>.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { formatDuration, MediaItem } from '../../utils/imageUtils';
import { CSS } from './styles';

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;
const ZOOM_BUTTON_FACTOR = 1.25;

const navBtn = (side: 'left' | 'right'): CSS => ({
  position: 'absolute',
  [side]: 24,
  top: '50%',
  transform: 'translateY(-50%)',
  zIndex: 2,
  width: 44,
  height: 44,
  borderRadius: '50%',
  border: '1px solid rgba(255,255,255,.16)',
  cursor: 'pointer',
  background: 'rgba(255,255,255,.1)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.2)',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

const mediaStyle: CSS = {
  maxWidth: '100%',
  maxHeight: '78vh',
  objectFit: 'contain',
  display: 'block',
  borderRadius: 12,
  boxShadow: '0 18px 46px rgba(0,0,0,.52)',
  background: '#000',
  transform: 'translate3d(0,0,0) scale(1)',
  transformOrigin: '0 0',
  willChange: 'transform',
  backfaceVisibility: 'hidden',
  userSelect: 'none',
};

const errorBox: CSS = {
  minWidth: 260,
  padding: '22px 26px',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,.14)',
  background: 'rgba(255,255,255,.08)',
  color: 'rgba(255,255,255,.72)',
  fontSize: 13,
  fontWeight: 600,
  textAlign: 'center',
};

const actionBtn = (danger = false, disabled = false): CSS => ({
  height: 36,
  padding: '0 12px',
  borderRadius: 10,
  border: `1px solid ${danger ? 'rgba(255,120,120,.28)' : 'rgba(255,255,255,.16)'}`,
  cursor: disabled ? 'not-allowed' : 'pointer',
  background: danger ? 'rgba(255,80,80,.16)' : 'rgba(255,255,255,.1)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  color: danger ? '#FF9A9A' : '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  fontSize: 12.5,
  fontWeight: 600,
  opacity: disabled ? 0.45 : 1,
  flex: 'none',
});

const zoomBtn: CSS = {
  width: 36,
  height: 36,
  padding: 0,
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,.16)',
  cursor: 'pointer',
  background: 'rgba(255,255,255,.1)',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 15,
  fontWeight: 700,
  flex: 'none',
};

type ImageTransform = {
  scale: number;
  x: number;
  y: number;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

interface Props {
  item: MediaItem;
  indexLabel: string;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onDownload: () => void | Promise<void>;
  onCopy: () => void | Promise<void>;
  onDelete: () => void | Promise<void>;
}

export const Lightbox: React.FC<Props> = ({
  item,
  indexLabel,
  onClose,
  onPrev,
  onNext,
  onDownload,
  onCopy,
  onDelete,
}) => {
  const [dur, setDur] = useState('');
  const [imageSrc, setImageSrc] = useState(item.fullUrl);
  const [imageFailed, setImageFailed] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const transformRef = useRef<ImageTransform>({ scale: 1, x: 0, y: 0 });
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
  } | null>(null);

  const applyTransform = useCallback(() => {
    if (frameRef.current != null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      const image = imageRef.current;
      if (!image) return;
      const { scale, x, y } = transformRef.current;
      image.style.transform = `translate3d(${x}px,${y}px,0) scale(${scale})`;
      image.style.cursor = scale > 1 ? 'grab' : 'zoom-in';
    });
  }, []);

  const setImageTransform = useCallback(
    (next: ImageTransform) => {
      transformRef.current = {
        scale: clamp(next.scale, MIN_ZOOM, MAX_ZOOM),
        x: next.scale <= MIN_ZOOM ? 0 : next.x,
        y: next.scale <= MIN_ZOOM ? 0 : next.y,
      };
      applyTransform();
    },
    [applyTransform],
  );

  const resetImageTransform = useCallback(() => {
    setImageTransform({ scale: 1, x: 0, y: 0 });
  }, [setImageTransform]);

  const zoomAt = useCallback(
    (clientX: number, clientY: number, nextScale: number) => {
      const image = imageRef.current;
      if (!image) return;

      const current = transformRef.current;
      const scale = clamp(nextScale, MIN_ZOOM, MAX_ZOOM);
      if (scale <= MIN_ZOOM) {
        resetImageTransform();
        return;
      }

      const rect = image.getBoundingClientRect();
      const layoutLeft = rect.left - current.x;
      const layoutTop = rect.top - current.y;
      const imageX = (clientX - rect.left) / current.scale;
      const imageY = (clientY - rect.top) / current.scale;

      setImageTransform({
        scale,
        x: clientX - layoutLeft - imageX * scale,
        y: clientY - layoutTop - imageY * scale,
      });
    },
    [resetImageTransform, setImageTransform],
  );

  const zoomFromCenter = useCallback(
    (factor: number) => {
      const image = imageRef.current;
      if (!image) return;
      const rect = image.getBoundingClientRect();
      zoomAt(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        transformRef.current.scale * factor,
      );
    },
    [zoomAt],
  );

  // Reset the cached duration when navigating to a different item.
  useEffect(() => {
    setDur('');
    setImageSrc(item.fullUrl);
    setImageFailed(false);
    transformRef.current = { scale: 1, x: 0, y: 0 };
    dragRef.current = null;
    applyTransform();
  }, [item.id, item.fullUrl]);

  useEffect(() => {
    return () => {
      if (frameRef.current != null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  const runAction = (
    event: React.MouseEvent<HTMLButtonElement>,
    action: () => void | Promise<void>,
  ) => {
    event.stopPropagation();
    void action();
  };

  const handleImageError = () => {
    if (imageSrc !== item.srcUrl) {
      setImageSrc(item.srcUrl);
      return;
    }
    setImageFailed(true);
  };

  const goPrev = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onPrev();
  };

  const goNext = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onNext();
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (item.isVideo || imageFailed) return;
    event.preventDefault();
    event.stopPropagation();
    const factor = Math.exp(-event.deltaY * 0.0016);
    zoomAt(event.clientX, event.clientY, transformRef.current.scale * factor);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (item.isVideo || imageFailed || transformRef.current.scale <= 1) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const current = transformRef.current;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      baseX: current.x,
      baseY: current.y,
    };
    if (imageRef.current) {
      imageRef.current.style.cursor = 'grabbing';
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    setImageTransform({
      scale: transformRef.current.scale,
      x: drag.baseX + event.clientX - drag.startX,
      y: drag.baseY + event.clientY - drag.startY,
    });
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.stopPropagation();
    dragRef.current = null;
    if (imageRef.current) {
      imageRef.current.style.cursor = transformRef.current.scale > 1 ? 'grab' : 'zoom-in';
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(7,9,12,.9)',
        display: 'flex',
        flexDirection: 'column',
        animation: 'fadeIn .2s both',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '16px 20px',
          color: '#fff',
        }}
      >
        <div style={{ minWidth: 0, flex: '1 1 auto' }}>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {item.name}
            {item.ext}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', marginTop: 2 }}>
            {item.fullDate} · {item.sizeLabel}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
          {!item.isVideo && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  zoomFromCenter(1 / ZOOM_BUTTON_FACTOR);
                }}
                title="缩小"
                style={zoomBtn}
              >
                −
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  resetImageTransform();
                }}
                title="重置缩放"
                style={{ ...zoomBtn, fontSize: 12.5 }}
              >
                1:1
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  zoomFromCenter(ZOOM_BUTTON_FACTOR);
                }}
                title="放大"
                style={zoomBtn}
              >
                +
              </button>
            </>
          )}
          <button
            onClick={(e) => runAction(e, onDownload)}
            title={item.isVideo ? '下载视频' : '下载图片'}
            style={actionBtn()}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3v12" />
              <path d="M7 10l5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
            下载
          </button>
          <button
            disabled={item.isVideo}
            onClick={(e) => runAction(e, onCopy)}
            title={item.isVideo ? '视频不能复制为图片' : '复制图片'}
            style={actionBtn(false, item.isVideo)}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="9" width="11" height="11" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            复制
          </button>
          <button
            onClick={(e) => runAction(e, onDelete)}
            title={item.isVideo ? '删除视频' : '删除图片'}
            style={actionBtn(true)}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 6h18" />
              <path d="M8 6V4h8v2" />
              <path d="M6 6l1 14h10l1-14" />
            </svg>
            删除
          </button>
        </div>
        <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.55)' }}>{indexLabel}</div>
        <button
          onClick={onClose}
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,.16)',
            cursor: 'pointer',
            background: 'rgba(255,255,255,.1)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.2)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 'none',
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div
        onClick={(e) => e.stopPropagation()}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 76px 28px',
          minHeight: 0,
          overflow: 'hidden',
          touchAction: 'none',
        }}
      >
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            maxWidth: 'min(1120px,84vw)',
            maxHeight: '78vh',
            overflow: 'visible',
          }}
        >
          {item.isVideo ? (
            <video
              src={item.fullUrl}
              controls
              autoPlay
              playsInline
              preload="metadata"
              onLoadedMetadata={(e) => setDur(formatDuration(e.currentTarget.duration))}
              style={mediaStyle}
            />
          ) : imageFailed ? (
            <div style={errorBox}>图片无法加载</div>
          ) : (
            <img
              ref={imageRef}
              src={imageSrc}
              alt=""
              draggable={false}
              decoding="async"
              onError={handleImageError}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (transformRef.current.scale > 1) {
                  resetImageTransform();
                } else {
                  zoomAt(e.clientX, e.clientY, 2);
                }
              }}
              style={{ ...mediaStyle, cursor: 'zoom-in' }}
            />
          )}
          {item.isVideo && (
            <div
              style={{
                position: 'absolute',
                left: 12,
                bottom: 12,
                background: 'rgba(10,14,20,.6)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,.14)',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                padding: '4px 9px',
                borderRadius: 8,
              }}
            >
              视频{dur ? ` · ${dur}` : ''}
            </div>
          )}
        </div>
      </div>

      <button onClick={goPrev} title="上一张" style={navBtn('left')}>
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>

      <button onClick={goNext} title="下一张" style={navBtn('right')}>
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
          <path d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
};

export default Lightbox;
