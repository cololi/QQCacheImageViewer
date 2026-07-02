/**
 * Custom min / maximize / close buttons for the frameless window.
 * Native titleBarOverlay is disabled (see main/index.ts); these drive the
 * window through IPC. Hover styling lives in index.css (.qq-winbtn*).
 */
import React from 'react';
import { ipc } from '../../lib/ipc-client';
import { CSS, NO_DRAG } from './styles';

const btn: CSS = {
  width: 46,
  border: 'none',
  background: 'transparent',
  color: '#C0C7D2',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background .12s,color .12s',
};

export const WindowControls: React.FC = () => (
  <div
    style={{ position: 'absolute', top: 0, right: 0, height: 50, display: 'flex', ...NO_DRAG }}
  >
    <button
      className="qq-winbtn"
      title="最小化"
      style={btn}
      onClick={() => ipc.minimizeWindow().catch(() => undefined)}
    >
      <svg width="11" height="11" viewBox="0 0 11 11">
        <path d="M0 5.5h11" stroke="currentColor" strokeWidth="1" />
      </svg>
    </button>
    <button
      className="qq-winbtn"
      title="最大化"
      style={btn}
      onClick={() => ipc.toggleMaximizeWindow().catch(() => undefined)}
    >
      <svg width="10" height="10" viewBox="0 0 10 10">
        <rect x="0.5" y="0.5" width="9" height="9" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1" />
      </svg>
    </button>
    <button
      className="qq-winbtn qq-winbtn-close"
      title="关闭"
      style={{ ...btn, width: 48 }}
      onClick={() => ipc.closeWindow().catch(() => undefined)}
    >
      <svg width="10" height="10" viewBox="0 0 10 10">
        <path d="M0.5 0.5l9 9M9.5 0.5l-9 9" stroke="currentColor" strokeWidth="1" />
      </svg>
    </button>
  </div>
);

export default WindowControls;
