import React from 'react';
import { Tag } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { setSelectedCategories, setSizeRange } from '../../store/slices/filterSlice';
import { PictureOutlined, FileOutlined } from '@ant-design/icons';

export const FilterPanel: React.FC = () => {
    const dispatch = useDispatch();
    const filters = useSelector((state: RootState) => state.filters);

    // Helper for size range active state check
    const isSizeActive = (min: number, max: number) => {
        return filters.sizeRange[0] === min && filters.sizeRange[1] === max;
    };

    const handleSizeChange = (min: number, max: number) => {
        if (isSizeActive(min, max)) {
            dispatch(setSizeRange([0, Infinity])); // Toggle off
        } else {
            dispatch(setSizeRange([min, max]));
        }
    };

    const handleCategoryToggle = (cat: string) => {
        const current = filters.selectedCategories;
        if (current.includes(cat)) {
            dispatch(setSelectedCategories(current.filter(c => c !== cat)));
        } else {
            dispatch(setSelectedCategories([...current, cat]));
        }
    };

    return (
        <div className="w-72 rounded-xl bg-gradient-to-br from-white to-gray-50 p-4 shadow-lg">
            {/* 图片类型筛选 */}
            <div className="mb-5">
                <div className="mb-3 flex items-center gap-2">
                    <PictureOutlined className="text-blue-500" />
                    <span className="text-sm font-semibold text-gray-700">图片类型</span>
                </div>
                <div className="flex flex-wrap gap-2">
                    {['portrait', 'landscape', 'square'].map(type => (
                        <Tag.CheckableTag
                            key={type}
                            checked={filters.selectedCategories.includes(type)}
                            onChange={() => handleCategoryToggle(type)}
                            className="rounded-lg border-2 px-4 py-1.5 text-sm font-medium transition-all hover:scale-105"
                            style={{
                                borderColor: filters.selectedCategories.includes(type) ? '#3b82f6' : '#e5e7eb',
                                backgroundColor: filters.selectedCategories.includes(type) ? '#dbeafe' : 'white',
                                color: filters.selectedCategories.includes(type) ? '#1e40af' : '#6b7280'
                            }}
                        >
                            {{ portrait: '📱 竖图', landscape: '🖼️ 横图', square: '⬜ 方图' }[type]}
                        </Tag.CheckableTag>
                    ))}
                </div>
            </div>

            {/* 分隔线 */}
            <div className="my-4 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

            {/* 文件大小筛选 */}
            <div>
                <div className="mb-3 flex items-center gap-2">
                    <FileOutlined className="text-green-500" />
                    <span className="text-sm font-semibold text-gray-700">文件大小</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {[
                        { label: '< 100KB', min: 0, max: 100 * 1024 },
                        { label: '100KB - 1MB', min: 100 * 1024, max: 1024 * 1024 },
                        { label: '1MB - 5MB', min: 1024 * 1024, max: 5 * 1024 * 1024 },
                        { label: '> 5MB', min: 5 * 1024 * 1024, max: Infinity }
                    ].map(({ label, min, max }) => (
                        <Tag.CheckableTag
                            key={label}
                            checked={isSizeActive(min, max)}
                            onChange={() => handleSizeChange(min, max)}
                            className="rounded-lg border-2 px-3 py-2 text-center text-xs font-medium transition-all hover:scale-105"
                            style={{
                                borderColor: isSizeActive(min, max) ? '#10b981' : '#e5e7eb',
                                backgroundColor: isSizeActive(min, max) ? '#d1fae5' : 'white',
                                color: isSizeActive(min, max) ? '#065f46' : '#6b7280'
                            }}
                        >
                            {label}
                        </Tag.CheckableTag>
                    ))}
                </div>
            </div>
        </div>
    );
};
