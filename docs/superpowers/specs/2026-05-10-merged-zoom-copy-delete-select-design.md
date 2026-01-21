# Apple Photos 动画 + 复制修复 + 删除/框选 — 合并设计文档

**日期：** 2026-05-10
**状态：** 待审批
**合并自：**
- `2026-05-10-apple-photos-zoom-copy-fix-design.md`（Spec A）
- `2026-05-10-delete-and-box-select-design.md`（Spec B）

---

## 背景

两份独立设计文档各自通过审批，均未实现。它们在 `PinterestGrid.tsx`、`ImageViews.tsx`、`App.tsx` 三个文件上有显著重叠，且在 PinterestGrid 单击行为上存在直接冲突。本文档把两者合并为一份统一设计，钉死所有冲突点，并给出单一实现路径，避免在两份独立 PR 中两次重写同一文件。

---

## 目标

1. 点击缩略图时，图片以 Apple Photos 风格从缩略图位置展开至全屏；关闭时动画反向缩回。
2. 图片查看器内默认 100%（fit-to-window），滚轮缩放保持不变。
3. 修复复制图片功能：JPEG / WebP 等格式转 PNG 后写入剪贴板。
4. 删除某一个月的全部图片（永久删除，不入回收站）。
5. 框选 + Ctrl/Cmd+click 多选 + 批量删除。
6. 单一一致的退出层次：ESC 优先级、单击/多选模式分流。

---

## 不在范围内

- 查看器内手势缩放（pinch-to-zoom）
- 切换上一张/下一张的手势
- 缩略图加载优化
- 删除操作的撤销 / 软删除 / 回收站

---

## 冲突决议表（合并的核心）

| # | 冲突点 | Spec A | Spec B | **合并决议** |
|---|--------|--------|--------|------------|
| 1 | PinterestGrid 普通单击 | 打开预览（layoutId 动画） | 进入多选 + 选中此张 | **打开预览**。多选仅通过 Ctrl/Cmd+click 或拖拽框选进入 |
| 2 | PinterestGrid 多选单击 | — | 切换该张选中 | **切换该张选中**（不预览）。ESC 退出多选后恢复单击=预览 |
| 3 | 状态命名 | `selectedImage` / `selectedImageId` | `selectedIds` / `setSelectedIds` | App.tsx 全量改名：**`previewingImage` / `previewingImageId`** vs **`selectedIds`**，消除任何 "selected" 二义 |
| 4 | ESC 键归属 | 关闭预览 | 退出多选 | **优先级**：preview 打开 → 关预览；否则 selectedIds.length>0 → 清空 selectedIds |
| 5 | 复选框 vs layoutId | — | 复选框角标在缩略图左上角 | 复选框是缩略图卡片内的**兄弟元素**，不进入 layoutId 共享元素层。`previewingImageId === image.id` 时整张卡片（image + 复选框）一起 `opacity: 0` |
| 6 | 在缩略图上 mousedown | layoutId 仅做点击 | 不启动橡皮筋（橡皮筋仅在空白处） | 鼠标事件路由：mousedown 落在 `<motion.img>` 上 → 走点击/Ctrl/Shift 分支；落在网格空白 → 启动橡皮筋 |
| 7 | 缩略图 hover | 无 | 月份 × 按钮的悬停依据（仅 TopFilterBar） | 月份 × 仅在 TopFilterBar 月份 tag 上做 hover；图片 hover 不触发 UI（复选框始终可见） |
| 8 | 删除当前预览中的图 | — | 未提 | 若 `previewingImage.id ∈ selectedIds` 且执行删除：**先关闭预览（触发 exit 动画到原坐标，但缩略图已经消失）→ 删除完成后 selectedIds 清空**。已知妥协：图片 exit 动画会飞向"已不存在的"格子，视觉上略突兀，但维持一致性 |

---

## 状态约定

