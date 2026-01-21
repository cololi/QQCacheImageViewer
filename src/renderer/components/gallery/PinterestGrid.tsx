import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import { Button, message, Tooltip } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { Image } from '../../../shared/types';
import { getImageUrl } from '../../utils/imageUtils';


interface PinterestGridProps {
    images: Image[];
    onImageSelect?: (image: Image) => void;
    previewingImageId?: number | null;
    selectedIds: number[];
    onSelectionChange: (ids: number[]) => void;
}

/**
 * Pinterest 风格的瀑布流布局组件
 * 使用纯 CSS 列布局实现瀑布流效果
 */
export const PinterestGrid: React.FC<PinterestGridProps & { columnCount?: number }> = ({
    images,
    onImageSelect,
    previewingImageId,
    selectedIds,
    onSelectionChange,
    columnCount,
}) => {
    const [autoColumns, setAutoColumns] = useState(4);
    const containerRef = useRef<HTMLDivElement>(null);
    const lastSelectedIdRef = useRef<number | null>(null);

    // Spec: lastSelectedId resets to null when selectedIds is cleared.
    // Otherwise Shift+click after a clear would draw a range from a stale anchor.
    useEffect(() => {
        if (selectedIds.length === 0) {
            lastSelectedIdRef.current = null;
        }
    }, [selectedIds]);

    const [rubberBand, setRubberBand] = useState<{
        startX: number;
        startY: number;
        endX: number;
        endY: number;
    } | null>(null);
    const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

    // 根据容器宽度动态调整列数
    useEffect(() => {
        if (columnCount) return; // 如果指定了列数，不需要自动调整

        const updateColumns = () => {
            if (containerRef.current) {
                const width = containerRef.current.clientWidth;
                if (width < 600) setAutoColumns(2);
                else if (width < 900) setAutoColumns(3);
                else if (width < 1200) setAutoColumns(4);
                else setAutoColumns(5);
            }
        };

        updateColumns();
        window.addEventListener('resize', updateColumns);
        return () => window.removeEventListener('resize', updateColumns);
    }, [columnCount]);

    const columns = columnCount || autoColumns;

    const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
    const isSelectionMode = selectedIdSet.size > 0;

    const toggleId = (id: number) => {
        const set = new Set(selectedIds);
        if (set.has(id)) set.delete(id);
        else set.add(id);
        onSelectionChange(Array.from(set));
    };

    const rangeSelect = (toId: number) => {
        const fromId = lastSelectedIdRef.current;
        if (fromId == null) {
            onSelectionChange([toId]);
            lastSelectedIdRef.current = toId;
            return;
        }
        const fromIdx = images.findIndex((img) => img.id === fromId);
        const toIdx = images.findIndex((img) => img.id === toId);
        if (fromIdx === -1 || toIdx === -1) {
            onSelectionChange([toId]);
            lastSelectedIdRef.current = toId;
            return;
        }
        const [lo, hi] = fromIdx <= toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
        const rangeIds = images.slice(lo, hi + 1).map((img) => img.id);
        const merged = new Set([...selectedIds, ...rangeIds]);
        onSelectionChange(Array.from(merged));
    };

    const handleCardClick = (e: React.MouseEvent, image: Image) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            toggleId(image.id);
            lastSelectedIdRef.current = image.id;
            return;
        }
        if (e.shiftKey) {
            e.preventDefault();
            rangeSelect(image.id);
            lastSelectedIdRef.current = image.id;
            return;
        }
        if (isSelectionMode) {
            toggleId(image.id);
            lastSelectedIdRef.current = image.id;
            return;
        }
        onImageSelect?.(image);
    };

    const handleContainerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.button !== 0) return; // 仅左键
        const target = e.target as HTMLElement;
        // 仅在网格空白起手；命中 motion.img / 复选框 / button 时跳过（由卡片 onClick 处理）
        if (target.closest('[data-grid-image],button,[data-checkbox]')) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const startX = e.clientX - rect.left + e.currentTarget.scrollLeft;
        const startY = e.clientY - rect.top + e.currentTarget.scrollTop;
        setRubberBand({ startX, startY, endX: startX, endY: startY });
    };

    const handleContainerMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!rubberBand) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const endX = e.clientX - rect.left + e.currentTarget.scrollLeft;
        const endY = e.clientY - rect.top + e.currentTarget.scrollTop;
        setRubberBand({ ...rubberBand, endX, endY });
    };

    const handleContainerMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!rubberBand) return;
        const containerRect = e.currentTarget.getBoundingClientRect();
        const scrollTop = e.currentTarget.scrollTop;
        const scrollLeft = e.currentTarget.scrollLeft;

        const minX = Math.min(rubberBand.startX, rubberBand.endX);
        const maxX = Math.max(rubberBand.startX, rubberBand.endX);
        const minY = Math.min(rubberBand.startY, rubberBand.endY);
        const maxY = Math.max(rubberBand.startY, rubberBand.endY);

        const hitIds: number[] = [];
        itemRefs.current.forEach((el, id) => {
            const r = el.getBoundingClientRect();
            const itemLeft = r.left - containerRect.left + scrollLeft;
            const itemTop = r.top - containerRect.top + scrollTop;
            const itemRight = itemLeft + r.width;
            const itemBottom = itemTop + r.height;
            const intersects = !(itemRight < minX || itemLeft > maxX || itemBottom < minY || itemTop > maxY);
            if (intersects) hitIds.push(id);
        });

        // 仅在矩形拖出"明显"区域时才视为框选；< 5px 视为单击，留给 onClick
        const dragged = Math.abs(rubberBand.endX - rubberBand.startX) > 5 || Math.abs(rubberBand.endY - rubberBand.startY) > 5;
        if (dragged) {
            // 追加（保留已选）
            const merged = new Set([...selectedIds, ...hitIds]);
            onSelectionChange(Array.from(merged));
        }
        setRubberBand(null);
    };

    const handleDownload = async (e: React.MouseEvent, image: Image) => {
        e.stopPropagation();
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
        <div
            className="h-full w-full overflow-y-auto relative select-none"
            ref={containerRef}
            onMouseDown={handleContainerMouseDown}
            onMouseMove={handleContainerMouseMove}
            onMouseUp={handleContainerMouseUp}
            onMouseLeave={() => setRubberBand(null)}
        >
            {rubberBand && (
                <div
                    className="absolute pointer-events-none border border-blue-500 bg-blue-500/10 z-30"
                    style={{
                        left: Math.min(rubberBand.startX, rubberBand.endX),
                        top: Math.min(rubberBand.startY, rubberBand.endY),
                        width: Math.abs(rubberBand.endX - rubberBand.startX),
                        height: Math.abs(rubberBand.endY - rubberBand.startY),
                    }}
                />
            )}
            <div
                className="gap-4 p-0"
                style={{ columnCount: columns }}
            >
                {images.map((image) => (
                    <GridCard
                        key={image.id}
                        image={image}
                        isSelected={selectedIdSet.has(image.id)}
                        isPreviewing={previewingImageId === image.id}
                        onCardClick={handleCardClick}
                        onToggle={toggleId}
                        onDownload={handleDownload}
                        onSetRef={(id, el) => {
                            if (el) itemRefs.current.set(id, el);
                            else itemRefs.current.delete(id);
                        }}
                        lastSelectedIdRef={lastSelectedIdRef}
                    />
                ))}
            </div>
        </div>
    );
};

