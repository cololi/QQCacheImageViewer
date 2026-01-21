# Apple Photos 动画 & 复制 Bug 修复 — 设计文档

**日期：** 2026-05-10  
**状态：** 已审批，待实现

---

## 背景

当前图片查看器（`ImagePreview.tsx`）使用 Ant Design Modal 打开，无进入/退出动画；复制功能因 Clipboard API 只接受 `image/png`，对 JPEG/WebP 等格式报错。

---

## 目标

1. 点击缩略图时，图片以 Apple Photos 风格从缩略图位置展开至全屏；关闭时动画反向缩回原缩略图位置。
2. 图片查看器内默认缩放为 100%（fit-to-window），滚轮缩放行为保持不变。
3. 修复复制图片功能：将任意格式图片转换为 PNG 后写入剪贴板。

---

## 不在范围内

- 查看器内手势缩放（pinch-to-zoom）
- 切换上一张/下一张图片的手势
- 缩略图加载优化

---

## 方案概览

### 功能一：Apple Photos Shared Element Transition

使用 **Framer Motion** 的 `layoutId` 实现共享元素过渡。缩略图的 `motion.img` 与预览图的 `motion.img` 持有相同 `layoutId`；Framer Motion 自动计算 FLIP 动画，产生从缩略图位置展开到全屏、关闭时缩回的效果。

### 功能二：复制 Bug 修复

在 renderer 进程中用 Canvas 将 blob 转换为 PNG，再以 `'image/png'` 为 key 写入 `ClipboardItem`。无需 IPC 改动。

---

## 新增依赖

```
framer-motion ^11.0.0
```

---

## 文件改动

### 1. `package.json`

在 `dependencies` 添加 `"framer-motion": "^11.0.0"`。

---

### 2. `src/renderer/App.tsx`

**改动：**
- 导入 `AnimatePresence` from `framer-motion`
- 将 `<ImagePreview>` 的条件渲染移至 `AnimatePresence` 内，由 `previewVisible` 控制挂载/卸载（取代 `open` prop）
- `AnimatePresence` 加 `onExitComplete={() => setSelectedImage(null)}`：关闭动画播完后才清空 `selectedImage`，避免缩略图在动画结束前提前恢复显示
- 向 `ImageViews` 透传 `selectedImageId={selectedImage?.id ?? null}`

```tsx
<AnimatePresence onExitComplete={() => setSelectedImage(null)}>
  {previewVisible && selectedImage && (
    <ImagePreview
      image={selectedImage}
      onClose={() => setPreviewVisible(false)}
    />
  )}
</AnimatePresence>
```

---

### 3. `src/renderer/components/gallery/ImageViews.tsx`

**改动：**
- props 新增 `selectedImageId?: number | null`
- 透传给 `PinterestGrid`

---

### 4. `src/renderer/components/gallery/PinterestGrid.tsx`

**改动：**
- props 新增 `selectedImageId?: number | null`
- 导入 `motion` from `framer-motion`
- 将 `<img>` 改为 `<motion.img>`：
  - `layoutId={`img-${image.id}`}`
  - `animate={{ opacity: selectedImageId === image.id ? 0 : 1 }}`
  - `transition={{ opacity: { duration: 0 } }}`（瞬间隐藏，产生"图片离开格子"感）
  - `style={{ borderRadius: '8px' }}`（Framer Motion 会在 layout 动画中过渡 borderRadius 至 0）

---

### 5. `src/renderer/components/gallery/ImagePreview.tsx`

这是改动最大的文件。

**移除：**
- Ant Design `Modal`、`Image`（`AntImage`）组件

**新增：**
- 导入 `motion` from `framer-motion`
- `blobToPng` 工具函数
- `handleClose` 函数（reset scale/rotation 后调 onClose）

**Props 变化：**
- 移除 `open` prop（由父级 `AnimatePresence` 的条件渲染控制）
- 移除 `loading` prop（App.tsx 中从未实际传入，新实现不保留）

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
              [基本信息/时间信息/文件信息，含滚动和文字选择]
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
  onClose(); // 触发父级 AnimatePresence 的 exit 动画
};
```

---

## 动画时序

| 阶段 | 内容 |
|------|------|
| 打开：缩略图 | `opacity: 1→0`（瞬间） |
| 打开：遮罩 | `opacity: 0→1`（0.2s） |
| 打开：图片 | layout spring 从缩略图坐标→全屏（~0.4s） |
| 打开：工具栏 | `opacity+y`（0.2s，延迟 0.1s） |
| 打开：元数据 | `opacity+x`（0.2s，延迟 0.1s） |
| 关闭：图片 | layout spring 从全屏→缩略图坐标（~0.4s） |
| 关闭：遮罩/工具栏/元数据 | `exit` 动画（0.2s） |
| 关闭完成 | `onExitComplete` → `selectedImage=null` → 缩略图 `opacity: 0→1` |

---

## 边界情况

- **滚动到缩略图不可见时关闭**：Framer Motion 会动画到缩略图的当前 DOM 位置（即使在视口外），表现为图片飞向屏幕外，可接受。
- **图片切换（左右浏览）**：当前不支持，不在本次范围内。
- **ESC 键关闭**：已在 `App.tsx` 的 `useKeyboardShortcuts` 中处理，触发 `setPreviewVisible(false)` — 需改为同时调 `setScale(1)/setRotation(0)`，或在 `ImagePreview.handleClose` 中统一处理（推荐后者，需将 handleClose 通过 ref 暴露给父级，或在 App.tsx 中另行 reset）。实现时采用最简方式：ESC handler 直接调 `setPreviewVisible(false)`，reset 交给 `useEffect([image.id])` 在下次打开时处理。

---

## 测试要点

- [ ] 点击缩略图：图片从缩略图坐标展开到全屏
- [ ] 关闭：图片缩回缩略图坐标，缩略图恢复显示
- [ ] 切换图片后重新打开：动画从新的缩略图坐标出发
- [ ] 滚轮缩放后关闭：exit 动画时 scale=1（无缩放状态）
- [ ] 复制 JPEG 图片到剪贴板：成功，无报错
- [ ] 复制 WebP 图片到剪贴板：成功，无报错
- [ ] ESC 键关闭：正常触发 exit 动画
- [ ] 点击遮罩关闭：正常触发 exit 动画