- `previewingImage: ImageItem | null` — 被预览的图（替代旧 `selectedImage`）
- `previewVisible: boolean` — 控制 `AnimatePresence` 挂载（保留旧名）
- `selectedIds: number[]` — 多选集合（来自 Redux `imageSlice`）
- `isSelectionMode: boolean` — 派生量 `= selectedIds.length > 0`，无独立 state
- `lastSelectedId: number | null` — Shift+click 范围锚点（PinterestGrid 内部 `useRef`，selectedIds 清空时 reset 为 null）

---

## 新增依赖

```
framer-motion ^11.0.0
```

---

## 数据流（统一视图）

```
App.tsx
├── state: previewingImage, previewVisible
├── redux: selectedIds (imageSlice)
├── handler: handleDeleteMonth(yearMonth)
├── handler: handleDeleteSelected()
├── ESC keyboard handler (优先级):
│     if (previewVisible)  setPreviewVisible(false)
│     else if (selectedIds.length) dispatch(setSelectedIds([]))
│
├── <TopFilterBar onDeleteMonth={handleDeleteMonth} />
│
├── <ImageViews
│     previewingImageId={previewingImage?.id ?? null}
│     selectedIds={selectedIds}
│     onSelectionChange={ids => dispatch(setSelectedIds(ids))}
│     onPreview={img => { setPreviewingImage(img); setPreviewVisible(true); }}
│     onDeleteSelected={handleDeleteSelected}
│   />
│
└── <AnimatePresence onExitComplete={() => setPreviewingImage(null)}>
      {previewVisible && previewingImage && (
        <ImagePreview image={previewingImage} onClose={() => setPreviewVisible(false)} />
      )}
    </AnimatePresence>

ImageViews
├── 透传 previewingImageId / selectedIds / onSelectionChange / onPreview 给 PinterestGrid
└── selectedIds.length > 0 时渲染 <SelectionBar />

PinterestGrid (核心改造区)
├── 鼠标事件路由器:
│     onMouseDown 落在 <motion.img>:
│       - Ctrl/Cmd → onSelectionChange(toggle this.id)
│       - Shift → 范围选择 (lastSelectedId..this.id)
│       - 普通 →
│           if (isSelectionMode) onSelectionChange(toggle)
│           else                 onPreview(img)
│     onMouseDown 落在网格空白:
│       - 启动橡皮筋
│       - onMouseUp 计算交叠 → onSelectionChange(...)
├── 每张图: <motion.img layoutId={`img-${id}`}>
│     animate.opacity = previewingImageId === id ? 0 : 1 (瞬变)
│     style.borderRadius = '8px'
├── 每张图角标: <div className="checkbox-corner">
│     visibility: 始终
│     selectedIds.includes(id) ? 蓝勾 : 半透明灰空框
│     opacity 与 motion.img 同步: previewingImageId === id ? 0 : 1
└── 橡皮筋矩形: 绝对定位 div, pointer-events: none

ImagePreview (Spec A 重写, 详见下文)

SelectionBar (新建)
└── fixed bottom: [已选 n 张] [全选] [🗑 删除] [✕]

IPC layer (Spec B 原样, 无 Spec A 改动):
main/index.ts:
  delete-images       → db.deleteImages → file.deleteFilesPermanently
  delete-month-images → db.deleteImagesByMonth → file.deleteFilesPermanently
```

---

## PinterestGrid 事件路由决策表

| 事件起源 | 修饰键 | isSelectionMode | 行为 |
|---------|--------|-----------------|------|
| `<motion.img>` | 无 | false | `onPreview(img)` |
| `<motion.img>` | 无 | true | `onSelectionChange(toggle id)` |
| `<motion.img>` | Ctrl/Cmd | 任意 | `onSelectionChange(toggle id)`；`lastSelectedId = id` |
| `<motion.img>` | Shift | 任意 | 范围选择 `lastSelectedId..id`（若 `lastSelectedId == null` 退化为单选） |
| 复选框角标 | 任意 | 任意 | `onSelectionChange(toggle id)`；`event.stopPropagation()` 阻止冒泡到 motion.img；点击角标视为"明确的选择意图"，不论模式 |
| 网格空白 | 任意 | 任意 | 启动橡皮筋；onMouseUp 时 `onSelectionChange(交叠 ids)` |
| ESC（全局） | — | preview 开 | 关预览 |
| ESC（全局） | — | preview 关 + selectedIds 非空 | `setSelectedIds([])` |

