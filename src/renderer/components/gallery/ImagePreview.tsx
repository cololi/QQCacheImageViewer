import React, { useState, useEffect } from 'react';
import { Button, Space, Tooltip, message } from 'antd';
import { motion } from 'framer-motion';
import {
  ZoomInOutlined,
  ZoomOutOutlined,
  RotateLeftOutlined,
  RotateRightOutlined,
  DownloadOutlined,
  FolderOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import { Image } from '../../../shared/types';
import { getImageUrl, formatFileSize, formatDate } from '../../utils/imageUtils';

interface ImagePreviewProps {
  image: Image;
  onClose: () => void;
}

/**
 * Convert any image blob (jpeg/webp/etc.) to PNG so the Clipboard API
 * accepts it. The Clipboard write() spec only allows image/png reliably
 * across browsers and Electron.
 */
const blobToPng = (blob: Blob): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('canvas 2d context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (png) => (png ? resolve(png) : reject(new Error('toBlob failed'))),
        'image/png',
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image load failed'));
    };
    img.src = url;
  });

/**
 * ImagePreview — Apple Photos style fullscreen viewer with shared-element
 * transition. Driven by parent AnimatePresence; exit animation reverses to
 * the originating thumbnail position via layoutId match.
 */
export const ImagePreview: React.FC<ImagePreviewProps> = ({ image, onClose }) => {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    setScale(1);
    setRotation(0);
  }, [image.id]);

  const handleClose = () => {
    setScale(1);
    setRotation(0);
    onClose();
  };

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.1, 5));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.1, 0.1));

  const handleWheel = (e: React.WheelEvent) => {
    if (e.deltaY < 0) handleZoomIn();
    else handleZoomOut();
  };

  const handleRotateLeft = () => setRotation((prev) => (prev - 90 + 360) % 360);
  const handleRotateRight = () => setRotation((prev) => (prev + 90) % 360);

  const handleCopy = async () => {
    try {
      const blob = await fetch(getImageUrl(image)).then((r) => r.blob());
      const png = await blobToPng(blob);
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      message.success('已复制图片到剪贴板');
    } catch (err) {
      console.error('Copy failed:', err);
      message.error('复制失败');
    }
  };

  const handleDownload = async () => {
    try {
      const result = await window.electron!.ipcRenderer.invoke('save-image', image);
      if (result.success) {
        message.success('保存成功');
      } else if (result.message !== 'Cancelled') {
        message.error(result.message);
      }
    } catch (error) {
      console.error('Download error:', error);
      message.error('下载失败');
    }
  };

  return (
    <>
      <motion.div
        className="fixed inset-0 z-50 bg-black/80"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={handleClose}
      />
      <div className="fixed inset-0 z-50 flex pointer-events-none">
        {/* Image area */}
        <div className="flex flex-1 flex-col">
          <div
            className="flex flex-1 items-center justify-center overflow-hidden pointer-events-auto"
            onWheel={handleWheel}
          >
            <motion.img
              layoutId={`img-${image.id}`}
              src={getImageUrl(image)}
              alt={image.hash}
              className="max-h-full max-w-full object-contain"
              style={{ borderRadius: 0 }}
              animate={{ scale, rotate: rotation }}
              transition={{
                layout: { type: 'spring', damping: 30, stiffness: 300 },
                scale: { duration: 0.1, ease: 'easeOut' },
                rotate: { duration: 0.1, ease: 'easeOut' },
              }}
            />
          </div>

          {/* Toolbar */}
          <motion.div
            className="flex items-center justify-center gap-2 border-t border-gray-100 bg-white px-4 py-3 pointer-events-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2, delay: 0.1 }}
          >
            <Space>
              <Tooltip title="放大 (Ctrl++ / 滚轮上)">
                <Button icon={<ZoomInOutlined />} onClick={handleZoomIn} disabled={scale >= 5} />
              </Tooltip>
              <Tooltip title="缩小 (Ctrl+- / 滚轮下)">
                <Button
                  icon={<ZoomOutOutlined />}
                  onClick={handleZoomOut}
                  disabled={scale <= 0.1}
                />
              </Tooltip>
              <Tooltip title={`缩放: ${scale.toFixed(1)}x`}>
                <span style={{ minWidth: '60px', textAlign: 'center' }}>{scale.toFixed(1)}x</span>
              </Tooltip>
              <span style={{ borderLeft: '1px solid #d9d9d9', height: '24px' }} />
              <Tooltip title="向左旋转">
                <Button icon={<RotateLeftOutlined />} onClick={handleRotateLeft} />
              </Tooltip>
              <Tooltip title="向右旋转">
                <Button icon={<RotateRightOutlined />} onClick={handleRotateRight} />
              </Tooltip>
              <span style={{ borderLeft: '1px solid #d9d9d9', height: '24px' }} />
              <Tooltip title="复制图片">
                <Button icon={<CopyOutlined />} onClick={handleCopy} />
              </Tooltip>
              <Tooltip title="下载">
                <Button icon={<DownloadOutlined />} onClick={handleDownload} />
              </Tooltip>
              <Tooltip title="打开文件夹">
                <Button icon={<FolderOutlined />} />
              </Tooltip>
            </Space>
          </motion.div>
        </div>

        {/* Metadata panel */}
        <motion.div
          className="flex w-[320px] flex-col gap-4 overflow-y-auto bg-white py-4 pr-2 pointer-events-auto"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 40 }}
          transition={{ duration: 0.2, delay: 0.1 }}
        >
          <div className="px-4">
            <h4 className="mb-3 text-sm font-semibold">基本信息</h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1 text-xs">
                <span className="font-medium text-gray-500">格式:</span>
                <span>{image.format.toUpperCase()}</span>
              </div>
              <div className="flex flex-col gap-1 text-xs">
                <span className="font-medium text-gray-500">大小:</span>
                <span>{formatFileSize(image.fileSize)}</span>
              </div>
              {image.width && image.height && (
                <>
                  <div className="flex flex-col gap-1 text-xs">
                    <span className="font-medium text-gray-500">宽度:</span>
                    <span>{image.width}px</span>
                  </div>
                  <div className="flex flex-col gap-1 text-xs">
                    <span className="font-medium text-gray-500">高度:</span>
                    <span>{image.height}px</span>
                  </div>
                  <div className="flex flex-col gap-1 text-xs">
                    <span className="font-medium text-gray-500">像素数:</span>
                    <span>{(image.width * image.height).toLocaleString()}</span>
                  </div>
                  <div className="flex flex-col gap-1 text-xs">
                    <span className="font-medium text-gray-500">宽高比:</span>
                    <span>{image.ratio?.toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="px-4">
            <h4 className="mb-3 text-sm font-semibold">时间信息</h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1 text-xs">
                <span className="font-medium text-gray-500">修改时间:</span>
                <span>{image.fileTime ? formatDate(new Date(image.fileTime)) : '-'}</span>
              </div>
              <div className="flex flex-col gap-1 text-xs">
                <span className="font-medium text-gray-500">创建时间:</span>
                <span>{formatDate(new Date(image.createdAt))}</span>
              </div>
            </div>
          </div>

          <div className="px-4">
            <h4 className="mb-3 text-sm font-semibold">文件信息</h4>
            <div className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-gray-500">哈希:</span>
              <span className="break-all font-mono text-blue-500">{image.hash}</span>
            </div>
            <div className="mt-2 flex flex-col gap-1 text-xs">
              <span className="font-medium text-gray-500">路径:</span>
              <span className="break-all font-mono text-blue-500" title={image.filePath}>
                {image.filePath}
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
};
