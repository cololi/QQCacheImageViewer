import React from 'react';
import { Empty, Spin } from 'antd';
import { Image } from '../../../shared/types';
import { PinterestGrid } from './PinterestGrid';
import { SelectionBar } from './SelectionBar';


interface ImageViewsProps {
  images: Image[];
  loading: boolean;
  onImageSelect?: (image: Image) => void;
  columnCount?: number;
  previewingImageId?: number | null;
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
  onDeleteSelected: () => void;
}

/**
 * ImageViews 组件使用 Pinterest 瀑布流布局展示图片
 */
export const ImageViews: React.FC<ImageViewsProps> = ({
  images,
  loading,
  onImageSelect,
  columnCount,
  previewingImageId,
  selectedIds,
  onSelectionChange,
  onDeleteSelected,
}) => {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Spin size="large" />
          </div>
        ) : images.length === 0 ? (
          <Empty description="暂无图片" />
        ) : (
          <PinterestGrid
            images={images}
            onImageSelect={onImageSelect}
            columnCount={columnCount}
            previewingImageId={previewingImageId}
            selectedIds={selectedIds}
            onSelectionChange={onSelectionChange}
          />
        )}
      </div>
      {selectedIds.length > 0 && (
        <SelectionBar
          selectedCount={selectedIds.length}
          totalCount={images.length}
          onSelectAll={() => onSelectionChange(images.map((img) => img.id))}
          onDelete={onDeleteSelected}
          onClear={() => onSelectionChange([])}
        />
      )}
    </div>
  );
};