---

## 共享元素动画与多选层叠（关键实现细节）

- **复选框 div 不参与 layoutId 共享元素动画。** 它是缩略图卡片 wrapper 内的兄弟元素，不在 motion.img 内。
- **整个缩略图卡片**（含 motion.img + 复选框）在 `previewingImageId === image.id` 时 `opacity: 0`（瞬变）。
- 实现方式：
  - 选项 1（推荐）：在卡片 wrapper `<div>` 上设置 `style={{ opacity: previewingImageId === id ? 0 : 1, transition: 'none' }}`，motion.img 仍保留独立 layoutId（layoutId 的 opacity 由 Framer Motion 接管，但因为父级 div opacity:0，整个卡片不可见）。
  - 选项 2：motion.img 和复选框各自 animate opacity，行为等价但代码更分散。
- 关闭预览（exit 动画）完成后，`onExitComplete` 触发 `setPreviewingImage(null)`，previewingImageId 变为 null，卡片 opacity 恢复为 1。

---

## ImagePreview.tsx 重写细节（继承 Spec A，无修改）

**移除：** Ant Design `Modal`、`Image`（`AntImage`）

**新增：**
- 导入 `motion` from `framer-motion`
- `blobToPng` 工具函数
- `handleClose` 函数（reset scale/rotation 后调 onClose）

**Props 变化：**
- 移除 `open` prop（由父级 `AnimatePresence` 的条件渲染控制）
- 移除 `loading` prop（App.tsx 中从未实际传入）

**State：**
- `scale`（默认 1）、`rotation`（默认 0）保持不变
- 新增 `useEffect(() => { setScale(1); setRotation(0); }, [image.id])`：切换图片时重置

**DOM 结构（替代 Modal）：**

```
<> (Fragment)
  ├── motion.div  [遮罩]
  │     className="fixed inset-0 z-50 bg-black/80"
  │     initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
  │     onClick={handleClose}
  │
  └── motion.div  [内容层，pointer-events-none]
        className="fixed inset-0 z-50 flex"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        ├── div  [左侧图片区，flex-1，flex-col]
        │     ├── div  [图片容器，flex-1，overflow-hidden]
        │     │     onWheel={handleWheel}  pointer-events-auto
        │     │     └── motion.img  [共享元素]
        │     │           layoutId={`img-${image.id}`}
        │     │           src={getImageUrl(image)}
        │     │           className="max-h-full max-w-full object-contain"
        │     │           animate={{ scale, rotate: rotation }}
        │     │           transition={{
        │     │             layout: { type:'spring', damping:30, stiffness:300 },
        │     │             scale: { duration:0.1, ease:'easeOut' },
        │     │             rotate: { duration:0.1, ease:'easeOut' },
        │     │           }}
        │     │
        │     └── motion.div  [工具栏]
        │           initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
        │           exit={{ opacity:0, y:20 }}
        │           pointer-events-auto
        │           [缩放/旋转/复制/下载/打开文件夹按钮]
        │
        └── motion.div  [右侧元数据面板，w-80，pointer-events-auto]
              initial={{ opacity:0, x:40 }} animate={{ opacity:1, x:0 }}
              exit={{ opacity:0, x:40 }}
              [基本信息/时间信息/文件信息]
```

**复制函数：**

```tsx
const blobToPng = (blob: Blob): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d')!.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (png) => (png ? resolve(png) : reject(new Error('toBlob failed'))),
        'image/png'
      );
    };
    img.onerror = reject;
    img.src = url;
  });

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
```

**关闭函数：**

```tsx
const handleClose = () => {
  setScale(1);
  setRotation(0);
  onClose();
};
```

