import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

/**
 * Position record for one item. `top`/`left` are coordinates inside the
 * VirtualMasonry root (not viewport), so they remain stable as the user
 * scrolls.
 */
export interface ItemPosition {
  key: string | number;
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface VirtualMasonryProps {
  itemCount: number;
  itemKey: (index: number) => string | number;
  /** height / width — used to compute item height from column width. */
  itemAspect: (index: number) => number;
  columnCount: number;
  gap?: number;
  overscan?: number;
  renderItem: (index: number, style: React.CSSProperties) => React.ReactNode;
  onContainerMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onContainerMouseMove?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onContainerMouseUp?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onContainerMouseLeave?: (e: React.MouseEvent<HTMLDivElement>) => void;
  /**
   * Called whenever positions are recomputed. Receives a stable ref-equal
   * array so callers can memoize hit-test caches off it. Use this for
   * rubber-band selection without needing rendered DOM nodes.
   */
  onPositionsChange?: (positions: ReadonlyArray<ItemPosition>) => void;
  /** Optional render-prop placed *inside* the absolutely-positioned container. */
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Walk up the DOM until we find an element whose computed `overflowY` is
 * `auto` or `scroll`. Falls back to `window` if nothing matches. The walk
 * runs once per mount (re-run on demand if needed) — DOM ancestry is stable.
 */
function findScrollAncestor(el: HTMLElement | null): HTMLElement | Window {
  let cur: HTMLElement | null = el?.parentElement ?? null;
  while (cur) {
    const oy = window.getComputedStyle(cur).overflowY;
    if (oy === 'auto' || oy === 'scroll') return cur;
    cur = cur.parentElement;
  }
  return window;
}

/** Read scrollTop/clientHeight from either an HTMLElement or the window. */
function readScroll(target: HTMLElement | Window, root: HTMLElement | null) {
  if (target === window) {
    // For window scrolling, the masonry's offsetTop tells us how far down
    // it sits, so visible range is computed relative to root.
    const rootTop = root ? root.getBoundingClientRect().top + window.scrollY : 0;
    return {
      scrollTop: window.scrollY - rootTop,
      viewportHeight: window.innerHeight,
    };
  }
  const el = target as HTMLElement;
  const rootRect = root?.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  // root.top relative to scroll container's content area
  const rootTopWithinScroll = (rootRect?.top ?? 0) - elRect.top + el.scrollTop;
  return {
    scrollTop: el.scrollTop - rootTopWithinScroll,
    viewportHeight: el.clientHeight,
  };
}

/**
 * Headless masonry primitive. Computes a greedy column-packed layout once
 * per (itemCount, columnCount, containerWidth) change, mounts only items
 * whose rectangles intersect [scrollTop - overscan, scrollTop + viewport + overscan].
 */
export const VirtualMasonry: React.FC<VirtualMasonryProps> = ({
  itemCount,
  itemKey,
  itemAspect,
  columnCount,
  gap = 12,
  overscan = 1500,
  renderItem,
  onContainerMouseDown,
  onContainerMouseMove,
  onContainerMouseUp,
  onContainerMouseLeave,
  onPositionsChange,
  children,
  className,
  style,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollAncestorRef = useRef<HTMLElement | Window | null>(null);

  const [containerWidth, setContainerWidth] = useState(0);
  const [scrollState, setScrollState] = useState({ scrollTop: 0, viewportHeight: 0 });

  // Measure container width and watch for resize.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => setContainerWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Find scroll ancestor and subscribe to scroll. rAF-throttled to avoid
  // re-rendering on every wheel tick.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const target = findScrollAncestor(el);
    scrollAncestorRef.current = target;

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setScrollState(readScroll(target, rootRef.current));
      });
    };
    // Initial sync
    setScrollState(readScroll(target, rootRef.current));

    const passive = { passive: true } as AddEventListenerOptions;
    target.addEventListener('scroll', onScroll, passive);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      target.removeEventListener('scroll', onScroll);
    };
  }, []);

  // Greedy column packing. Stable across re-renders via useMemo so the
  // expensive O(n) loop only runs when inputs actually change.
  const { positions, totalHeight } = useMemo(() => {
    const out: ItemPosition[] = new Array(itemCount);
    if (columnCount < 1 || containerWidth <= 0 || itemCount === 0) {
      return { positions: out, totalHeight: 0 };
    }
    const colWidth = (containerWidth - gap * (columnCount - 1)) / columnCount;
    const colHeights = new Array<number>(columnCount).fill(0);

    for (let i = 0; i < itemCount; i++) {
      const aspect = itemAspect(i);
      const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
      const h = colWidth * safeAspect;

      // argmin
      let shortest = 0;
      let shortestH = colHeights[0];
      for (let c = 1; c < columnCount; c++) {
        if (colHeights[c] < shortestH) {
          shortest = c;
          shortestH = colHeights[c];
        }
      }
      out[i] = {
        key: itemKey(i),
        top: shortestH,
        left: shortest * (colWidth + gap),
        width: colWidth,
        height: h,
      };
      colHeights[shortest] = shortestH + h + gap;
    }

    const total = colHeights.reduce((m, v) => Math.max(m, v), 0);
    // Subtract the trailing gap we added past the last item in each col
    return { positions: out, totalHeight: Math.max(0, total - gap) };
  }, [itemCount, itemKey, itemAspect, columnCount, containerWidth, gap]);

  // Notify subscriber whenever positions change (rubber-band uses these).
  useEffect(() => {
    onPositionsChange?.(positions);
  }, [positions, onPositionsChange]);

  // Pick visible slice. Linear scan is fine — n is bounded by itemCount and
  // we only run this when scroll/positions actually change.
  const visibleIndices = useMemo(() => {
    if (positions.length === 0) return [] as number[];
    const top = scrollState.scrollTop - overscan;
    const bottom = scrollState.scrollTop + scrollState.viewportHeight + overscan;
    const out: number[] = [];
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      if (p.top + p.height >= top && p.top <= bottom) out.push(i);
    }
    return out;
  }, [positions, scrollState.scrollTop, scrollState.viewportHeight, overscan]);

  return (
    <div
      ref={rootRef}
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: totalHeight,
        ...style,
      }}
      onMouseDown={onContainerMouseDown}
      onMouseMove={onContainerMouseMove}
      onMouseUp={onContainerMouseUp}
      onMouseLeave={onContainerMouseLeave}
    >
      {visibleIndices.map((i) => {
        const p = positions[i];
        const itemStyle: React.CSSProperties = {
          position: 'absolute',
          top: p.top,
          left: p.left,
          width: p.width,
          height: p.height,
        };
        return <React.Fragment key={p.key}>{renderItem(i, itemStyle)}</React.Fragment>;
      })}
      {children}
    </div>
  );
};

export default VirtualMasonry;
