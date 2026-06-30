# 删除月份 & 框选批量删除 — 设计文档

**日期:** 2026-05-10  
**状态:** 已批准，待实现

---

## 背景

QQ 缓存图片查看器当前支持查看图片、按月筛选、下载单张图片，但缺少删除能力。需要新增两个删除功能：

1. **删除某一个月的全部图片**
2. **框选大量图片并批量删除**

---

## 决策汇总

| 维度               | 决策                                                |
| ------------------ | --------------------------------------------------- |
| 月份删除触发方式   | 悬停月份标签 → 右侧出现红色 × 按钮                  |
| 删除文件行为       | 永久删除（`fs.unlink`），不经回收站                 |
| 多选触发方式       | 拖拽橡皮筋框选 + 直接点击图片进入多选模式，两者均可 |
| 多选模式下点击图片 | 选中/取消选中（不打开预览）                         |
| 选中后操作入口     | 底部浮动操作栏（fixed 定位）                        |
| 退出多选           | Escape 键或操作栏 ✕ 按钮                            |

---

## 功能一：删除某月

### 交互流程

1. 鼠标悬停月份标签 → 标签右侧出现红色 × 按钮（仅悬停时可见，CSS `opacity` 切换）
2. 点击 × → 弹出 Ant Design `Modal.confirm`，显示月份名称和图片数量
3. 确认 → 调用 `deleteMonthImages(yearMonth)` → 永久删除文件 → 从数据库移除记录 → 刷新月份列表和当前图片列表
4. 取消 → 关闭弹窗，无操作

### 确认弹窗文案

```
⚠️ 确认删除

将永久删除 {yearMonth} 的全部 {count} 张图片文件，此操作不可撤销。

[取消]  [删除 {count} 张]
```

### 边界情况

- 若当前正在浏览该月，删除后切换到"全部"视图
- 删除后若月份列表为空，显示空状态

---

## 功能二：框选批量删除

### 交互流程

**方式一：拖拽框选**

1. 在图片网格空白处按住鼠标左键
2. 拖拽出蓝色半透明矩形（橡皮筋）
3. 松开鼠标：所有与矩形相交的图片被选中，进入多选模式

**方式二：点击进入多选**

1. 直接点击任意图片（正常模式下）→ 进入多选模式，该图片被选中
2. 继续点击其他图片 → 追加选中 / 取消选中

**多选模式行为**

- 每张图片左上角显示复选框角标（已选：蓝色勾；未选：灰色空框）
- 点击图片 = 切换选中状态（不触发预览）
- Shift + 点击 → 范围选择（从上次点击到当前）
- Escape 键 → 清空选择，退出多选模式，恢复正常点击行为

### 底部浮动操作栏（SelectionBar）

当 `selectedIds.length > 0` 时渲染，fixed 定位于页面底部居中。

```
[  已选 {n} 张   全选   🗑 删除   ✕  ]
```

- **全选**：选中当前 `filteredImages` 中全部图片
- **删除**：弹出确认弹窗，确认后永久删除已选图片文件 + 从数据库移除
- **✕**：清空选择，隐藏操作栏

### 删除确认弹窗文案

```
⚠️ 确认删除

将永久删除已选的 {n} 张图片，此操作不可撤销。

[取消]  [删除 {n} 张]
```

### 橡皮筋框选实现要点

- 在 `PinterestGrid` 容器上监听 `onMouseDown`（需排除图片元素自身的点击）
- 用 `useState` 维护框选矩形 `{ startX, startY, endX, endY }`，`onMouseMove` 更新
- `onMouseUp` 时遍历所有图片 DOM 节点（通过 `ref` 数组），用 `getBoundingClientRect()` 判断是否与框选矩形相交
- 框选矩形用绝对定位 `div` 渲染，`pointer-events: none`，`z-index` 高于图片
- 需处理滚动偏移：使用 `scrollTop` 修正坐标

---

## 数据层变更

### db-service.ts（新增）

```ts
deleteImages(ids: number[]): { filePaths: string[] }
// SELECT file_path FROM images WHERE id IN (...)
// DELETE FROM images WHERE id IN (...)
// 返回被删除的文件路径列表（供 file-service 删除物理文件）

deleteImagesByMonth(yearMonth: string): { filePaths: string[] }
// SELECT file_path FROM images WHERE strftime('%Y-%m', file_time) = ?
// DELETE FROM images WHERE strftime('%Y-%m', file_time) = ?
// 返回被删除的文件路径列表（供 file-service 删除物理文件）
```