---

## 删除链路（继承 Spec B，无修改）

### 月份删除交互

1. 鼠标悬停月份标签 → 标签右侧 fade-in 红色 × 按钮（CSS opacity transition）
2. 点击 × → `Modal.confirm`，显示月份名称和图片数量
3. 确认 → `deleteMonthImages(yearMonth)` → 永久删除文件 → DB 移除 → 刷新月份列表与当前图片列表
4. 取消 → 关闭弹窗

确认弹窗文案：

```
⚠️ 确认删除

将永久删除 {yearMonth} 的全部 {count} 张图片文件，此操作不可撤销。

[取消]  [删除 {count} 张]
```

边界：当前正浏览该月 → 删除后切回"全部"；月份列表为空 → 空状态。

### 多选 + 批量删除交互

**进入多选：**
- Ctrl/Cmd+click 任意图片 → 加入选中
- Shift+click → 范围选择
- 网格空白拖拽 → 橡皮筋矩形 → 松开按交叠选中

**多选模式下行为：**
- 普通单击 = 切换该张选中
- ESC = 清空 selectedIds 并退出多选
- 复选框角标始终可见：选中蓝勾，未选半透明灰空框

**SelectionBar（fixed 底部居中）：**

```
[  已选 {n} 张   全选   🗑 删除   ✕  ]
```

- 全选 → 当前 `filteredImages` 全选
- 删除 → `Modal.confirm` → IPC 删除 → dispatch `removeImages`
- ✕ → 清空 selectedIds

确认弹窗：

```
⚠️ 确认删除

将永久删除已选的 {n} 张图片，此操作不可撤销。

[取消]  [删除 {n} 张]
```

### 橡皮筋实现要点

- `PinterestGrid` 容器 `onMouseDown` 监听；事件目标为 `<motion.img>` 时不启动
- `useState` 维护 `{ startX, startY, endX, endY }`，`onMouseMove` 更新
- `onMouseUp` 遍历图片 `ref` 数组，用 `getBoundingClientRect` 判断与框选矩形交叠
- 矩形 div 绝对定位，`pointer-events: none`，z-index 高于图片
- 处理滚动偏移：用容器 `scrollTop` 修正坐标

---

## 数据层与 IPC（继承 Spec B）

### `db-service.ts`

```ts
deleteImages(ids: number[]): { filePaths: string[] }
// SELECT file_path FROM images WHERE id IN (...)
// DELETE FROM images WHERE id IN (...)

deleteImagesByMonth(yearMonth: string): { filePaths: string[] }
// SELECT file_path FROM images WHERE strftime('%Y-%m', file_time) = ?
// DELETE FROM images WHERE strftime('%Y-%m', file_time) = ?
```

### `file-service.ts`

```ts
deleteFilesPermanently(filePaths: string[]): Promise<{ deleted: number; failed: number }>
// fs.unlink 逐一删除，记录失败项
```

### IPC handlers (`main/index.ts`)

```ts
ipcMain.handle('delete-images', async (_event, ids: number[]) => { /* ... */ })
ipcMain.handle('delete-month-images', async (_event, yearMonth: string) => { /* ... */ })
```

两个 handler 均：先从 DB 取文件路径 → 永久删除文件 → 删除 DB 记录 → 返回结果。

### `useImageAPI.ts`

```ts
deleteImages(ids: number[]): Promise<{ success: boolean; deleted: number }>
deleteMonthImages(yearMonth: string): Promise<{ success: boolean; deleted: number }>
```

### `imageSlice.ts`

```ts
removeImages(state, action: PayloadAction<number[]>)
// 从 state.images 中过滤掉已删除的 id
// 同时从 selectedIds 中过滤已删除项

setSelectedIds(state, action: PayloadAction<number[]>)
// 直接替换 selectedIds 数组
```

### `shared/types.ts`

```ts
export interface DeleteResult {
  success: boolean;
  deleted: number;
  failed?: number;
}
```

---

## 文件改动清单

