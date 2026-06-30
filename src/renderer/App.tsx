import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Layout, ConfigProvider, App as AntdApp, Modal, Spin } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { AnimatePresence } from 'framer-motion';

import { useDispatch, useSelector } from 'react-redux';
import { useImageAPI, useImageListener } from './hooks/useImageAPI';
import {
  setImages,
  setLoading,
  setCurrentMonth,
  setSelectedIds,
  removeImages,
} from './store/slices/imageSlice';
import { loadSettings } from './store/slices/settingsSlice';
import { RootState, AppDispatch } from './store/store';

import { useKeyboardShortcuts, ShortcutAction } from './hooks/useKeyboardShortcuts';
import { ImageViews } from './components/gallery/ImageViews';
import { ImagePreview } from './components/gallery/ImagePreview';
import { TopFilterBar } from './components/filters/TopFilterBar';
import { SettingsModal } from './components/settings/SettingsModal';

import { Image, QueryParams } from '../shared/types';
import { useTheme } from './hooks/useTheme';
import { ErrorBoundary } from './components/ErrorBoundary';

const { Content, Footer } = Layout;
const PAGE_SIZE = 200;

interface ScanProgress {
  currentMonth: string;
  processedFiles: number;
  totalFiles: number;
  percent: number;
}

// 内部主组件，可以使用 useApp hook
const AppContent: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const {
    scanImages,
    getMonths,
    getImages,
    deleteImages: deleteImagesApi,
    deleteMonthImages,
  } = useImageAPI();
  const { images, loading, sortField, sortOrder, currentMonth, selectedIds } = useSelector(
    (state: RootState) => state.images,
  );

  const filters = useSelector((state: RootState) => state.filters);

  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [months, setMonths] = useState<{ yearMonth: string; count: number }[]>([]);
  const [previewingImage, setPreviewingImage] = useState<Image | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [columnCount, setColumnCount] = useState(5);

  const [settingsVisible, setSettingsVisible] = useState(false);
  const { message: messageApi } = AntdApp.useApp();

  const hasMoreRef = useRef(true);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasActiveFilters =
    filters.selectedFormats.length > 0 ||
    filters.selectedCategories.length > 0 ||
    filters.sizeRange[0] !== 0 ||
    Number.isFinite(filters.sizeRange[1]) ||
    filters.ratioRange[0] > 0 ||
    Number.isFinite(filters.ratioRange[1]);

  const queryFilters = useMemo(() => {
    const activeSizeRange =
      filters.sizeRange[0] !== 0 || Number.isFinite(filters.sizeRange[1])
        ? filters.sizeRange
        : undefined;
    const activeRatioRange =
      filters.ratioRange[0] > 0 || Number.isFinite(filters.ratioRange[1])
        ? filters.ratioRange
        : undefined;

    return {
      formats: filters.selectedFormats.length > 0 ? filters.selectedFormats : undefined,
      categories: filters.selectedCategories.length > 0 ? filters.selectedCategories : undefined,
      sizeRange: activeSizeRange,
      ratioRange: activeRatioRange,
      sortField,
      sortOrder,
    } satisfies Pick<
      QueryParams,
      'formats' | 'categories' | 'sizeRange' | 'ratioRange' | 'sortField' | 'sortOrder'
    >;
  }, [filters, sortField, sortOrder]);
  const querySignature = useMemo(() => JSON.stringify(queryFilters), [queryFilters]);

  // Set up listener for scan progress
  useEffect(() => {
    const unsubscribe = useImageListener((data: ScanProgress) => {
      setProgress(data);
    });
    return unsubscribe;
  }, []);

  // Load settings on app startup
  useEffect(() => {
    dispatch(loadSettings());
    loadMonths();
    // 自动扫描缓存
    handleScan();
  }, [dispatch]);

  // Set up keyboard shortcuts
  const shortcuts: ShortcutAction[] = [
    {
      key: 'ctrl+s',
      description: '扫描 QQ 缓存',
      handler: () => handleScan(),
    },

    {
      key: 'ctrl+,',
      description: '打开设置',
      handler: () => setSettingsVisible(true),
    },

    {
      key: 'escape',
      description: '关闭弹窗或清除选择',
      handler: () => {
        if (previewVisible) {
          setPreviewVisible(false);
          return;
        }
        if (settingsVisible) {
          setSettingsVisible(false);
          return;
        }
        if (selectedIds.length > 0) {
          dispatch(setSelectedIds([]));
        }
      },
    },
  ];

  useKeyboardShortcuts({ shortcuts, enabled: true });

  const handleScan = async () => {
    setScanning(true);
    dispatch(setLoading(true));
    try {
      const result = await scanImages({});
      if (result.success) {
        messageApi.success(`扫描完成: ${result.totalImages} 张图片`);
        const monthsList = await getMonths();
        setMonths(monthsList || []);
        dispatch(setCurrentMonth(null));
        await loadImages('', false);
      } else {
        messageApi.error(result.message);
      }
    } catch (error) {
      messageApi.error('扫描失败');
      console.error(error);
    } finally {
      setScanning(false);
      dispatch(setLoading(false));
      setProgress(null);
    }
  };

  const imagesRef = useRef(images);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  const loadImages = useCallback(
    async (yearMonth: string, append: boolean) => {
      try {
        const currentImages = append ? imagesRef.current : [];
        const offset = currentImages.length;
        const imageList = await getImages({
          yearMonth,
          ...queryFilters,
          offset,
          limit: PAGE_SIZE,
        });
        const newImages = imageList || [];
        hasMoreRef.current = newImages.length >= PAGE_SIZE;
        if (append) {
          dispatch(setImages([...currentImages, ...newImages]));
        } else {
          dispatch(setImages(newImages));
        }
      } catch (error) {
        console.error('加载图片失败:', error);
      }
    },
    [getImages, queryFilters, dispatch],
  );

  const loadingRef = useRef(false);

  const loadMore = useCallback(() => {
    if (loadingRef.current || !hasMoreRef.current) return;
    loadingRef.current = true;
    dispatch(setLoading(true));
    loadImages(currentMonth || '', true).finally(() => {
      loadingRef.current = false;
      dispatch(setLoading(false));
    });
  }, [currentMonth, loadImages, dispatch]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: '400px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  const loadMonths = async () => {
    try {
      const monthsList = await getMonths();
      setMonths(monthsList || []);
    } catch (error) {
      console.error('加载月份失败:', error);
    }
  };

  const handleMonthClick = async (yearMonth: string) => {
    const effectiveMonth = yearMonth === '' ? null : yearMonth;
    dispatch(setCurrentMonth(effectiveMonth));
    hasMoreRef.current = true;
  };

  useEffect(() => {
    hasMoreRef.current = true;
    dispatch(setLoading(true));
    loadImages(currentMonth || '', false).finally(() => dispatch(setLoading(false)));
  }, [currentMonth, querySignature, loadImages, dispatch]);

  const handleDeleteSelected = () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: `将永久删除已选的 ${ids.length} 张图片，此操作不可撤销。`,
      okText: `删除 ${ids.length} 张`,
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        const wasPreviewingDeleted = !!(previewingImage && ids.includes(previewingImage.id));
        try {
          const result = await deleteImagesApi(ids);
          if (result?.success) {
            if (wasPreviewingDeleted) setPreviewVisible(false);
            dispatch(removeImages(ids));
            messageApi.success(`已删除 ${result.deleted} 张图片`);
            await loadMonths();
          } else {
            messageApi.error(
              `删除失败：成功 ${result?.deleted ?? 0} / 失败 ${result?.failed ?? ids.length}`,
            );
          }
        } catch (err) {
          console.error('Delete failed:', err);
          messageApi.error('删除失败');
        }
      },
    });
  };

  const handleDeleteMonth = (yearMonth: string) => {
    const target = months.find((m) => m.yearMonth === yearMonth);
    const count = target?.count ?? 0;
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: `将永久删除 ${yearMonth} 的全部 ${count} 张图片文件，此操作不可撤销。`,
      okText: `删除 ${count} 张`,
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        const wasPreviewingFromMonth = !!(
          previewingImage && previewingImage.fileTime?.startsWith(yearMonth)
        );
        try {
          const result = await deleteMonthImages(yearMonth);
          if (result?.success) {
            if (wasPreviewingFromMonth) setPreviewVisible(false);
            messageApi.success(`已删除 ${result.deleted} 张图片`);
            await loadMonths();
            if (currentMonth === yearMonth) {
              dispatch(setCurrentMonth(null));
              await loadImages('', false);
            } else {
              const currentImageIds = images
                .filter((img) => img.fileTime?.startsWith(yearMonth))
                .map((img) => img.id);
              if (currentImageIds.length > 0) dispatch(removeImages(currentImageIds));
            }
          } else {
            messageApi.error(
              `删除失败：成功 ${result?.deleted ?? 0} / 失败 ${result?.failed ?? 0}`,
            );
          }
        } catch (err) {
          console.error('Delete month failed:', err);
          messageApi.error('删除失败');
        }
      },
    });
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Top Filter Bar merged with Header actions */}
      <TopFilterBar
        months={months}
        currentMonth={currentMonth}
        onMonthSelect={handleMonthClick}
        onDeleteMonth={handleDeleteMonth}
        columnCount={columnCount}
        onColumnCountChange={setColumnCount}
        scanning={scanning}
        scanProgress={progress}
        onScan={handleScan}
        onOpenSettings={() => setSettingsVisible(true)}
      />

      {/* Main Content */}
      <Layout style={{ flex: 1 }}>
        <Content style={{ padding: '24px', overflow: 'auto', flex: 1 }}>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ margin: 0 }}>
              {images.length > 0
                ? `已加载 ${images.length} 张图片`
                : hasActiveFilters
                  ? '未找到匹配的图片'
                  : '请选择月份或扫描目录'}
            </h2>
          </div>

          {images.length > 0 && (
            <ImageViews
              images={images}
              onImageSelect={(image) => {
                setPreviewingImage(image);
                setPreviewVisible(true);
              }}
              columnCount={columnCount}
              previewingImageId={previewingImage?.id ?? null}
              selectedIds={selectedIds}
              onSelectionChange={(ids) => dispatch(setSelectedIds(ids))}
              onDeleteSelected={handleDeleteSelected}
            />
          )}
          {loading && (
            <div style={{ textAlign: 'center', padding: 12 }}>
              <Spin />
            </div>
          )}
          <div ref={sentinelRef} style={{ height: 1 }} />
        </Content>
      </Layout>

      {/* Image Preview with Apple Photos shared-element transition */}
      <AnimatePresence onExitComplete={() => setPreviewingImage(null)}>
        {previewVisible && previewingImage && (
          <ImagePreview image={previewingImage} onClose={() => setPreviewVisible(false)} />
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <SettingsModal open={settingsVisible} onClose={() => setSettingsVisible(false)} />

      <Footer style={{ textAlign: 'center', background: '#f5f5f5' }}>
        QQ 缓存图片查看器 © 2026 - Phase 5 UI/UX 和设置
      </Footer>
    </Layout>
  );
};

// 主题感知的内层组件 — 必须在 <Provider store={store}> 之内（见 src/renderer/index.tsx）
// 因为 useTheme() 依赖 useSelector 读取 preferences.theme
const ThemedApp: React.FC = () => {
  const { theme, themeConfig } = useTheme();

  // Toggle a body class so non-Ant components / global CSS can react to theme changes
  useEffect(() => {
    document.body.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <ConfigProvider theme={themeConfig}>
      <AntdApp>
        <ErrorBoundary>
          <AppContent />
        </ErrorBoundary>
      </AntdApp>
    </ConfigProvider>
  );
};

const App: React.FC = () => <ThemedApp />;

export default App;
