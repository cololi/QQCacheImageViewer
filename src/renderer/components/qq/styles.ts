/**
 * Shared style atoms for the QQ media browser, ported from the design prototype.
 * Inline styles (not Tailwind) so the frosted-glass values stay pixel-identical
 * to the handoff source.
 */

/** CSS object that also allows CSS vars and vendor props (e.g. WebkitAppRegion). */
export type CSS = React.CSSProperties & Record<string, string | number>;

export const ACCENT = '#23B5FF';
export const ACCENT2 = '#0A77E0';
export const GRAD = `linear-gradient(135deg,${ACCENT},${ACCENT2})`;

/** Drag / no-drag regions for the frameless window. */
export const DRAG: CSS = { WebkitAppRegion: 'drag' };
export const NO_DRAG: CSS = { WebkitAppRegion: 'no-drag' };

/** Frosted control container (segmented groups, buttons). */
export const glassControl: CSS = {
  background: 'rgba(255,255,255,.08)',
  backdropFilter: 'blur(16px) saturate(160%)',
  WebkitBackdropFilter: 'blur(16px) saturate(160%)',
  border: '1px solid rgba(255,255,255,.12)',
  borderRadius: 12,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.16)',
};

/** Floating popover panel (date / filter dropdowns). */
export const popoverPanel: CSS = {
  position: 'absolute',
  zIndex: 46,
  borderRadius: 14,
  background: 'rgba(20,24,32,.92)',
  backdropFilter: 'blur(30px) saturate(180%)',
  WebkitBackdropFilter: 'blur(30px) saturate(180%)',
  border: '1px solid rgba(255,255,255,.14)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.16),0 18px 50px rgba(0,0,0,.55)',
  animation: 'popIn .2s both',
};

/** Small uppercase section label inside popovers. */
export const popoverLabel: CSS = {
  fontSize: 11.5,
  fontWeight: 700,
  color: '#7E8A9B',
  letterSpacing: '.5px',
  marginBottom: 11,
};

/** Chip style for the active/inactive toggle buttons in popovers. */
export const chipStyle = (active: boolean): CSS => ({
  background: active ? GRAD : 'rgba(255,255,255,.06)',
  color: active ? '#fff' : '#C0C7D2',
  border: `1px solid ${active ? 'transparent' : 'rgba(255,255,255,.12)'}`,
});
