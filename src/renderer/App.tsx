import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ConfigProvider, App as AntdApp, Modal } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';

import { useDispatch, useSelector } from 'react-redux';
import { useImageAPI } from './hooks/useImageAPI';
import { setImages, setLoading, setSelectedIds, removeImages } from './store/slices/imageSlice';
import { loadSettings } from './store/slices/settingsSlice';
import { RootState, AppDispatch } from './store/store';

import { useKeyboardShortcuts, ShortcutAction } from './hooks/useKeyboardShortcuts';
import { QQBrowser } from './components/qq/QQBrowser';
import { SettingsModal } from './components/settings/SettingsModal';

import { Image } from '../shared/types';
import { ErrorBoundary } from './components/ErrorBoundary';
import darkTheme from './themes/dark';

const PAGE_SIZE = 500; // db clamps to its MAX_QUERY_LIMIT; page through to load all

const AppContent: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { scanImages, getImages, deleteImages: deleteImagesApi } = useImageAPI();
  const { images, selectedIds } = useSelector((state: RootState) => state.images);
  const { message: messageApi } = AntdApp.useApp();

  const [settingsVisible, setSettingsVisible] = useState(false);

  // Keep a live handle on the image list for the startup auto-scan decision.
  const imagesRef = useRef(images);
  imagesRef.current = images;

  // Load the full catalog client-side (filtering/sorting/grouping happens in
  // QQBrowser), paging through the clamped query limit.
  const loadAll = useCallback(async () => {
    dispatch(setLoading(true));
    try {
      const all: Image[] = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const batch = await getImages({ offset, limit: PAGE_SIZE });
        if (!batch || batch.length === 0) break;
        all.push(...batch);
        if (batch.length < PAGE_SIZE) break;
      }
      dispatch(setImages(all));
    } catch (error) {
      console.error('加载图片失败:', error);
      dispatch(setLoading(false));
    }
  }, [getImages, dispatch]);

  const handleScan = useCallback(async () => {
    messageApi.open({ type: 'loading', content: '正在扫描 QQ 缓存…', duration: 0, key: 'scan' });
    try {
      const result = await scanImages({});
      if (result.success) {
        messageApi.open({ type: 'success', content: `扫描完成：${result.totalImages} 项`, key: 'scan' });
        await loadAll();
      } else {
        messageApi.open({ type: 'error', content: result.message, key: 'scan' });
      }
    } catch (error) {
      messageApi.open({ type: 'error', content: '扫描失败', key: 'scan' });
      console.error(error);
    }
  }, [scanImages, loadAll, messageApi]);

  // Startup: show cached items immediately, then auto-scan if the preference is
  // on or the cache is empty.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadAll();
      let auto = false;
      try {
        const settings = await dispatch(loadSettings()).unwrap();
        auto = !!settings.preferences.autoScanOnStartup;
      } catch {
        /* settings load failure is non-fatal */
      }
      if (cancelled) return;
      if (auto || imagesRef.current.length === 0) await handleScan();
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectionChange = useCallback(
    (ids: number[]) => dispatch(setSelectedIds(ids)),
    [dispatch],
  );

  const handleDeleteSelected = useCallback(() => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: `将永久删除已选的 ${ids.length} 项，此操作不可撤销。`,
      okText: `删除 ${ids.length} 项`,
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const result = await deleteImagesApi(ids);
          if (result?.success) {
            dispatch(removeImages(ids));
            messageApi.success(`已删除 ${result.deleted} 项`);
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
  }, [selectedIds, deleteImagesApi, dispatch, messageApi]);

  const openSettings = useCallback(() => setSettingsVisible(true), []);

  const shortcuts: ShortcutAction[] = [
    { key: 'ctrl+s', description: '扫描 QQ 缓存', handler: () => handleScan() },
    { key: 'ctrl+,', description: '打开设置', handler: () => setSettingsVisible(true) },
    {
      key: 'escape',
      description: '关闭设置或清除选择',
      handler: () => {
        if (settingsVisible) {
          setSettingsVisible(false);
          return;
        }
        if (selectedIds.length > 0) dispatch(setSelectedIds([]));
      },
    },
  ];
  useKeyboardShortcuts({ shortcuts, enabled: true });

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <QQBrowser
        images={images}
        selectedIds={selectedIds}
        onSelectionChange={handleSelectionChange}
        onDeleteSelected={handleDeleteSelected}
        onOpenSettings={openSettings}
      />
      <SettingsModal open={settingsVisible} onClose={() => setSettingsVisible(false)} />
    </div>
  );
};

const App: React.FC = () => (
  <ConfigProvider theme={darkTheme}>
    <AntdApp>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </AntdApp>
  </ConfigProvider>
);

export default App;
