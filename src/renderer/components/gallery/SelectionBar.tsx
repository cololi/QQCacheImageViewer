import React from 'react';
import { Button } from 'antd';
import { DeleteOutlined, CloseOutlined, CheckSquareOutlined } from '@ant-design/icons';

interface SelectionBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDelete: () => void;
  onClear: () => void;
}

/**
 * Floating bottom bar shown whenever selectedIds is non-empty.
 * fixed positioning so it overlays the grid without affecting layout.
 */
export const SelectionBar: React.FC<SelectionBarProps> = ({
  selectedCount,
  totalCount,
  onSelectAll,
  onDelete,
  onClear,
}) => {
  return (
    <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 transform">
      <div className="flex items-center gap-3 rounded-full bg-gray-900/95 px-5 py-2.5 text-white shadow-lg backdrop-blur">
        <span className="text-sm">
          已选 <span className="font-semibold text-blue-300">{selectedCount}</span> 张
        </span>
        <span className="h-5 w-px bg-white/20" />
        <Button
          type="text"
          size="small"
          icon={<CheckSquareOutlined />}
          onClick={onSelectAll}
          className="!text-white hover:!bg-white/10"
          disabled={selectedCount === totalCount}
        >
          全选
        </Button>
        <Button
          type="text"
          size="small"
          icon={<DeleteOutlined />}
          onClick={onDelete}
          className="!text-red-400 hover:!bg-red-500/20"
        >
          删除
        </Button>
        <Button
          type="text"
          size="small"
          shape="circle"
          icon={<CloseOutlined />}
          onClick={onClear}
          className="!text-white hover:!bg-white/10"
        />
      </div>
    </div>
  );
};
