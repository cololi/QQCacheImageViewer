/**
 * A single gallery card: image or video still, video play overlay + duration
 * badge, optional size label, hover-preview (video autoplays after 2s) and the
 * selection checkbox / selected overlay. The corner checkbox toggles selection;
 * clicking the rest of the card opens preview.
 *
 * Hover + preview state is kept local (not lifted) so hovering one card doesn't
 * re-render the whole grid.
 */
import React, { useCallback, useRef, useState } from 'react';
import { formatDuration, MediaItem } from '../../utils/imageUtils';
import { ACCENT2, CSS, GRAD } from './styles';

const PREVIEW_DELAY_MS = 2000;

const fillStyle: CSS = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
  background: '#000',
};

const badge: CSS = {
  position: 'absolute',
  background: 'rgba(10,14,20,.66)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  border: '1px solid rgba(255,255,255,.12)',
  color: '#fff',
  fontSize: 10.5,
  fontWeight: 600,
  borderRadius: 8,
};

interface Props {
  item: MediaItem;
  selected: boolean;
  showSize: boolean;
  onOpen: (item: MediaItem) => void;
  onToggleSelect: (id: number) => void;
}

const MediaCardImpl: React.FC<Props> = ({ item, selected, showSize, onOpen, onToggleSelect }) => {
  const [hovered, setHovered] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [dur, setDur] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const onEnter = useCallback(() => {
    setHovered(true);
    if (item.isVideo) {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setPreviewing(true), PREVIEW_DELAY_MS);
    }
  }, [item.isVideo]);

  const onLeave = useCallback(() => {
    setHovered(false);
    clearTimeout(timer.current);
    setPreviewing(false);
  }, []);

  const showSel = selected || hovered;

  return (
    <div
      className="qq-card"
      onClick={() => onOpen(item)}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{
        position: 'relative',
        breakInside: 'avoid',
        marginBottom: 8,
        borderRadius: 12,
        overflow: 'hidden',
        background: '#15171D',
        cursor: 'pointer',
        animation: 'fadeUp .4s both',
        transition: 'transform .22s ease,filter .22s ease',
      }}
    >
      <div
        style={{ position: 'relative', width: '100%', aspectRatio: item.ar, overflow: 'hidden' }}
      >
        {item.isVideo ? (
          <video
            src={item.srcUrl}
            preload="none"
            muted
            playsInline
            onLoadedMetadata={(e) => setDur(formatDuration(e.currentTarget.duration))}
            style={fillStyle}
          />
        ) : (
          <img src={item.srcUrl} loading="lazy" decoding="async" alt="" style={fillStyle} />
        )}

        {item.isVideo && previewing && (
          <video
            src={item.fullUrl}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            onLoadedMetadata={(e) => setDur(formatDuration(e.currentTarget.duration))}
            style={{ position: 'absolute', inset: 0, ...fillStyle }}
          />
        )}

        {item.isVideo && !previewing && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(180deg,rgba(0,0,0,0) 55%,rgba(0,0,0,.32))',
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'rgba(10,14,20,.42)',
                backdropFilter: 'blur(3px)',
                WebkitBackdropFilter: 'blur(3px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1.5px solid rgba(255,255,255,.55)',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="#fff">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}

        {item.isVideo && dur && (
          <div
            style={{
              ...badge,
              right: 8,
              bottom: 8,
              padding: '2px 6px',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="#fff">
              <path d="M8 5v14l11-7z" />
            </svg>
            {dur}
          </div>
        )}

        {showSize && (
          <div style={{ ...badge, left: 8, bottom: 8, padding: '2px 7px' }}>{item.sizeLabel}</div>
        )}

        {selected && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              border: `3px solid ${ACCENT2}`,
              borderRadius: 12,
              background: 'rgba(10,119,224,.16)',
              pointerEvents: 'none',
            }}
          />
        )}

        <div
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(item.id);
          }}
          style={{
            position: 'absolute',
            left: 8,
            top: 8,
            width: 24,
            height: 24,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: selected ? GRAD : 'rgba(10,14,20,.5)',
            border: `2px solid ${selected ? 'transparent' : 'rgba(255,255,255,.9)'}`,
            boxShadow: '0 1px 5px rgba(0,0,0,.45)',
            cursor: 'pointer',
            opacity: showSel ? 1 : 0,
            pointerEvents: showSel ? 'auto' : 'none',
            transition: 'opacity .15s',
          }}
        >
          {selected && (
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12l5 5 9-11" />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
};

export const MediaCard = React.memo(MediaCardImpl);
export default MediaCard;
