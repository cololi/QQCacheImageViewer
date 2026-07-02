/**
 * QQ 缓存媒体浏览器 — the design handoff recreated against real cache data.
 *
 * Owns all view state (columns, type/date/shape/size filters, sort, lightbox)
 * and derives the displayed list client-side from the full image set passed in.
 * Selection lives in Redux (via props) so it survives the delete flow in App.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image } from '../../../shared/types';
import {
  deriveMediaItem,
  dayKeyToISO,
  isoToDayKey,
  MediaItem,
  Orient,
  SizeBucket,
} from '../../utils/imageUtils';
import {
  ACCENT,
  ACCENT2,
  chipStyle,
  CSS,
  DRAG,
  glassControl,
  GRAD,
  NO_DRAG,
  popoverLabel,
  popoverPanel,
} from './styles';
import { MediaCard } from './MediaCard';
import { Lightbox } from './Lightbox';
import { WindowControls } from './WindowControls';

type DateMode = 'all' | 'today' | 'yest' | '7' | '30' | 'custom';
type TypeMode = 'all' | 'img' | 'vid';

const DATE_META: Record<DateMode, string> = {
  all: '全部时间',
  today: '今天',
  yest: '昨天',
  '7': '近 7 天',
  '30': '近 30 天',
  custom: '自定义范围',
};
const DATE_OPTIONS: { id: DateMode; txt: string }[] = [
  { id: 'all', txt: '全部' },
  { id: 'today', txt: '今天' },
  { id: 'yest', txt: '昨天' },
  { id: '7', txt: '近 7 天' },
  { id: '30', txt: '近 30 天' },
  { id: 'custom', txt: '自定义' },
];
const TYPE_CHIPS: { id: TypeMode; txt: string }[] = [
  { id: 'all', txt: '全部' },
  { id: 'img', txt: '图片' },
  { id: 'vid', txt: '视频' },
];
const SHAPES: { id: Orient; txt: string; path: React.ReactNode }[] = [
  { id: 'portrait', txt: '竖图', path: <rect x="7" y="3" width="10" height="18" rx="2" /> },
  { id: 'landscape', txt: '横图', path: <rect x="3" y="7" width="18" height="10" rx="2" /> },
  { id: 'square', txt: '方图', path: <rect x="5" y="5" width="14" height="14" rx="2" /> },
];
const SIZE_CHIPS: { id: SizeBucket; txt: string }[] = [
  { id: '<100kb', txt: '< 100KB' },
  { id: '100kb-1mb', txt: '100KB - 1MB' },
  { id: '1mb-5mb', txt: '1MB - 5MB' },
  { id: '>5mb', txt: '> 5MB' },
];

const fmtKey = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
};

const INITIAL_RENDER_LIMIT = 240;
const RENDER_BATCH_SIZE = 240;
const SCROLL_PRELOAD_PX = 900;

interface Props {
  images: Image[];
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
  onDeleteSelected: () => void;
  onDownloadImage: (image: Image) => void | Promise<void>;
  onCopyImage: (image: Image) => void | Promise<void>;
  onDeleteImages: (ids: number[]) => Promise<boolean>;
  onOpenSettings: () => void;
}

export const QQBrowser: React.FC<Props> = ({
  images,
  selectedIds,
  onSelectionChange,
  onDeleteSelected,
  onDownloadImage,
  onCopyImage,
  onDeleteImages,
  onOpenSettings,
}) => {
  const [cols, setCols] = useState(4);
  const [type, setType] = useState<TypeMode>('all');
  const [dateMode, setDateMode] = useState<DateMode>('all');
  const [startKey, setStartKey] = useState<string | null>(null);
  const [endKey, setEndKey] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<'date' | 'size'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [shapes, setShapes] = useState<Orient[]>([]);
  const [sizes, setSizes] = useState<SizeBucket[]>([]);
  const [dateOpen, setDateOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [lbIndex, setLbIndex] = useState<number | null>(null);
  const [showTop, setShowTop] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_RENDER_LIMIT);

  const scrollRef = useRef<HTMLDivElement>(null);
  const topBarRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const flatLengthRef = useRef(0);
  const showTopRef = useRef(false);
  const scrollFrameRef = useRef<number | null>(null);
  const visibleCountRef = useRef(INITIAL_RENDER_LIMIT);
  const [topBarHeight, setTopBarHeight] = useState(64);

  const todayMid = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  }, []);

  const items = useMemo(
    () => images.map((img) => deriveMediaItem(img, todayMid)),
    [images, todayMid],
  );

  const { todayKey, defStartKey, minISO, maxISO } = useMemo(() => {
    const tKey = fmtKey(todayMid);
    const oldest = items.reduce((a, m) => (m.dayKey < a ? m.dayKey : a), tKey);
    return {
      todayKey: tKey,
      defStartKey: fmtKey(todayMid - 13 * 86400000),
      minISO: dayKeyToISO(oldest),
      maxISO: dayKeyToISO(tKey),
    };
  }, [todayMid, items]);

  const flat = useMemo(() => {
    const sK = startKey || '00000000';
    const eK = endKey || '99999999';
    const inDate = (m: MediaItem) =>
      dateMode === 'all'
        ? true
        : dateMode === 'today'
          ? m.off === 0
          : dateMode === 'yest'
            ? m.off === 1
            : dateMode === '7'
              ? m.off <= 6
              : dateMode === '30'
                ? m.off <= 29
                : m.dayKey >= sK && m.dayKey <= eK;
    const inType = (m: MediaItem) =>
      type === 'all' ? true : type === 'img' ? !m.isVideo : m.isVideo;
    const inShape = (m: MediaItem) => shapes.length === 0 || shapes.includes(m.orient);
    const inSize = (m: MediaItem) => sizes.length === 0 || sizes.includes(m.sizeBucket);

    const out = items.filter((m) => inDate(m) && inType(m) && inShape(m) && inSize(m));
    if (sortKey === 'size') {
      out.sort(
        (a, b) =>
          (sortDir === 'asc' ? a.raw.fileSize - b.raw.fileSize : b.raw.fileSize - a.raw.fileSize) ||
          a.id - b.id,
      );
    } else {
      const ts = (m: MediaItem) => (m.raw.fileTime ? Date.parse(m.raw.fileTime) : 0);
      out.sort((a, b) => (sortDir === 'asc' ? ts(a) - ts(b) : ts(b) - ts(a)) || a.id - b.id);
    }
    return out;
  }, [items, dateMode, startKey, endKey, type, shapes, sizes, sortKey, sortDir]);

  const visibleFlat = useMemo(() => flat.slice(0, visibleCount), [flat, visibleCount]);

  const sections = useMemo(() => {
    if (sortKey === 'date') {
      const map = new Map<string, MediaItem[]>();
      const order: string[] = [];
      for (const m of visibleFlat) {
        let arr = map.get(m.dayKey);
        if (!arr) {
          arr = [];
          map.set(m.dayKey, arr);
          order.push(m.dayKey);
        }
        arr.push(m);
      }
      return order.map((k) => {
        const arr = map.get(k) as MediaItem[];
        return {
          key: k,
          label: arr[0].dateLabel,
          sub: arr[0].weekday,
          count: arr.length,
          items: arr,
          showHeader: true,
        };
      });
    }
    return [
      {
        key: 'all',
        label: '全部',
        sub: '',
        count: visibleFlat.length,
        items: visibleFlat,
        showHeader: false,
      },
    ];
  }, [visibleFlat, sortKey]);

  // Stable callbacks (read live values via refs) so memoized cards don't churn.
  const selRef = useRef(selectedIds);
  selRef.current = selectedIds;
  const idxRef = useRef<Map<number, number>>(new Map());
  idxRef.current = useMemo(() => {
    const m = new Map<number, number>();
    flat.forEach((it, i) => m.set(it.id, i));
    return m;
  }, [flat]);

  const toggleId = useCallback(
    (id: number) => {
      const set = new Set(selRef.current);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      onSelectionChange([...set]);
    },
    [onSelectionChange],
  );
  const openItem = useCallback((item: MediaItem) => {
    const i = idxRef.current.get(item.id);
    if (i != null) setLbIndex(i);
  }, []);

  const appendVisibleItems = useCallback((targetLength = flatLengthRef.current) => {
    if (visibleCountRef.current >= targetLength) return;
    const nextCount = Math.min(visibleCountRef.current + RENDER_BATCH_SIZE, targetLength);
    visibleCountRef.current = nextCount;
    React.startTransition(() => setVisibleCount(nextCount));
  }, []);

  useEffect(() => {
    flatLengthRef.current = flat.length;
  }, [flat.length]);

  useEffect(() => {
    visibleCountRef.current = visibleCount;
  }, [visibleCount]);

  useEffect(() => {
    showTopRef.current = showTop;
  }, [showTop]);

  useEffect(() => {
    visibleCountRef.current = INITIAL_RENDER_LIMIT;
    setVisibleCount(INITIAL_RENDER_LIMIT);
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = 0;
    }
  }, [items, dateMode, startKey, endKey, type, shapes, sizes, sortKey, sortDir]);

  // Lightbox: clamp the index against the (possibly changed) flat list.
  const clampedLb =
    lbIndex == null || flat.length === 0 ? null : Math.min(Math.max(lbIndex, 0), flat.length - 1);
  const cur = clampedLb == null ? null : flat[clampedLb];
  const lbOpen = cur != null;

  useEffect(() => {
    if (!lbOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLbIndex(null);
      else if (e.key === 'ArrowRight') setLbIndex((i) => Math.min(flat.length - 1, (i ?? 0) + 1));
      else if (e.key === 'ArrowLeft') setLbIndex((i) => Math.max(0, (i ?? 0) - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lbOpen, flat.length]);

  // Close dropdowns on outside click.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (dateOpen && dateRef.current && !dateRef.current.contains(t)) setDateOpen(false);
      if (filterOpen && filterRef.current && !filterRef.current.contains(t)) setFilterOpen(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [dateOpen, filterOpen]);

  // Scroll-to-top button visibility.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (scrollFrameRef.current != null) return;
      scrollFrameRef.current = window.requestAnimationFrame(() => {
        scrollFrameRef.current = null;
        const nextShowTop = el.scrollTop > 360;
        if (nextShowTop !== showTopRef.current) {
          showTopRef.current = nextShowTop;
          setShowTop(nextShowTop);
        }
        const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_PRELOAD_PX;
        if (nearBottom) {
          appendVisibleItems();
        }
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (scrollFrameRef.current != null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
    };
  }, [appendVisibleItems]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || visibleCount >= flat.length) return;
    if (el.scrollHeight <= el.clientHeight + SCROLL_PRELOAD_PX) {
      appendVisibleItems(flat.length);
    }
  }, [appendVisibleItems, cols, flat.length, topBarHeight, visibleCount, visibleFlat.length]);

  // Keep the content below the fixed toolbar, including when filters wrap.
  useEffect(() => {
    const el = topBarRef.current;
    if (!el) return;

    const updateHeight = () => setTopBarHeight(Math.ceil(el.getBoundingClientRect().height));
    updateHeight();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateHeight);
      return () => window.removeEventListener('resize', updateHeight);
    }

    const observer = new ResizeObserver(updateHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scrollToTop = () => {
    const el = scrollRef.current;
    if (!el) return;
    try {
      el.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      el.scrollTop = 0;
    }
  };

  const toggleArr = <T,>(val: T, set: React.Dispatch<React.SetStateAction<T[]>>) =>
    set((arr) => (arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]));

  const selectDate = (id: DateMode) => {
    if (id === 'custom') {
      setDateMode('custom');
      setStartKey((s) => s || defStartKey);
      setEndKey((e) => e || todayKey);
    } else {
      setDateMode(id);
      setDateOpen(false);
    }
  };

  const dateActive = dateMode !== 'all';
  const filterCount = shapes.length + sizes.length;
  const colsPct = Math.round(((cols - 2) / 5) * 100);
  const selectionActive = selectedIds.length > 0;
  const selSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  return (
    <div
      style={
        {
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#0B0D11',
          color: '#ECEFF4',
          fontSize: 14,
          overflow: 'hidden',
          '--accent': ACCENT,
          '--accent2': ACCENT2,
        } as CSS
      }
    >
      {/* ---- Top bar -------------------------------------------------------- */}
      <div
        ref={topBarRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          background: 'rgba(13,16,22,.55)',
          backdropFilter: 'blur(30px) saturate(180%)',
          WebkitBackdropFilter: 'blur(30px) saturate(180%)',
          borderBottom: '1px solid rgba(255,255,255,.1)',
          ...DRAG,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            minHeight: 50,
            padding: '6px 142px 6px 14px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flex: 'none' }}>
            <div
              style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.2px', whiteSpace: 'nowrap' }}
            >
              QQ 缓存媒体
            </div>
            <div style={{ fontSize: 12, color: '#6B7585', whiteSpace: 'nowrap' }}>
              · {items.length} 项
            </div>
          </div>

          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,.1)', flex: 'none' }} />

          {/* Date dropdown */}
          <div ref={dateRef} style={{ position: 'relative', ...NO_DRAG }}>
            <button
              onClick={() => {
                setDateOpen((o) => !o);
                setFilterOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                ...glassControl,
                border: `1px solid ${dateOpen || dateActive ? ACCENT2 : 'rgba(255,255,255,.12)'}`,
                padding: '6px 10px',
                cursor: 'pointer',
                color: dateOpen || dateActive ? '#fff' : '#C0C7D2',
                fontSize: 12.5,
                fontWeight: 600,
                transition: 'all .15s',
                whiteSpace: 'nowrap',
              }}
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
                <rect x="3" y="4.5" width="18" height="16.5" rx="2.5" />
                <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
              </svg>
              {DATE_META[dateMode]}
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  opacity: 0.65,
                  transform: dateOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform .2s',
                }}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {dateOpen && (
              <div
                style={{
                  ...popoverPanel,
                  top: 'calc(100% + 9px)',
                  left: 0,
                  width: 262,
                  padding: 14,
                }}
              >
                <div style={popoverLabel}>时间范围</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {DATE_OPTIONS.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => selectDate(d.id)}
                      style={{
                        padding: '9px 8px',
                        borderRadius: 10,
                        cursor: 'pointer',
                        fontSize: 12.5,
                        fontWeight: 600,
                        transition: 'all .15s',
                        ...chipStyle(dateMode === d.id),
                      }}
                    >
                      {d.txt}
                    </button>
                  ))}
                </div>
                {dateMode === 'custom' && (
                  <div
                    style={{
                      marginTop: 14,
                      paddingTop: 13,
                      borderTop: '1px solid rgba(255,255,255,.1)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="date"
                        value={dayKeyToISO(startKey || defStartKey)}
                        min={minISO}
                        max={maxISO}
                        onChange={(e) => setStartKey(isoToDayKey(e.target.value))}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          colorScheme: 'dark',
                          background: 'rgba(255,255,255,.08)',
                          border: '1px solid rgba(255,255,255,.14)',
                          borderRadius: 8,
                          color: '#ECEFF4',
                          fontSize: 12.5,
                          padding: '6px 8px',
                          fontFamily: 'inherit',
                          outline: 'none',
                          cursor: 'pointer',
                        }}
                      />
                      <span style={{ color: '#6B7585', fontSize: 13, flex: 'none' }}>→</span>
                      <input
                        type="date"
                        value={dayKeyToISO(endKey || todayKey)}
                        min={minISO}
                        max={maxISO}
                        onChange={(e) => setEndKey(isoToDayKey(e.target.value))}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          colorScheme: 'dark',
                          background: 'rgba(255,255,255,.08)',
                          border: '1px solid rgba(255,255,255,.14)',
                          borderRadius: 8,
                          color: '#ECEFF4',
                          fontSize: 12.5,
                          padding: '6px 8px',
                          fontFamily: 'inherit',
                          outline: 'none',
                          cursor: 'pointer',
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 12, color: '#6B7585', marginTop: 9 }}>
                      共 {flat.length} 项
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Type chips */}
          <div style={{ ...glassControl, display: 'flex', gap: 2, padding: 3, ...NO_DRAG }}>
            {TYPE_CHIPS.map((t) => {
              const active = type === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setType(t.id)}
                  style={{
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 12.5,
                    fontWeight: active ? 600 : 500,
                    padding: '5px 10px',
                    borderRadius: 8,
                    background: active ? 'rgba(255,255,255,.16)' : 'transparent',
                    color: active ? '#fff' : '#8A93A3',
                    transition: 'all .15s',
                  }}
                >
                  {t.txt}
                </button>
              );
            })}
          </div>

          {/* Filter dropdown */}
          <div ref={filterRef} style={{ position: 'relative', ...NO_DRAG }}>
            <button
              onClick={() => {
                setFilterOpen((o) => !o);
                setDateOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                ...glassControl,
                border: `1px solid ${filterOpen || filterCount > 0 ? ACCENT2 : 'rgba(255,255,255,.12)'}`,
                padding: '7px 10px',
                cursor: 'pointer',
                color: filterOpen || filterCount > 0 ? '#fff' : '#C0C7D2',
                fontSize: 12.5,
                fontWeight: 600,
                transition: 'all .15s',
              }}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M4 6h16M7 12h10M10 18h4" />
              </svg>
              筛选
              {filterCount > 0 && (
                <span
                  style={{
                    minWidth: 17,
                    height: 17,
                    padding: '0 5px',
                    borderRadius: 999,
                    background: GRAD,
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {filterCount}
                </span>
              )}
            </button>
            {filterOpen && (
              <div
                style={{
                  ...popoverPanel,
                  top: 'calc(100% + 9px)',
                  right: 0,
                  width: 286,
                  padding: 16,
                }}
              >
                <div style={popoverLabel}>图片类型</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
                  {SHAPES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => toggleArr(s.id, setShapes)}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 7,
                        padding: '12px 6px',
                        borderRadius: 10,
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 600,
                        transition: 'all .15s',
                        ...chipStyle(shapes.includes(s.id)),
                      }}
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        {s.path}
                      </svg>
                      {s.txt}
                    </button>
                  ))}
                </div>
                <div style={popoverLabel}>文件大小</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {SIZE_CHIPS.map((z) => (
                    <button
                      key={z.id}
                      onClick={() => toggleArr(z.id, setSizes)}
                      style={{
                        padding: '10px 8px',
                        borderRadius: 10,
                        cursor: 'pointer',
                        fontSize: 12.5,
                        fontWeight: 600,
                        transition: 'all .15s',
                        ...chipStyle(sizes.includes(z.id)),
                      }}
                    >
                      {z.txt}
                    </button>
                  ))}
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginTop: 16,
                    paddingTop: 14,
                    borderTop: '1px solid rgba(255,255,255,.1)',
                  }}
                >
                  <button
                    onClick={() => {
                      setShapes([]);
                      setSizes([]);
                    }}
                    style={{
                      flex: 1,
                      padding: 9,
                      borderRadius: 10,
                      border: '1px solid rgba(255,255,255,.14)',
                      cursor: 'pointer',
                      background: 'rgba(255,255,255,.06)',
                      color: '#C0C7D2',
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    重置
                  </button>
                  <button
                    onClick={() => setFilterOpen(false)}
                    style={{
                      flex: 1,
                      padding: 9,
                      borderRadius: 10,
                      border: 'none',
                      cursor: 'pointer',
                      background: GRAD,
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    完成
                  </button>
                </div>
              </div>
            )}
          </div>

          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,.1)', flex: 'none' }} />

          {/* Sort chips */}
          <div style={{ ...glassControl, display: 'flex', gap: 2, padding: 3, ...NO_DRAG }}>
            {(
              [
                { id: 'date', txt: '日期' },
                { id: 'size', txt: '大小' },
              ] as const
            ).map((s) => {
              const active = sortKey === s.id;
              return (
                <button
                  key={s.id}
                  title={
                    active
                      ? sortDir === 'asc'
                        ? '当前升序，点击切换为降序'
                        : '当前降序，点击切换为升序'
                      : `按${s.txt}排序`
                  }
                  onClick={() =>
                    active ? setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')) : setSortKey(s.id)
                  }
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 12.5,
                    fontWeight: active ? 600 : 500,
                    padding: '5px 9px',
                    borderRadius: 8,
                    background: active ? 'rgba(255,255,255,.16)' : 'transparent',
                    color: active ? '#fff' : '#8A93A3',
                    transition: 'all .15s',
                  }}
                >
                  {s.txt}
                  {active && (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{
                        transform: sortDir === 'asc' ? 'rotate(180deg)' : 'none',
                        transition: 'transform .2s',
                      }}
                    >
                      <path d="M12 5v14M19 12l-7 7-7-7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>

          {/* Columns slider */}
          <div
            style={{
              ...glassControl,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 8px',
              ...NO_DRAG,
            }}
            title="每行显示数量"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="#7E8A9B">
              <rect x="3" y="3" width="7" height="7" rx="1.6" />
              <rect x="14" y="3" width="7" height="7" rx="1.6" />
              <rect x="3" y="14" width="7" height="7" rx="1.6" />
              <rect x="14" y="14" width="7" height="7" rx="1.6" />
            </svg>
            <input
              type="range"
              min={2}
              max={7}
              step={1}
              value={cols}
              onChange={(e) => setCols(parseInt(e.target.value, 10))}
              style={{
                width: 50,
                cursor: 'pointer',
                background: `linear-gradient(90deg,${ACCENT2} ${colsPct}%,rgba(255,255,255,.18) ${colsPct}%)`,
              }}
            />
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: '#D6DBE3',
                whiteSpace: 'nowrap',
                minWidth: 12,
                textAlign: 'center',
              }}
            >
              {cols}
            </div>
          </div>

          {/* Settings gear */}
          <button
            className="qq-gear"
            onClick={onOpenSettings}
            title="设置"
            style={{
              ...glassControl,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '7px 9px',
              color: '#C0C7D2',
              cursor: 'pointer',
              transition: 'color .15s',
              ...NO_DRAG,
            }}
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
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>

        <WindowControls />
      </div>

      {/* ---- Scroll area ---------------------------------------------------- */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          position: 'relative',
        }}
      >
        <div style={{ padding: `${topBarHeight + 18}px 18px 80px` }}>
          {flat.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '96px 20px', color: '#5C6573' }}>
              <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.6 }}>🗂️</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#8A93A3' }}>
                没有符合条件的内容
              </div>
              <div style={{ fontSize: 13, marginTop: 6 }}>试试调整日期或类型筛选</div>
            </div>
          ) : (
            sections.map((sec) => (
              <div key={sec.key} style={{ marginBottom: 30 }}>
                {sec.showHeader && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      marginBottom: 13,
                      paddingTop: 2,
                    }}
                  >
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#ECEFF4' }}>
                      {sec.label}
                    </div>
                    <div style={{ fontSize: 12.5, color: '#6B7585' }}>{sec.sub}</div>
                    <div style={{ marginLeft: 'auto', fontSize: 12, color: '#5C6573' }}>
                      {sec.count}
                    </div>
                  </div>
                )}
                <div style={{ columnCount: cols, columnGap: '8px' }}>
                  {sec.items.map((item) => (
                    <MediaCard
                      key={item.id}
                      item={item}
                      selected={selSet.has(item.id)}
                      showSize={sortKey === 'size'}
                      onOpen={openItem}
                      onToggleSelect={toggleId}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ---- Selection pill ------------------------------------------------- */}
      {selectionActive && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 22,
            transform: 'translateX(-50%)',
            zIndex: 70,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '9px 11px 9px 18px',
              borderRadius: 999,
              background: 'rgba(20,24,32,.78)',
              backdropFilter: 'blur(26px) saturate(180%)',
              WebkitBackdropFilter: 'blur(26px) saturate(180%)',
              border: '1px solid rgba(255,255,255,.16)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,.2),0 14px 40px rgba(0,0,0,.5)',
              animation: 'popIn .25s both',
            }}
          >
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap' }}>
              已选择 {selectedIds.length} 项
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                className="qq-del"
                onClick={onDeleteSelected}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  border: '1px solid rgba(255,120,120,.28)',
                  cursor: 'pointer',
                  background: 'rgba(255,80,80,.16)',
                  color: '#FF9A9A',
                  fontSize: 13,
                  fontWeight: 600,
                  padding: '7px 14px',
                  borderRadius: 999,
                  transition: 'background .15s',
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
                </svg>
                删除
              </button>
              <button
                className="qq-cancel"
                onClick={() => onSelectionChange([])}
                style={{
                  border: '1px solid rgba(255,255,255,.16)',
                  cursor: 'pointer',
                  background: 'rgba(255,255,255,.1)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  padding: '7px 14px',
                  borderRadius: 999,
                  transition: 'background .15s',
                }}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Scroll to top -------------------------------------------------- */}
      {showTop && (
        <button
          className="qq-scrolltop"
          onClick={scrollToTop}
          title="回到顶部"
          style={{
            position: 'absolute',
            right: 22,
            bottom: 22,
            zIndex: 60,
            width: 50,
            height: 50,
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,.2)',
            cursor: 'pointer',
            background: 'rgba(255,255,255,.1)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.3),0 10px 30px rgba(0,0,0,.42)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            animation: 'popIn .25s both',
            transition: 'background .2s,transform .2s',
          }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 19V6" />
            <path d="M5 12l7-7 7 7" />
          </svg>
        </button>
      )}

      {/* ---- Lightbox ------------------------------------------------------- */}
      {cur && (
        <Lightbox
          item={cur}
          indexLabel={`${(clampedLb as number) + 1} / ${flat.length}`}
          onClose={() => setLbIndex(null)}
          onPrev={() => setLbIndex((i) => Math.max(0, (i ?? 0) - 1))}
          onNext={() => setLbIndex((i) => Math.min(flat.length - 1, (i ?? 0) + 1))}
          onDownload={() => onDownloadImage(cur.raw)}
          onCopy={() => onCopyImage(cur.raw)}
          onDelete={async () => {
            await onDeleteImages([cur.id]);
          }}
        />
      )}
    </div>
  );
};

export default QQBrowser;
