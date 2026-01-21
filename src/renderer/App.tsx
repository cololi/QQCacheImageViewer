import React, { useEffect, useState, useMemo } from 'react';
import { Layout, Button, ConfigProvider, App as AntdApp } from 'antd';

import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useImageAPI, useImageListener } from './hooks/useImageAPI';
import { setImages, setLoading, setCurrentMonth, setSortField, setSortOrder } from './store/slices/imageSlice';
import { setSelectedFormats, setSelectedCategories, setSizeRange, resetFilters } from './store/slices/filterSlice';
import { loadSettings } from './store/slices/settingsSlice';
import { RootState, AppDispatch } from './store/store';

import { useKeyboardShortcuts, ShortcutAction } from './hooks/useKeyboardShortcuts';
import { ImageViews } from './components/gallery/ImageViews';
import { ImagePreview } from './components/gallery/ImagePreview';
import { TopFilterBar } from './components/filters/TopFilterBar';
import { SettingsModal } from './components/settings/SettingsModal';




import { Image } from '../shared/types';
import lightTheme from './themes/light';

const { Header, Content, Footer } = Layout;

interface ScanProgress {
  currentMonth: string;
  processedFiles: number;
  totalFiles: number;
  percent: number;
}

// 内部主组件，可以使用 useApp hook
const AppContent: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { t, i18n } = useTranslation();
  const { scanImages, getMonths, getImages } = useImageAPI();
  const { images, loading, sortField, sortOrder, currentMonth } = useSelector((state: RootState) => state.images);

  const filters = useSelector((state: RootState) => state.filters);

  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [months, setMonths] = useState<any[]>([]);
  const [selectedImage, setSelectedImage] = useState<Image | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [columnCount, setColumnCount] = useState(5);

  const [settingsVisible, setSettingsVisible] = useState(false);
  const { message: messageApi } = AntdApp.useApp();

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
      description: 'Scan QQ cache',
      handler: () => handleScan(),
    },

    {
      key: 'ctrl+,',
      description: 'Open settings',
      handler: () => setSettingsVisible(true),
    },

    {
      key: 'escape',
      description: 'Close modals',
      handler: () => {
        setPreviewVisible(false);
        setSettingsVisible(false);
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
        // 加载月份列表
        const monthsList = await getMonths();
        setMonths(monthsList || []);

        // 默认显示所有图片
        dispatch(setCurrentMonth(null));

        try {
          const imageList = await getImages({
            yearMonth: '', // Empty string for all months
            offset: 0,
            limit: -1,
          });
          dispatch(setImages(imageList || []));
          messageApi.info(`已加载全部图片`);
        } catch (error) {
          console.error('Failed to load images after scan:', error);
        }
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

  const loadMonths = async () => {
    try {
      const monthsList = await getMonths();
      setMonths(monthsList || []);
    } catch (error) {
      console.error('Failed to load months:', error);
    }
  };

  const handleMonthClick = async (yearMonth: string) => {
    const effectiveMonth = yearMonth === '' ? null : yearMonth;
    dispatch(setCurrentMonth(effectiveMonth));
    dispatch(setLoading(true));
    try {
      const imageList = await getImages({
        yearMonth,
        offset: 0,
        limit: -1,
      });
      dispatch(setImages(imageList || []));
    } catch (error) {
      messageApi.error('加载图片失败');
      console.error(error);
    } finally {
      dispatch(setLoading(false));
    }
  };

  // Filter and sort images
  const filteredImages = useMemo(() => {
    let result = [...images];



    // Format filter
    if (filters.selectedFormats.length > 0) {
      result = result.filter((img) => filters.selectedFormats.includes(img.format.toLowerCase()));
    }

    // Size range filter
    result = result.filter((img) => img.fileSize >= filters.sizeRange[0] && img.fileSize <= filters.sizeRange[1]);

    // Ratio range filter
    if (filters.ratioRange[0] > 0 || filters.ratioRange[1] < Infinity) {
      result = result.filter(
        (img) => img.ratio && img.ratio >= filters.ratioRange[0] && img.ratio <= filters.ratioRange[1]
      );
    }

    // Category filter
    if (filters.selectedCategories.length > 0) {
      result = result.filter((img) => {
        for (const category of filters.selectedCategories) {
          if (category === 'portrait' && img.ratio && img.ratio < 0.8) return true;
          if (category === 'landscape' && img.ratio && img.ratio > 1.25) return true;
          if (category === 'square' && img.ratio && img.ratio >= 0.8 && img.ratio <= 1.25) return true;
        }
        return false;
      });
    }

    // Sorting
    result.sort((a, b) => {
      let compareValue = 0;

      switch (sortField) {
        case 'file_time':
          compareValue = (a.fileTime ? new Date(a.fileTime).getTime() : 0) - (b.fileTime ? new Date(b.fileTime).getTime() : 0);
          break;
        case 'size':
          compareValue = a.fileSize - b.fileSize;
          break;
        case 'width':
          compareValue = (a.width || 0) - (b.width || 0);
          break;
        case 'height':
          compareValue = (a.height || 0) - (b.height || 0);
          break;
        case 'pixels':
          compareValue = ((a.width || 0) * (a.height || 0)) - ((b.width || 0) * (b.height || 0));
          break;
        case 'ratio':
          compareValue = (a.ratio || 0) - (b.ratio || 0);
          break;
        case 'name':
        default:
          compareValue = a.hash.localeCompare(b.hash);
          break;
      }

      return sortOrder === 'asc' ? compareValue : -compareValue;
    });

    return result;
  }, [images, filters, sortField, sortOrder]);



  const handleReset = () => {
    dispatch(resetFilters());
    dispatch(setSortField('file_time'));
    dispatch(setSortOrder('desc'));
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Top Filter Bar merged with Header actions */}
      <TopFilterBar
        months={months}
        currentMonth={currentMonth}
        onMonthSelect={handleMonthClick}
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
              {filteredImages.length > 0
                ? `共 ${filteredImages.length} 张图片 (总计 ${images.length})`
                : images.length > 0
                  ? '未找到匹配的图片'
                  : '请选择月份或扫描目录'}
            </h2>
          </div>

          {filteredImages.length > 0 && (
            <ImageViews
              images={filteredImages}
              loading={loading}
              onImageSelect={(image) => {
                setSelectedImage(image);
                setPreviewVisible(true);
              }}
              columnCount={columnCount}
            />
          )}
        </Content>
      </Layout>

      {/* Image Preview Modal */}
      <ImagePreview
        image={selectedImage}
        open={previewVisible}
        onClose={() => setPreviewVisible(false)}
      />

      {/* Settings Modal */}
      <SettingsModal
        open={settingsVisible}
        onClose={() => setSettingsVisible(false)}
      />

      <Footer style={{ textAlign: 'center', background: '#f5f5f5' }}>
        QQ 缓存图片查看器 © 2026 - Phase 5 UI/UX 和设置
      </Footer>
    </Layout>
  );
};

// 外层包装组件，提供 ConfigProvider 和 AntdApp 上下文
const App: React.FC = () => {
  return (
    <ConfigProvider theme={lightTheme}>
      <AntdApp>
        <AppContent />
      </AntdApp>
    </ConfigProvider>
  );
};

export default App;