interface GridCardProps {
    image: Image;
    isSelected: boolean;
    isPreviewing: boolean;
    onCardClick: (e: React.MouseEvent, image: Image) => void;
    onToggle: (id: number) => void;
    onDownload: (e: React.MouseEvent, image: Image) => void;
    onSetRef: (id: number, el: HTMLDivElement | null) => void;
    lastSelectedIdRef: React.MutableRefObject<number | null>;
}

const GridCard = memo<GridCardProps>(({ image, isSelected, isPreviewing, onCardClick, onToggle, onDownload, onSetRef, lastSelectedIdRef }) => {
    return (
        <div
            ref={(el) => onSetRef(image.id, el)}
            className="group relative mb-4 break-inside-avoid cursor-pointer overflow-hidden rounded-lg bg-white transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
            style={{ opacity: isPreviewing ? 0 : 1 }}
            onClick={(e) => onCardClick(e, image)}
        >
            <img
                src={getImageUrl(image)}
                alt=""
                data-grid-image
                className="block h-auto w-full object-cover"
                loading="lazy"
                decoding="async"
                style={{ borderRadius: '8px' }}
            />
            <div
                data-checkbox
                className={`absolute top-2 left-2 z-20 flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                    isSelected
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300 bg-white/40'
                }`}
                onClick={(e) => {
                    e.stopPropagation();
                    onToggle(image.id);
                    lastSelectedIdRef.current = image.id;
                }}
            >
                {isSelected && (
                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                )}
            </div>
            <div className="absolute bottom-2 right-2 z-10 scale-90 opacity-0 bg-white/90 shadow-sm transition-all duration-200 group-hover:scale-100 group-hover:opacity-100 hover:!scale-110 hover:!bg-white rounded-full">
                <Tooltip title="快速保存">
                    <Button
                        type="text"
                        shape="circle"
                        icon={<DownloadOutlined />}
                        size="small"
                        onClick={(e) => onDownload(e, image)}
                    />
                </Tooltip>
            </div>
        </div>
    );
});
