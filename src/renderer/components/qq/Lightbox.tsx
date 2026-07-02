/**
 * Fullscreen media viewer overlay. Presentational: the parent owns the current
 * index and wires keyboard navigation. Renders an <img> or a playable <video>.
 */
import React, { useEffect, useState } from 'react';
import { formatDuration, MediaItem } from '../../utils/imageUtils';
import { CSS } from './styles';

const navBtn: CSS = {
  flex: 'none',
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
};

const mediaStyle: CSS = {
  maxWidth: '100%',
  maxHeight: '78vh',
  objectFit: 'contain',
  borderRadius: 12,
  boxShadow: '0 24px 70px rgba(0,0,0,.6)',
  background: '#000',
};

interface Props {
  item: MediaItem;
  indexLabel: string;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export const Lightbox: React.FC<Props> = ({ item, indexLabel, onClose, onPrev, onNext }) => {
  const [dur, setDur] = useState('');
  // Reset the cached duration when navigating to a different item.
  useEffect(() => setDur(''), [item.id]);

  return (
    <div
      onClick={onClose}
    style={{
      position: 'absolute',
      inset: 0,
      zIndex: 100,
      background: 'rgba(7,9,12,.82)',
      backdropFilter: 'blur(24px) saturate(150%)',
      WebkitBackdropFilter: 'blur(24px) saturate(150%)',
      display: 'flex',
      flexDirection: 'column',
      animation: 'fadeIn .2s both',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', color: '#fff' }}>
      <div style={{ minWidth: 0 }}>
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
      <div style={{ flex: 1 }} />
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
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 16px 28px',
        gap: 14,
        minHeight: 0,
      }}
    >
      <button onClick={onPrev} style={navBtn}>
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>

      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          maxWidth: 'min(1120px,84vw)',
          maxHeight: '78vh',
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
        ) : (
          <img src={item.fullUrl} alt="" style={mediaStyle} />
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

      <button onClick={onNext} style={navBtn}>
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
          <path d="M9 5l7 7-7 7" />
        </svg>
      </button>
      </div>
    </div>
  );
};

export default Lightbox;