| 文件 | 类型 | 来源 | 合并改动 |
|------|------|------|---------|
| `package.json` | 修改 | A | + `framer-motion ^11.0.0` |
| `src/renderer/App.tsx` | 修改 | A+B | `selectedImage`→`previewingImage` 改名；`AnimatePresence` 包 ImagePreview；`handleDeleteMonth`、`handleDeleteSelected`、ESC 优先级 handler |
| `src/renderer/components/gallery/ImageViews.tsx` | 修改 | A+B | 透传 `previewingImageId` / `selectedIds` / `onSelectionChange` / `onPreview`；挂载 `<SelectionBar>` |
| `src/renderer/components/gallery/PinterestGrid.tsx` | 修改 | A+B | `<motion.img>` + layoutId；鼠标事件路由器；橡皮筋；复选框角标；previewingImageId opacity 同步 |
| `src/renderer/components/gallery/ImagePreview.tsx` | 重写 | A | Spec A 原样：去 Modal、blobToPng、motion.img、shared element |
| `src/renderer/components/gallery/SelectionBar.tsx` | 新建 | B | 浮动底部操作栏 |
| `src/renderer/components/filters/TopFilterBar.tsx` | 修改 | B | 月份 tag hover × 按钮 + `onDeleteMonth` 回调 |
| `src/renderer/store/slices/imageSlice.ts` | 修改 | B | `removeImages` / `setSelectedIds` actions |
| `src/renderer/hooks/useImageAPI.ts` | 修改 | B | `deleteImages` / `deleteMonthImages` |
| `src/main/services/db-service.ts` | 修改 | B | `deleteImages` / `deleteImagesByMonth` |
| `src/main/services/file-service.ts` | 修改 | B | `deleteFilesPermanently` |
| `src/main/index.ts` | 修改 | B | 注册 `delete-images` / `delete-month-images` IPC |
| `src/shared/types.ts` | 修改 | B | 新增 `DeleteResult` |

---

## 实现任务序（依赖优先 → 上层叠加）

### Phase 0 — 基础设施（无用户可见变化）
1. `npm i framer-motion@^11.0.0` + `package.json` 验证
2. `src/shared/types.ts` 加 `DeleteResult`
3. App.tsx 命名重构：`selectedImage` → `previewingImage`（仅改名，不动行为）
4. `imageSlice.ts` 新增 `removeImages`、`setSelectedIds`

### Phase 1 — IPC 删除链路（无 UI，可单测）
5. `db-service.ts`: `deleteImages(ids)`、`deleteImagesByMonth(yearMonth)`
6. `file-service.ts`: `deleteFilesPermanently(filePaths)`
7. `main/index.ts`: 注册 `delete-images`、`delete-month-images` handlers
8. `useImageAPI.ts`: `deleteImages`、`deleteMonthImages`
9. ✅ 单测覆盖：db 和 file service 的删除路径（含失败项计数）

### Phase 2 — Apple Photos shared element + 复制 fix
10. `PinterestGrid.tsx`: `<img>` → `<motion.img>` + `layoutId`，加 `previewingImageId` opacity:0 联动
11. `App.tsx`: `<AnimatePresence onExitComplete>` 包 `ImagePreview`
12. `ImagePreview.tsx`: 移除 Modal/AntImage，重写为 motion.div + motion.img；`handleClose` 重置 scale/rotation
13. `ImagePreview.tsx`: `blobToPng` 复制函数
14. ✅ 手测：动画从缩略图坐标展开/缩回；复制 JPEG/WebP 成功

### Phase 3 — 多选基础设施
15. `PinterestGrid.tsx`: 鼠标事件路由器（落 motion.img → Ctrl/Shift/普通分支；落空白 → 启动橡皮筋）
16. `PinterestGrid.tsx`: 复选框角标（始终可见，opacity 与 motion.img 共享）
17. `PinterestGrid.tsx`: 橡皮筋矩形 div + 交叠检测（`getBoundingClientRect` + 滚动偏移）
18. `App.tsx` ESC handler 优先级（修改 App.tsx 内 `useKeyboardShortcuts` 的 `escape` 处理器，当前在 App.tsx:85）：preview → selection → 无操作

