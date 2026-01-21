import React from 'react';
import { Button, Select, Slider, Tooltip, Tag, Popover, Progress } from 'antd';
import {
    SortAscendingOutlined,
    SortDescendingOutlined,
    FilterOutlined,
    CalendarOutlined,
    ColumnWidthOutlined,
    SearchOutlined,
    SettingOutlined,
    CloseCircleFilled
} from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { setSortField, setSortOrder } from '../../store/slices/imageSlice';
import { resetFilters } from '../../store/slices/filterSlice';
import { FilterPanel } from './FilterPanel';

interface MonthData {
    yearMonth: string;
    count: number;
}

interface TopFilterBarProps {
    months: MonthData[];
    currentMonth: string | null;
    onMonthSelect: (month: string) => void;
    onDeleteMonth: (yearMonth: string) => void;
    columnCount: number;
    onColumnCountChange: (count: number) => void;
    scanning: boolean;
    scanProgress: any;
    onScan: () => void;
    onOpenSettings: () => void;
}

export const TopFilterBar: React.FC<TopFilterBarProps> = ({
    months,
    currentMonth,
    onMonthSelect,
    onDeleteMonth,
    columnCount,
    onColumnCountChange,
    scanning,
    scanProgress,
    onScan,
    onOpenSettings
}) => {
    const dispatch = useDispatch();
    const { sortField, sortOrder, images } = useSelector((state: RootState) => state.images);
    const filters = useSelector((state: RootState) => state.filters);

    const activeFiltersCount = filters.selectedCategories.length +
        (filters.sizeRange[0] !== 0 || filters.sizeRange[1] !== Infinity ? 1 : 0);

    const dragStyle = { WebkitAppRegion: 'drag' } as React.CSSProperties;
    const noDragStyle = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;

    return (
        <div
            className="sticky top-0 z-50 border-b border-gray-100 bg-gradient-to-b from-white to-gray-50/80 shadow-sm backdrop-blur-xl"
            style={dragStyle}
        >
            {/* Title Bar */}
            <div className="absolute left-0 right-0 top-1.5 z-[101] pointer-events-none select-none text-center text-[13px] font-semibold text-gray-700 tracking-wide">
                QQ 缓存图片查看器
            </div>

            <div className="px-5 pb-4 pt-8">
                {/* Row 1: Scan Button & Month Selection */}
                <div className="mb-3 flex items-center gap-3" style={noDragStyle}>
                    {/* Scan Action */}
                    <div className="flex items-center gap-2 rounded-lg border border-gray-200/80 bg-white px-3 py-1.5 shadow-sm">
                        {scanning ? (
                            <Progress
                                type="circle"
                                percent={scanProgress?.percent || 0}
                                size={20}
                                strokeWidth={12}
                                showInfo={false}
                            />
                        ) : (
                            <Button
                                shape="circle"
                                icon={<SearchOutlined />}
                                onClick={onScan}
                                size="small"
                                type="text"
                                className="hover:bg-blue-50"
                            />
                        )}
                        <span className="text-xs font-medium text-gray-600">扫描</span>
                    </div>

                    {/* Month Tags */}
                    <div className="flex flex-1 items-center gap-2 overflow-x-auto rounded-lg border border-gray-200/80 bg-white px-3 py-1.5 shadow-sm scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                        <CalendarOutlined className="text-gray-400 flex-shrink-0" />
                        <Tag
                            color={currentMonth === '' || currentMonth === null ? 'blue' : undefined}
                            onClick={() => onMonthSelect('')}
                            className="cursor-pointer transition-all hover:scale-105"
                            style={{
                                borderRadius: '6px',
                                fontWeight: currentMonth === '' || currentMonth === null ? 600 : 400,
                                border: currentMonth === '' || currentMonth === null ? undefined : '1px solid #e5e7eb'
                            }}
                        >
                            全部
                        </Tag>
                        {months.map(month => (
                            <span
                                key={month.yearMonth}
                                className="group/month relative inline-flex"
                            >
                                <Tag
                                    color={currentMonth === month.yearMonth ? 'blue' : undefined}
                                    className="cursor-pointer transition-all hover:scale-105"
                                    onClick={() => onMonthSelect(month.yearMonth === currentMonth ? '' : month.yearMonth)}
                                    style={{
                                        borderRadius: '6px',
                                        fontWeight: currentMonth === month.yearMonth ? 600 : 400,
                                        border: currentMonth === month.yearMonth ? undefined : '1px solid #e5e7eb',
                                        paddingRight: '20px'
                                    }}
                                >
                                    {month.yearMonth} <span className="text-gray-500">({month.count})</span>
                                </Tag>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteMonth(month.yearMonth);
                                    }}
                                    className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover/month:opacity-100 text-red-500 hover:text-red-700 bg-transparent border-0 cursor-pointer p-0"
                                    title={`删除 ${month.yearMonth} 全部图片`}
                                >
                                    <CloseCircleFilled style={{ fontSize: 14 }} />
                                </button>
                            </span>
                        ))}
                    </div>

                    {/* Image Count Badge */}
                    <div className="flex items-center gap-1.5 rounded-lg border border-gray-200/80 bg-white px-3 py-1.5 shadow-sm">
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                        <span className="text-xs font-semibold text-gray-700">{images.length}</span>
                        <span className="text-xs text-gray-500">张</span>
                    </div>
                </div>

                {/* Row 2: Filter & View Controls */}
                <div className="flex items-center justify-between gap-3" style={noDragStyle}>
                    {/* Left: Sort & Filter Controls */}
                    <div className="flex items-center gap-2">
                        {/* Sort Section */}
                        <div className="flex items-center gap-1.5 rounded-lg border border-gray-200/80 bg-white px-3 py-1 shadow-sm">
                            <span className="text-xs font-medium text-gray-500">排序</span>
                            <Select
                                value={sortField}
                                onChange={(val) => dispatch(setSortField(val))}
                                size="small"
                                style={{ width: 90 }}
                                options={[
                                    { label: '时间', value: 'file_time' },
                                    { label: '大小', value: 'size' },
                                    { label: '像素', value: 'pixels' },
                                ]}
                                variant="borderless"
                                className="text-xs"
                            />
                            <Tooltip title={sortOrder === 'asc' ? '升序' : '降序'}>
                                <Button
                                    type="text"
                                    size="small"
                                    icon={sortOrder === 'asc' ? <SortAscendingOutlined /> : <SortDescendingOutlined />}
                                    onClick={() => dispatch(setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'))}
                                    className="hover:bg-blue-50"
                                />
                            </Tooltip>
                        </div>

                        {/* Filter Section */}
                        <Popover content={<FilterPanel />} trigger="click" placement="bottomLeft">
                            <Button
                                size="small"
                                icon={<FilterOutlined />}
                                type={activeFiltersCount > 0 ? 'primary' : 'default'}
                                className={activeFiltersCount > 0 ? 'shadow-sm' : 'border-gray-200/80'}
                            >
                                筛选 {activeFiltersCount > 0 && <span className="ml-1 rounded-full bg-white/30 px-1.5 text-xs">{activeFiltersCount}</span>}
                            </Button>
                        </Popover>

                        {/* Reset Button */}
                        {(activeFiltersCount > 0 || sortField !== 'file_time') && (
                            <Button
                                size="small"
                                type="link"
                                onClick={() => {
                                    dispatch(resetFilters());
                                    dispatch(setSortField('file_time'));
                                    dispatch(setSortOrder('desc'));
                                }}
                                className="text-xs"
                            >
                                重置
                            </Button>
                        )}
                    </div>

                    {/* Right: View Settings */}
                    <div className="flex items-center gap-2">
                        {/* Column Slider */}
                        <div className="flex items-center gap-2 rounded-lg border border-gray-200/80 bg-white px-3 py-1 shadow-sm">
                            <ColumnWidthOutlined className="text-gray-400 text-sm" />
                            <Slider
                                min={4}
                                max={10}
                                value={columnCount}
                                onChange={onColumnCountChange}
                                style={{ width: 90, margin: 0 }}
                                tooltip={{ formatter: val => `${val}列` }}
                            />
                        </div>

                        {/* Settings Button */}
                        <Button
                            icon={<SettingOutlined />}
                            onClick={onOpenSettings}
                            title="设置"
                            size="small"
                            className="border-gray-200/80"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
