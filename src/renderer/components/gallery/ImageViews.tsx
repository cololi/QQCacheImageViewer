import React from 'react';
import { Empty } from 'antd';
import { Image } from '../../../shared/types';
import { PinterestGrid } from './PinterestGrid';
import { SelectionBar } from './SelectionBar';

interface ImageViewsProps {
  images: Image[];
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
  onImageSelect,
  columnCount,
  previewingImageId,
  selectedIds,
  onSelectionChange,
  onDeleteSelected,
}) => {
  return (
    <div className="flex flex-col">
      <div className="flex-1">
        {images.length === 0 ? (
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