### Phase 4 — SelectionBar + 批量删除入口
19. 新建 `SelectionBar.tsx`
20. `ImageViews.tsx`: `selectedIds.length > 0` 时挂载 SelectionBar
21. `App.tsx`: `handleDeleteSelected` — Modal.confirm → IPC → dispatch `removeImages`
22. `App.tsx`: 若 `previewingImage.id ∈ deletedIds` → 先 `setPreviewVisible(false)`

### Phase 5 — 月份删除
23. `TopFilterBar.tsx`: 月份 tag hover × 按钮（CSS opacity transition）
24. `App.tsx`: `handleDeleteMonth` — Modal.confirm → IPC → reloadMonths → 若当前月被删则切换"全部"

### Phase 6 — 联调与回归
25. 全量手测矩阵
26. `npm run lint` / `npm run test:unit` / `npm run build` 全部通过

---

## 测试矩阵

### 单功能（继承自两份 spec）
- [ ] 单击缩略图：动画从缩略图坐标展开到全屏
- [ ] ESC / 点击遮罩：动画缩回到原坐标
- [ ] 切换图片后再打开：动画从新坐标出发
- [ ] 滚轮缩放后关闭：exit 动画时无缩放残留
- [ ] 复制 JPEG → 剪贴板 OK
- [ ] 复制 WebP → 剪贴板 OK
- [ ] 月份 tag hover → × 按钮 fade-in
- [ ] 点 × → Modal.confirm → 删除 → 月份从列表消失
- [ ] 当前正浏览的月份被删 → 自动切回"全部"
- [ ] Ctrl+click 进入多选，再 Ctrl+click 取消
- [ ] Shift+click 范围选择
- [ ] 拖拽空白启动橡皮筋，松开按交叠选中
- [ ] SelectionBar 全选 / ✕ 清空 / 删除
- [ ] 删除已选 → DB 行消失 → 文件物理删除

### 新交叉场景（合并独有）
- [ ] 多选模式下单击图片 → 切换选中，**不**触发预览动画
- [ ] 多选模式下按 ESC → 清空 selectedIds（**不**关闭预览，因为预览未开）
- [ ] 预览打开 + 多选已激活 → ESC 关预览（保留 selectedIds）→ 再 ESC 清空 selectedIds
- [ ] 在缩略图上 mousedown 拖拽 → 不应启动橡皮筋（事件路由器分流）
- [ ] 多选模式下 Ctrl+click 一张未选 → 加入选中（动作幂等于普通 toggle）
- [ ] 删除已选中包含正被预览的那张 → 先关预览（exit 动画），再执行删除
- [ ] 复选框角标在 layoutId 动画过程中：随缩略图卡片整体 opacity:0，不残留
- [ ] 删除月份后预览中的图片若属于该月 → 关预览
- [ ] selectedIds 中包含已被"删除月份"操作清掉的 id → dispatch removeImages 后 selectedIds 自动同步过滤
- [ ] Shift+click 在 lastSelectedId 为 null 时 → 退化为单选

---

## 已知妥协（写入 spec 提示后续读者）

- 滚动到缩略图不在视口时关闭预览：图片飞向视口外，可接受（继承 Spec A）
- 删除正被预览的图：exit 动画飞向"已不存在的"格子；可接受
- Shift+click 的"上次点击锚点"在选择被清空后重置为 null（无锚点 → 退化为单选）
- 删除操作永久执行，无撤销 / 回收站。本次设计明确不实现软删除。

---

## 替代/废弃文档

本文档合并并取代以下两份独立设计：
- `2026-05-10-apple-photos-zoom-copy-fix-design.md`
- `2026-05-10-delete-and-box-select-design.md`

实现以本合并文档为准。原两份文档保留作历史参照，不再独立执行。
