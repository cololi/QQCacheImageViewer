import React, { useState, useEffect, useRef } from 'react';
import { Button, message, Tooltip } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { Image } from '../../../shared/types';
import { getImageUrl } from '../../utils/imageUtils';


interface PinterestGridProps {
    images: Image[];
    onImageSelect?: (image: Image) => void;
}

/**
 * Pinterest 风格的瀑布流布局组件
 * 使用纯 CSS 列布局实现瀑布流效果
 */
export const PinterestGrid: React.FC<PinterestGridProps & { columnCount?: number }> = ({
    images,
    onImageSelect,
    columnCount,
}) => {
    const [autoColumns, setAutoColumns] = useState(4);
    const containerRef = useRef<HTMLDivElement>(null);

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

    const handleDownload = async (e: React.MouseEvent, image: Image) => {
        e.stopPropagation(); // Prevent opening the image preview
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
        <div className="h-full w-full overflow-y-auto" ref={containerRef}>
            <div
                className="gap-4 p-0"
                style={{ columnCount: columns }}
            >
                {images.map((image) => (
                    <div
                        key={image.id}
                        className="group relative mb-4 break-inside-avoid cursor-pointer overflow-hidden rounded-lg bg-white transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
                        onClick={() => onImageSelect?.(image)}
                    >
                        <img
                            src={getImageUrl(image)}
                            alt=""
                            className="block h-auto w-full object-cover"
                            loading="lazy"
                        />
                        <div className="absolute bottom-2 right-2 z-10 scale-90 opacity-0 bg-white/90 shadow-sm transition-all duration-200 group-hover:scale-100 group-hover:opacity-100 hover:!scale-110 hover:!bg-white rounded-full">
                            <Tooltip title="快速保存">
                                <Button
                                    type="text"
                                    shape="circle"
                                    icon={<DownloadOutlined />}
                                    size="small"
                                    onClick={(e) => handleDownload(e, image)}
                                />
                            </Tooltip>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
