import React, { useState } from 'react';
import { Modal, Image as AntImage, Button, Space, Tooltip, Spin, message } from 'antd';
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
  image: Image | null;
  open: boolean;
  onClose: () => void;
  loading?: boolean;
}

/**
 * ImagePreview modal provides fullscreen preview with zoom and rotation
 * Displays complete image metadata
 */
export const ImagePreview: React.FC<ImagePreviewProps> = ({
  image,
  open,
  onClose,
  loading = false,
}) => {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  if (!image) return null;

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.1, 5));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.1, 0.1));

  const handleWheel = (e: React.WheelEvent) => {
    // Zoom in when scrolling up (negative deltaY), zoom out when scrolling down
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  const handleRotateLeft = () => setRotation((prev) => (prev - 90 + 360) % 360);
  const handleRotateRight = () => setRotation((prev) => (prev + 90) % 360);

  const handleCopy = async () => {
    try {
      const url = getImageUrl(image);
      const response = await fetch(url);
      const blob = await response.blob();

      // Use the Clipboard API to write the image blob
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob,
        }),
      ]);

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
    <Modal
      title={image.hash}
      open={open}
      onCancel={onClose}
      width="90vw"
      style={{ maxWidth: '1400px', top: 20 }}
      footer={null}
      styles={{ body: { padding: 0, overflow: 'hidden', height: 'calc(90vh - 100px)' } }}
    >
      <Spin spinning={loading}>
        <div className="flex h-full gap-4 max-lg:flex-col" style={{ height: 'calc(90vh - 100px)' }}>
          {/* Image Viewer */}
          <div className="relative flex flex-1 flex-col overflow-hidden rounded bg-[#f5f5f5]">
            <div
              className="flex flex-1 items-center justify-center overflow-auto select-none"
              style={{
                transform: `scale(${scale}) rotate(${rotation}deg)`,
                transition: 'transform 0.1s ease-out', // Make transition faster for smoother wheel zoom
              }}
              onWheel={handleWheel}
            >
              <AntImage
                src={getImageUrl(image)}
                alt={image.hash}
                preview={false}
                className="max-h-full max-w-full object-contain"
              />
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-center gap-2 border-t border-gray-100 bg-white px-4 py-3">
              <Space>
                <Tooltip title="放大 (Ctrl++ / 滚轮上)">
                  <Button
                    icon={<ZoomInOutlined />}
                    onClick={handleZoomIn}
                    disabled={scale >= 5}
                  />
                </Tooltip>
                <Tooltip title="缩小 (Ctrl+- / 滚轮下)">
                  <Button
                    icon={<ZoomOutOutlined />}
                    onClick={handleZoomOut}
                    disabled={scale <= 0.1}
                  />
                </Tooltip>
                <Tooltip title={`缩放: ${scale.toFixed(1)}x`}>
                  <span style={{ minWidth: '60px', textAlign: 'center' }}>
                    {scale.toFixed(1)}x
                  </span>
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
            </div>
          </div>

          {/* Metadata Panel */}
          <div className="flex w-[320px] flex-col gap-4 overflow-y-auto py-4 pr-2 max-lg:max-h-[200px] max-lg:w-full max-lg:border-t max-lg:border-gray-100">
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
          </div>
        </div>
      </Spin>
    </Modal>
  );
};