### file-service.ts（新增）

```ts
deleteFilesPermanently(filePaths: string[]): Promise<{ deleted: number; failed: number }>
// 用 fs.unlink 逐一删除，记录失败项
```

### IPC handlers（main/index.ts 新增）

```ts
ipcMain.handle('delete-images', async (_event, ids: number[]) => { ... })
ipcMain.handle('delete-month-images', async (_event, yearMonth: string) => { ... })
```

两个 handler 均：先从 DB 取文件路径 → 永久删除文件 → 删除 DB 记录 → 返回结果。

### useImageAPI.ts（新增）

```ts
deleteImages(ids: number[]): Promise<{ success: boolean; deleted: number }>
deleteMonthImages(yearMonth: string): Promise<{ success: boolean; deleted: number }>
```

### imageSlice.ts（新增 action）

```ts
removeImages(state, action: PayloadAction<number[]>)
// 从 state.images 中过滤掉已删除的 id
// 同时清空 selectedIds

setSelectedIds(state, action: PayloadAction<number[]>)
// 直接替换整个 selectedIds 数组（用于框选结果写入）
```

---

## 组件变更

### 新建：SelectionBar.tsx

```
src/renderer/components/gallery/SelectionBar.tsx
```

- Props: `selectedCount`, `totalCount`, `onSelectAll`, `onDelete`, `onClear`
- `selectedIds.length > 0` 时由 `ImageViews` 渲染
- fixed 定位，bottom: 24px，居中，深色胶囊样式

### PinterestGrid.tsx

新增 Props:

- `selectedIds: number[]`
- `onSelectionChange: (ids: number[]) => void`
- `isSelectionMode: boolean`

新增内部逻辑:

- 鼠标事件处理橡皮筋框选
- 图片点击在选择模式下切换 selection，普通模式下调用 `onImageSelect`
- 每张图片渲染复选框角标（选中/未选两种样式）

### ImageViews.tsx

- 接收 `selectedIds`, `onSelectionChange` 并下传给 `PinterestGrid`
- 渲染 `SelectionBar`（当有选中时）
- 处理删除回调：调用 `deleteImages` → dispatch `removeImages` → 更新月份计数

### TopFilterBar.tsx

- 月份 Tag 改为 `<span>` 组合（标签文字 + 条件渲染 × 按钮）
- 悬停状态由 `onMouseEnter/Leave` 控制，× 按钮 `opacity: 0 → 1` 过渡
- 点击 × 触发 `onDeleteMonth(yearMonth)` 回调，由 `App.tsx` 处理确认 + 删除逻辑

### App.tsx

- 新增 `handleDeleteMonth(yearMonth)` — Modal.confirm → deleteMonthImages → loadMonths → 若当前月被删则切换到全部
- 将 `selectedIds`, `onSelectionChange` 通过 `ImageViews` 传递链路打通

---

## 文件改动清单

| 文件                                                | 类型 | 改动内容                                        |
| --------------------------------------------------- | ---- | ----------------------------------------------- |
| `src/renderer/components/gallery/SelectionBar.tsx`  | 新建 | 浮动底部操作栏                                  |
| `src/renderer/components/gallery/PinterestGrid.tsx` | 修改 | 橡皮筋框选、复选框角标、选择模式点击行为        |
| `src/renderer/components/gallery/ImageViews.tsx`    | 修改 | 传入选择 props，挂载 SelectionBar               |
| `src/renderer/components/filters/TopFilterBar.tsx`  | 修改 | 月份标签悬停 × 按钮 + `onDeleteMonth` 回调      |
| `src/renderer/store/slices/imageSlice.ts`           | 修改 | 新增 `removeImages`, `setSelectedIds` actions   |
| `src/renderer/hooks/useImageAPI.ts`                 | 修改 | 新增 `deleteImages`, `deleteMonthImages`        |
| `src/main/services/db-service.ts`                   | 修改 | 新增 `deleteImages`, `deleteImagesByMonth`      |
| `src/main/services/file-service.ts`                 | 修改 | 新增 `deleteFilesPermanently`                   |
| `src/main/index.ts`                                 | 修改 | 注册 `delete-images`, `delete-month-images` IPC |
