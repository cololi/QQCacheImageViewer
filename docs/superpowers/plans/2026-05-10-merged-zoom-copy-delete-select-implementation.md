# Apple Photos 动画 + 复制修复 + 删除/框选 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在单一 PR 内实现 Apple Photos 风格的共享元素预览动画、剪贴板复制 bug 修复、月份删除、框选 + Ctrl/Shift+click 多选、批量删除五个特性。

**Architecture:** 分 6 个阶段按依赖顺序实现：基础设施（依赖、类型、Redux action、命名重构）→ IPC 删除链路（TDD 后端）→ Apple Photos 共享元素 + 复制 fix → 多选 UI（PinterestGrid 鼠标路由）→ SelectionBar + 批量删除入口 → 月份删除。最后做集成测试。

**Tech Stack:** Electron 28、React 18、Framer Motion 11（新增）、Redux Toolkit、better-sqlite3、Ant Design 5、Tailwind CSS 3。

**Spec:** [docs/superpowers/specs/2026-05-10-merged-zoom-copy-delete-select-design.md](../specs/2026-05-10-merged-zoom-copy-delete-select-design.md)

---

## Phase 0 — 基础设施

### Task 1: 添加 framer-motion 依赖

**Files:**
- Modify: `package.json:45-59` (dependencies block)

- [ ] **Step 1: 编辑 package.json，将 framer-motion 加入 dependencies**

在 `dependencies` 中按字母序插入 `"framer-motion": "^11.0.0"`，紧跟 `"fs-extra": "^11.2.0"` 之后：

```json
"dependencies": {
  "@reduxjs/toolkit": "^2.1.0",
  "adm-zip": "^0.5.16",
  "antd": "^5.13.2",
  "better-sqlite3": "^9.4.0",
  "electron-store": "^8.2.0",
  "framer-motion": "^11.0.0",
  "fs-extra": "^11.2.0",
  ...
}
```

- [ ] **Step 2: 安装新依赖**

Run: `npm install`
Expected: `added N packages` 无错误。

- [ ] **Step 3: 验证 import 可用**

Run: `node -e "require('framer-motion'); console.log('ok')"`
Expected: `ok`

- [ ] **Step 4: 提交**

```bash
git add package.json package-lock.json
git commit -m "chore: add framer-motion ^11.0.0 dependency"
```

---

### Task 2: 在 shared/types.ts 添加 DeleteResult 类型

**Files:**
- Modify: `src/shared/types.ts` (append at end)

- [ ] **Step 1: 在 types.ts 末尾追加 DeleteResult 接口**

文件当前末尾在第 61 行 `}`（QueryParams 闭合）。追加：

```typescript

export interface DeleteResult {
  success: boolean;
  deleted: number;
  failed?: number;
}
```

- [ ] **Step 2: TypeScript 编译验证**

Run: `npx tsc --noEmit -p src/main/tsconfig.json`
Expected: 无错误输出

- [ ] **Step 3: 提交**

```bash
git add src/shared/types.ts
git commit -m "feat(types): add DeleteResult shared type"
```

---

### Task 3: 在 imageSlice 添加 setSelectedIds 和 removeImages action

**Files:**
- Modify: `src/renderer/store/slices/imageSlice.ts:29-65` (reducers + exports)

注意：`selectedIds`、`toggleImageSelection`、`clearSelection` 已存在；本任务**新增** `setSelectedIds`（整体替换，用于框选结果写入）和 `removeImages`（删除时过滤 images 与 selectedIds）。

- [ ] **Step 1: 在 reducers 块中插入两个新 action**

在 `clearSelection` 之后、闭合 `}` 之前插入：

```typescript
    setSelectedIds: (state, action: PayloadAction<number[]>) => {
      state.selectedIds = action.payload;
    },
    removeImages: (state, action: PayloadAction<number[]>) => {
      const removeSet = new Set(action.payload);
      state.images = state.images.filter((img) => !removeSet.has(img.id));
      state.selectedIds = state.selectedIds.filter((id) => !removeSet.has(id));
    },
```

- [ ] **Step 2: 在 destructured exports 中添加新 action**

在 `clearSelection,` 之后追加：

```typescript
  setSelectedIds,
  removeImages,
```

- [ ] **Step 3: 类型验证**

Run: `npx tsc --noEmit -p src/main/tsconfig.json` 不会触及 renderer，所以改用：
Run: `npm run lint`
Expected: 无 imageSlice 相关报错

- [ ] **Step 4: 提交**

```bash
git add src/renderer/store/slices/imageSlice.ts
git commit -m "feat(state): add setSelectedIds and removeImages actions"
```

---

### Task 4: App.tsx 命名重构 selectedImage → previewingImage

**Files:**
- Modify: `src/renderer/App.tsx:45,271,282` (state declaration + setter calls + ImagePreview prop)

仅做机械重命名，不改行为。

- [ ] **Step 1: 改第 45 行的 state 声明**

```tsx
  const [previewingImage, setPreviewingImage] = useState<Image | null>(null);
```

- [ ] **Step 2: 改第 271 行的 onImageSelect 回调**

```tsx
              onImageSelect={(image) => {
                setPreviewingImage(image);
                setPreviewVisible(true);
              }}
```

- [ ] **Step 3: 改第 282 行 ImagePreview 的 image prop**

```tsx
      <ImagePreview
        image={previewingImage}
        open={previewVisible}
        onClose={() => setPreviewVisible(false)}
      />
```

- [ ] **Step 4: 验证 build 通过**

Run: `npm run build:react`
Expected: `Compiled successfully` 或仅有未涉及本改动的警告

- [ ] **Step 5: 提交**

```bash
git add src/renderer/App.tsx
git commit -m "refactor(app): rename selectedImage to previewingImage to disambiguate from selectedIds"
```

---

## Phase 1 — IPC 删除链路（TDD）

### Task 5: 为 deleteImages 写失败测试

**Files:**
- Create: `src/main/services/__tests__/db-service.delete.test.ts`

注意：原 `db-service.test.ts` 存在 pre-existing TypeScript 编译错误（fileName / minSize / queryImages({}) 等历史 API 漂移），整个 suite 无法加载。本次新功能的测试单独放进 `db-service.delete.test.ts`，避免与历史失效代码耦合。

- [ ] **Step 1: 创建新测试文件，先写最外层 import 与 mock 锅炉板**

```typescript
/**
 * Tests for delete-related db-service functions.
 * Kept separate from db-service.test.ts which has pre-existing TS errors
 * unrelated to this feature.
 */

import * as dbService from '../db-service';

jest.mock('better-sqlite3', () => {
  const mockDb = {
    pragma: jest.fn(),
    exec: jest.fn(),
    prepare: jest.fn(),
    close: jest.fn(),
  };
  return jest.fn(() => mockDb);
});

jest.mock('electron', () => ({
  app: {
    getPath: jest.fn((type) => {
      if (type === 'userData') return '/mock/user/data';
      return '/mock/path';
    }),
  },
}));

describe('Database Service — delete operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('deleteImages', () => {
    let mockPrepareImpl: jest.Mock;
    let mockSelectStmt: { all: jest.Mock };
    let mockDeleteStmt: { run: jest.Mock };

    beforeEach(() => {
      mockSelectStmt = {
        all: jest.fn().mockReturnValue([
          { file_path: '/path/a.jpg' },
          { file_path: '/path/b.png' },
        ]),
      };
      mockDeleteStmt = { run: jest.fn() };
      mockPrepareImpl = jest.fn((sql: string) => {
        if (sql.toUpperCase().startsWith('SELECT')) return mockSelectStmt;
        return mockDeleteStmt;
      });

      const Database = require('better-sqlite3');
      Database.mockImplementation(() => ({
        pragma: jest.fn(),
        exec: jest.fn(),
        prepare: mockPrepareImpl,
        close: jest.fn(),
      }));
      dbService.initializeDatabase();
    });

    it('returns the file paths of deleted rows', () => {
      const result = dbService.deleteImages([1, 2]);
      expect(result.filePaths).toEqual(['/path/a.jpg', '/path/b.png']);
    });

    it('runs SELECT then DELETE with the same id list', () => {
      dbService.deleteImages([10, 20, 30]);
      expect(mockSelectStmt.all).toHaveBeenCalledWith(10, 20, 30);
      expect(mockDeleteStmt.run).toHaveBeenCalledWith(10, 20, 30);
    });

    it('returns empty filePaths for empty id list without querying', () => {
      const result = dbService.deleteImages([]);
      expect(result.filePaths).toEqual([]);
      expect(mockSelectStmt.all).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: 跑测试确认它失败（函数尚未存在）**

Run: `npx jest src/main/services/__tests__/db-service.delete.test.ts -t "deleteImages" --no-coverage`
Expected: FAIL — `dbService.deleteImages is not a function`

- [ ] **Step 3: 暂不提交，进入实现任务**

---

### Task 6: 实现 deleteImages

**Files:**
- Modify: `src/main/services/db-service.ts` (append before `closeDatabase`)

- [ ] **Step 1: 在 `clearOldCache` 之后、`optimizeDatabase` 之前插入新函数**

```typescript
/**
 * Delete images by ID list. Returns the file paths of deleted rows
 * so the caller can remove the physical files.
 */
export const deleteImages = (ids: number[]): { filePaths: string[] } => {
  if (!db || ids.length === 0) return { filePaths: [] };

  try {
    const placeholders = ids.map(() => '?').join(',');
    const selectStmt = db.prepare(
      `SELECT file_path FROM images WHERE id IN (${placeholders})`
    );
    const rows = selectStmt.all(...ids) as Array<{ file_path: string }>;
    const filePaths = rows.map((r) => r.file_path);

    const deleteStmt = db.prepare(
      `DELETE FROM images WHERE id IN (${placeholders})`
    );
    deleteStmt.run(...ids);

    return { filePaths };
  } catch (error) {
    console.error('Failed to delete images:', error);
    return { filePaths: [] };
  }
};
```

- [ ] **Step 2: 跑测试确认通过**

Run: `npx jest src/main/services/__tests__/db-service.delete.test.ts -t "deleteImages" --no-coverage`
Expected: 3 tests PASS

- [ ] **Step 3: 提交**

```bash
git add src/main/services/db-service.ts src/main/services/__tests__/db-service.delete.test.ts
git commit -m "feat(db): add deleteImages with file path return"
```

---

### Task 7: 为 deleteImagesByMonth 写失败测试

**Files:**
- Modify: `src/main/services/__tests__/db-service.delete.test.ts` (insert new describe before outer close)

- [ ] **Step 1: 用 Edit 在 deleteImages describe 之后、外层 `});` 之前插入新 describe**

将文件中的：

```typescript
    it('returns empty filePaths for empty id list without querying', () => {
      const result = dbService.deleteImages([]);
      expect(result.filePaths).toEqual([]);
      expect(mockSelectStmt.all).not.toHaveBeenCalled();
    });
  });
});
```

替换为：

```typescript
    it('returns empty filePaths for empty id list without querying', () => {
      const result = dbService.deleteImages([]);
      expect(result.filePaths).toEqual([]);
      expect(mockSelectStmt.all).not.toHaveBeenCalled();
    });
  });

  describe('deleteImagesByMonth', () => {
    let mockSelectStmt: { all: jest.Mock };
    let mockDeleteStmt: { run: jest.Mock };

    beforeEach(() => {
      mockSelectStmt = {
        all: jest.fn().mockReturnValue([
          { file_path: '/path/jan-a.jpg' },
          { file_path: '/path/jan-b.png' },
        ]),
      };
      mockDeleteStmt = { run: jest.fn() };

      const Database = require('better-sqlite3');
      Database.mockImplementation(() => ({
        pragma: jest.fn(),
        exec: jest.fn(),
        prepare: jest.fn((sql: string) =>
          sql.toUpperCase().startsWith('SELECT') ? mockSelectStmt : mockDeleteStmt
        ),
        close: jest.fn(),
      }));
      dbService.initializeDatabase();
    });

    it('returns file paths from rows matching the year-month', () => {
      const result = dbService.deleteImagesByMonth('2026-01');
      expect(result.filePaths).toEqual(['/path/jan-a.jpg', '/path/jan-b.png']);
    });

    it('uses strftime year-month filter on file_time', () => {
      dbService.deleteImagesByMonth('2026-01');
      expect(mockSelectStmt.all).toHaveBeenCalledWith('2026-01');
      expect(mockDeleteStmt.run).toHaveBeenCalledWith('2026-01');
    });

    it('returns empty filePaths on empty yearMonth', () => {
      const result = dbService.deleteImagesByMonth('');
      expect(result.filePaths).toEqual([]);
    });
  });
});
```

注意末尾的 `});` 是外层 `Database Service — delete operations` describe 的闭合，不要漏掉。

- [ ] **Step 2: 跑测试确认失败**

Run: `npx jest src/main/services/__tests__/db-service.delete.test.ts -t "deleteImagesByMonth" --no-coverage`
Expected: FAIL — `dbService.deleteImagesByMonth is not a function`

---

### Task 8: 实现 deleteImagesByMonth

**Files:**
- Modify: `src/main/services/db-service.ts` (append after `deleteImages`)

- [ ] **Step 1: 在 `deleteImages` 之后追加**

```typescript
/**
 * Delete all images whose file_time falls within the given year-month.
 * Returns the file paths so the caller can remove the physical files.
 */
export const deleteImagesByMonth = (yearMonth: string): { filePaths: string[] } => {
  if (!db || !yearMonth) return { filePaths: [] };

  try {
    const selectStmt = db.prepare(
      "SELECT file_path FROM images WHERE strftime('%Y-%m', file_time) = ?"
    );
    const rows = selectStmt.all(yearMonth) as Array<{ file_path: string }>;
    const filePaths = rows.map((r) => r.file_path);

    const deleteStmt = db.prepare(
      "DELETE FROM images WHERE strftime('%Y-%m', file_time) = ?"
    );
    deleteStmt.run(yearMonth);

    return { filePaths };
  } catch (error) {
    console.error('Failed to delete images by month:', error);
    return { filePaths: [] };
  }
};
```

- [ ] **Step 2: 跑测试确认通过**

Run: `npx jest src/main/services/__tests__/db-service.delete.test.ts -t "deleteImagesByMonth" --no-coverage`
Expected: 3 tests PASS

- [ ] **Step 3: 提交**

```bash
git add src/main/services/db-service.ts src/main/services/__tests__/db-service.delete.test.ts
git commit -m "feat(db): add deleteImagesByMonth using strftime filter"
```

---

### Task 9: 为 deleteFilesPermanently 写失败测试

**Files:**
- Create: `src/main/services/__tests__/file-service.test.ts`

- [ ] **Step 1: 创建测试文件**

```typescript
import * as fileService from '../file-service';
import fs from 'fs-extra';

jest.mock('fs-extra');
jest.mock('electron', () => ({
  shell: { trashItem: jest.fn(), openPath: jest.fn() },
  dialog: { showSaveDialog: jest.fn(), showOpenDialog: jest.fn() },
}));
jest.mock('adm-zip', () => jest.fn(() => ({ addFile: jest.fn(), writeZip: jest.fn() })));

describe('deleteFilesPermanently', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses fs.unlink and reports deleted count', async () => {
    (fs.unlink as jest.Mock).mockResolvedValue(undefined);
    const result = await fileService.deleteFilesPermanently(['/a.jpg', '/b.jpg']);
    expect(fs.unlink).toHaveBeenCalledTimes(2);
    expect(fs.unlink).toHaveBeenCalledWith('/a.jpg');
    expect(fs.unlink).toHaveBeenCalledWith('/b.jpg');
    expect(result).toEqual({ deleted: 2, failed: 0 });
  });

  it('counts failures without throwing', async () => {
    (fs.unlink as jest.Mock)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('ENOENT'))
      .mockResolvedValueOnce(undefined);
    const result = await fileService.deleteFilesPermanently(['/a', '/missing', '/c']);
    expect(result).toEqual({ deleted: 2, failed: 1 });
  });

  it('returns zero counts on empty input', async () => {
    const result = await fileService.deleteFilesPermanently([]);
    expect(result).toEqual({ deleted: 0, failed: 0 });
    expect(fs.unlink).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx jest src/main/services/__tests__/file-service.test.ts --no-coverage`
Expected: FAIL — `fileService.deleteFilesPermanently is not a function`

---

### Task 10: 实现 deleteFilesPermanently

**Files:**
- Modify: `src/main/services/file-service.ts` (append after `deleteToRecycleBin`)

- [ ] **Step 1: 在 `deleteToRecycleBin` 之后追加**

```typescript
/**
 * Permanently delete files using fs.unlink (bypasses recycle bin).
 * Counts failures rather than throwing — caller can decide to surface them.
 */
export async function deleteFilesPermanently(
  filePaths: string[]
): Promise<{ deleted: number; failed: number }> {
  let deleted = 0;
  let failed = 0;

  for (const filePath of filePaths) {
    try {
      await fs.unlink(filePath);
      deleted++;
    } catch (error) {
      failed++;
      console.error(`Failed to delete ${filePath}:`, error);
    }
  }

  return { deleted, failed };
}
```

- [ ] **Step 2: 跑测试确认通过**

Run: `npx jest src/main/services/__tests__/file-service.test.ts --no-coverage`
Expected: 3 tests PASS

- [ ] **Step 3: 提交**

```bash
git add src/main/services/file-service.ts src/main/services/__tests__/file-service.test.ts
git commit -m "feat(file): add deleteFilesPermanently with failure counting"
```

---

### Task 11: 注册 IPC handlers

**Files:**
- Modify: `src/main/index.ts:3,5-14,148-150` (imports + new handlers)

- [ ] **Step 1: 更新 db-service import（line 3）**

```typescript
import { initializeDatabase, getMonths, getImages, saveImages, getImageCount, getExistingHashes, deleteImages, deleteImagesByMonth } from './services/db-service';
```

- [ ] **Step 2: 更新 file-service import（line 5-14）**

```typescript
import {
  copyFile,
  copyFiles,
  deleteToRecycleBin,
  deleteFilesPermanently,
  exportAsZip,
  openFolderInExplorer,
  openFileWithDefaultApp,
  showSaveDialog,
  showOpenDirectoryDialog,
} from './services/file-service';
```

- [ ] **Step 3: 在 line 150（`delete-to-recycle-bin` handler 之后）插入两个新 handler**

```typescript
ipcMain.handle('delete-images', async (_event, ids: number[]) => {
  try {
    const { filePaths } = deleteImages(ids);
    const fileResult = await deleteFilesPermanently(filePaths);
    return {
      success: fileResult.failed === 0,
      deleted: fileResult.deleted,
      failed: fileResult.failed,
    };
  } catch (error) {
    console.error('delete-images failed:', error);
    return { success: false, deleted: 0, failed: ids.length };
  }
});

ipcMain.handle('delete-month-images', async (_event, yearMonth: string) => {
  try {
    const { filePaths } = deleteImagesByMonth(yearMonth);
    const fileResult = await deleteFilesPermanently(filePaths);
    return {
      success: fileResult.failed === 0,
      deleted: fileResult.deleted,
      failed: fileResult.failed,
    };
  } catch (error) {
    console.error('delete-month-images failed:', error);
    return { success: false, deleted: 0, failed: 0 };
  }
});
```

- [ ] **Step 4: 编译验证**

Run: `npx tsc --noEmit -p src/main/tsconfig.json`
Expected: 无错误

- [ ] **Step 5: 提交**

```bash
git add src/main/index.ts
git commit -m "feat(ipc): register delete-images and delete-month-images handlers"
```

---

### Task 12: 在 useImageAPI hook 中添加 deleteImages / deleteMonthImages

**Files:**
- Modify: `src/renderer/hooks/useImageAPI.ts:21-27` (returned object)

- [ ] **Step 1: 在 `getImageCount` 之后添加两个新 callback**

在 `getImageCount` 的 `}, []);` 之后插入：

```typescript
  const deleteImages = useCallback(async (ids: number[]): Promise<{ success: boolean; deleted: number; failed: number }> => {
    return window.electron?.ipcRenderer.invoke('delete-images', ids);
  }, []);

  const deleteMonthImages = useCallback(async (yearMonth: string): Promise<{ success: boolean; deleted: number; failed: number }> => {
    return window.electron?.ipcRenderer.invoke('delete-month-images', yearMonth);
  }, []);
```

- [ ] **Step 2: 在 return 块（line 21-26）追加两个 export**

```typescript
  return {
    scanImages,
    getMonths,
    getImages,
    getImageCount,
    deleteImages,
    deleteMonthImages,
  };
```

- [ ] **Step 3: 验证 build**

Run: `npm run build:react`
Expected: Compiled successfully

- [ ] **Step 4: 提交**

```bash
git add src/renderer/hooks/useImageAPI.ts
git commit -m "feat(hooks): expose deleteImages and deleteMonthImages IPC"
```

---

## Phase 2 — Apple Photos shared element + 复制 fix

### Task 13: 在 PinterestGrid 中将 img 改为 motion.img + layoutId

**Files:**
- Modify: `src/renderer/components/gallery/PinterestGrid.tsx:1-10,67-91` (imports + props + thumbnail)

注意：本任务只引入 motion.img 与 layoutId，不引入选择/复选框。新增 `previewingImageId` prop，用于动画期间隐藏对应缩略图。

- [ ] **Step 1: 更新 imports（line 1-5）**

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { Button, message, Tooltip } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';
import { Image } from '../../../shared/types';
import { getImageUrl } from '../../utils/imageUtils';
```

- [ ] **Step 2: 更新 props 接口（line 8-11）**

```tsx
interface PinterestGridProps {
    images: Image[];
    onImageSelect?: (image: Image) => void;
    previewingImageId?: number | null;
}
```

- [ ] **Step 3: 更新组件签名（line 17-21）**

```tsx
export const PinterestGrid: React.FC<PinterestGridProps & { columnCount?: number }> = ({
    images,
    onImageSelect,
    previewingImageId,
    columnCount,
}) => {
```

- [ ] **Step 4: 修改卡片渲染（line 67-91）—— 包裹 div 加 opacity 联动，img 换成 motion.img**

```tsx
                {images.map((image) => (
                    <div
                        key={image.id}
                        className="group relative mb-4 break-inside-avoid cursor-pointer overflow-hidden rounded-lg bg-white transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
                        style={{ opacity: previewingImageId === image.id ? 0 : 1 }}
                        onClick={() => onImageSelect?.(image)}
                    >
                        <motion.img
                            layoutId={`img-${image.id}`}
                            src={getImageUrl(image)}
                            alt=""
                            className="block h-auto w-full object-cover"
                            loading="lazy"
                            style={{ borderRadius: '8px' }}
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
```

- [ ] **Step 5: 验证 build**

Run: `npm run build:react`
Expected: Compiled successfully

- [ ] **Step 6: 提交**

```bash
git add src/renderer/components/gallery/PinterestGrid.tsx
git commit -m "feat(grid): convert thumbnail img to motion.img with layoutId"
```

---

### Task 14: 在 ImageViews 透传 previewingImageId

**Files:**
- Modify: `src/renderer/components/gallery/ImageViews.tsx:7-39`

- [ ] **Step 1: 更新 props 接口与 destructure（line 7-22）**

```tsx
interface ImageViewsProps {
  images: Image[];
  loading: boolean;
  onImageSelect?: (image: Image) => void;
  columnCount?: number;
  previewingImageId?: number | null;
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
}) => {
```

- [ ] **Step 2: 透传给 PinterestGrid（line 34）**

```tsx
          <PinterestGrid
            images={images}
            onImageSelect={onImageSelect}
            columnCount={columnCount}
            previewingImageId={previewingImageId}
          />
```

- [ ] **Step 3: 验证 build**

Run: `npm run build:react`
Expected: Compiled successfully

- [ ] **Step 4: 提交**

```bash
git add src/renderer/components/gallery/ImageViews.tsx
git commit -m "feat(views): forward previewingImageId to PinterestGrid"
```

---

### Task 15: 在 App.tsx 用 AnimatePresence 包裹 ImagePreview

**Files:**
- Modify: `src/renderer/App.tsx:1-3,267-285` (imports + ImageViews wiring + ImagePreview wrapper)

- [ ] **Step 1: 在 imports 顶部加 AnimatePresence（line 1 之后）**

在 `import React, ...` 行之后追加：

```tsx
import { AnimatePresence } from 'framer-motion';
```

- [ ] **Step 2: 在 ImageViews 调用上加 previewingImageId 透传（line 267-275）**

```tsx
          {filteredImages.length > 0 && (
            <ImageViews
              images={filteredImages}
              loading={loading}
              onImageSelect={(image) => {
                setPreviewingImage(image);
                setPreviewVisible(true);
              }}
              columnCount={columnCount}
              previewingImageId={previewingImage?.id ?? null}
            />
          )}
```

- [ ] **Step 3: 用 AnimatePresence 替换原 ImagePreview 调用（line 281-285）**

```tsx
      {/* Image Preview with Apple Photos shared-element transition */}
      <AnimatePresence onExitComplete={() => setPreviewingImage(null)}>
        {previewVisible && previewingImage && (
          <ImagePreview
            image={previewingImage}
            onClose={() => setPreviewVisible(false)}
          />
        )}
      </AnimatePresence>
```

注意：移除了 `open` prop（由条件渲染控制），ImagePreview 的接口将在下个任务里调整。

- [ ] **Step 4: 暂不验证 build——下个任务会改 ImagePreview 接口；现在 TypeScript 会报 prop 不匹配，是预期**

- [ ] **Step 5: 暂不提交，进入下一任务**

---

### Task 16: 重写 ImagePreview 为 motion.div + motion.img（移除 Modal）

**Files:**
- Modify: `src/renderer/components/gallery/ImagePreview.tsx` (完整重写组件结构，保留 metadata 面板内容)

- [ ] **Step 1: 完整替换文件内容**

```tsx
import React, { useState, useEffect } from 'react';
import { Button, Space, Tooltip, message } from 'antd';
import { motion } from 'framer-motion';
import {
  ZoomInOutlined,
  ZoomOutOutlined,
  RotateLeftOutlined,
  RotateRightOutlined,
  DownloadOutlined,
  FolderOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import { Image } from '../../../shared/types';
import { getImageUrl, formatFileSize, formatDate } from '../../utils/imageUtils';

interface ImagePreviewProps {
  image: Image;
  onClose: () => void;
}

/**
 * Convert any image blob (jpeg/webp/etc.) to PNG so the Clipboard API
 * accepts it. The Clipboard write() spec only allows image/png reliably
 * across browsers and Electron.
 */
const blobToPng = (blob: Blob): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('canvas 2d context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (png) => (png ? resolve(png) : reject(new Error('toBlob failed'))),
        'image/png'
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image load failed'));
    };
    img.src = url;
  });

/**
 * ImagePreview — Apple Photos style fullscreen viewer with shared-element
 * transition. Driven by parent AnimatePresence; exit animation reverses to
 * the originating thumbnail position via layoutId match.
 */
export const ImagePreview: React.FC<ImagePreviewProps> = ({ image, onClose }) => {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    setScale(1);
    setRotation(0);
  }, [image.id]);

  const handleClose = () => {
    setScale(1);
    setRotation(0);
    onClose();
  };

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.1, 5));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.1, 0.1));

  const handleWheel = (e: React.WheelEvent) => {
    if (e.deltaY < 0) handleZoomIn();
    else handleZoomOut();
  };

  const handleRotateLeft = () => setRotation((prev) => (prev - 90 + 360) % 360);
  const handleRotateRight = () => setRotation((prev) => (prev + 90) % 360);

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

  const handleDownload = async () => {
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
    <>
      <motion.div
        className="fixed inset-0 z-50 bg-black/80"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={handleClose}
      />
      <div className="fixed inset-0 z-50 flex pointer-events-none">
        {/* Image area */}
        <div className="flex flex-1 flex-col">
          <div
            className="flex flex-1 items-center justify-center overflow-hidden pointer-events-auto"
            onWheel={handleWheel}
          >
            <motion.img
              layoutId={`img-${image.id}`}
              src={getImageUrl(image)}
              alt={image.hash}
              className="max-h-full max-w-full object-contain"
              style={{ borderRadius: 0 }}
              animate={{ scale, rotate: rotation }}
              transition={{
                layout: { type: 'spring', damping: 30, stiffness: 300 },
                scale: { duration: 0.1, ease: 'easeOut' },
                rotate: { duration: 0.1, ease: 'easeOut' },
              }}
            />
          </div>

          {/* Toolbar */}
          <motion.div
            className="flex items-center justify-center gap-2 border-t border-gray-100 bg-white px-4 py-3 pointer-events-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2, delay: 0.1 }}
          >
            <Space>
              <Tooltip title="放大 (Ctrl++ / 滚轮上)">
                <Button icon={<ZoomInOutlined />} onClick={handleZoomIn} disabled={scale >= 5} />
              </Tooltip>
              <Tooltip title="缩小 (Ctrl+- / 滚轮下)">
                <Button icon={<ZoomOutOutlined />} onClick={handleZoomOut} disabled={scale <= 0.1} />
              </Tooltip>
              <Tooltip title={`缩放: ${scale.toFixed(1)}x`}>
                <span style={{ minWidth: '60px', textAlign: 'center' }}>{scale.toFixed(1)}x</span>
              </Tooltip>
              <span style={{ borderLeft: '1px solid #d9d9d9', height: '24px' }} />
              <Tooltip title="向左旋转">
                <Button icon={<RotateLeftOutlined />} onClick={handleRotateLeft} />
              </Tooltip>
              <Tooltip title="向右旋转">
                <Button icon={<RotateRightOutlined />} onClick={handleRotateRight} />
              </Tooltip>
              <span style={{ borderLeft: '1px solid #d9d9d9', height: '24px' }} />
              <Tooltip title="复制图片">
                <Button icon={<CopyOutlined />} onClick={handleCopy} />
              </Tooltip>
              <Tooltip title="下载">
                <Button icon={<DownloadOutlined />} onClick={handleDownload} />
              </Tooltip>
              <Tooltip title="打开文件夹">
                <Button icon={<FolderOutlined />} />
              </Tooltip>
            </Space>
          </motion.div>
        </div>

        {/* Metadata panel */}
        <motion.div
          className="flex w-[320px] flex-col gap-4 overflow-y-auto bg-white py-4 pr-2 pointer-events-auto"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 40 }}
          transition={{ duration: 0.2, delay: 0.1 }}
        >
          <div className="px-4">
            <h4 className="mb-3 text-sm font-semibold">基本信息</h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1 text-xs">
                <span className="font-medium text-gray-500">格式:</span>
                <span>{image.format.toUpperCase()}</span>
              </div>
              <div className="flex flex-col gap-1 text-xs">
                <span className="font-medium text-gray-500">大小:</span>
                <span>{formatFileSize(image.fileSize)}</span>
              </div>
              {image.width && image.height && (
                <>
                  <div className="flex flex-col gap-1 text-xs">
                    <span className="font-medium text-gray-500">宽度:</span>
                    <span>{image.width}px</span>
                  </div>
                  <div className="flex flex-col gap-1 text-xs">
                    <span className="font-medium text-gray-500">高度:</span>
                    <span>{image.height}px</span>
                  </div>
                  <div className="flex flex-col gap-1 text-xs">
                    <span className="font-medium text-gray-500">像素数:</span>
                    <span>{(image.width * image.height).toLocaleString()}</span>
                  </div>
                  <div className="flex flex-col gap-1 text-xs">
                    <span className="font-medium text-gray-500">宽高比:</span>
                    <span>{image.ratio?.toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="px-4">
            <h4 className="mb-3 text-sm font-semibold">时间信息</h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1 text-xs">
                <span className="font-medium text-gray-500">修改时间:</span>
                <span>{image.fileTime ? formatDate(new Date(image.fileTime)) : '-'}</span>
              </div>
              <div className="flex flex-col gap-1 text-xs">
                <span className="font-medium text-gray-500">创建时间:</span>
                <span>{formatDate(new Date(image.createdAt))}</span>
              </div>
            </div>
          </div>

          <div className="px-4">
            <h4 className="mb-3 text-sm font-semibold">文件信息</h4>
            <div className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-gray-500">哈希:</span>
              <span className="break-all font-mono text-blue-500">{image.hash}</span>
            </div>
            <div className="mt-2 flex flex-col gap-1 text-xs">
              <span className="font-medium text-gray-500">路径:</span>
              <span className="break-all font-mono text-blue-500" title={image.filePath}>
                {image.filePath}
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
};
```

- [ ] **Step 2: 验证 build**

Run: `npm run build:react`
Expected: Compiled successfully — App.tsx 和 ImagePreview.tsx 接口现在匹配

- [ ] **Step 3: 提交（合并 Task 15 + 16 的改动）**

```bash
git add src/renderer/App.tsx src/renderer/components/gallery/ImagePreview.tsx
git commit -m "feat(preview): rewrite ImagePreview with shared-element transition and PNG copy fix"
```

- [ ] **Step 4: 手动验证动画与复制**

Run: `npm run dev`
Manual checks:
- 点击缩略图：图片从缩略图坐标 spring 展开到全屏；缩略图位置变空（opacity:0）
- ESC / 点遮罩 / 工具栏外其它点击：图片缩回原坐标，缩略图恢复
- 切换月份后再点图：动画从新缩略图坐标出发
- 点工具栏复制按钮（在 JPEG 图片上）：messageApi 显示"已复制"，剪贴板能粘贴出 PNG

如果上述任何一点未达，**回滚 commit 并修复**，不要继续下一阶段。

---

## Phase 3 — 多选 UI

### Task 17: 在 PinterestGrid 添加 selectedIds prop 与点击路由

**Files:**
- Modify: `src/renderer/components/gallery/PinterestGrid.tsx` (props + handler)

- [ ] **Step 1: 更新 props 接口（在已修改后的位置）**

```tsx
interface PinterestGridProps {
    images: Image[];
    onImageSelect?: (image: Image) => void;
    previewingImageId?: number | null;
    selectedIds: number[];
    onSelectionChange: (ids: number[]) => void;
}
```

- [ ] **Step 2: 更新组件签名**

```tsx
export const PinterestGrid: React.FC<PinterestGridProps & { columnCount?: number }> = ({
    images,
    onImageSelect,
    previewingImageId,
    selectedIds,
    onSelectionChange,
    columnCount,
}) => {
```

- [ ] **Step 3: 在 `containerRef` 之后追加 lastSelectedId ref + 清空联动**

```tsx
    const lastSelectedIdRef = useRef<number | null>(null);

    // Spec: lastSelectedId resets to null when selectedIds is cleared.
    // Otherwise Shift+click after a clear would draw a range from a stale anchor.
    useEffect(() => {
        if (selectedIds.length === 0) {
            lastSelectedIdRef.current = null;
        }
    }, [selectedIds]);
```

- [ ] **Step 4: 在 `handleDownload` 之前添加 click 路由**

```tsx
    const isSelectionMode = selectedIds.length > 0;

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
```

- [ ] **Step 5: 把卡片 onClick 替换为 handleCardClick**

```tsx
                    <div
                        key={image.id}
                        className="group relative mb-4 break-inside-avoid cursor-pointer overflow-hidden rounded-lg bg-white transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
                        style={{ opacity: previewingImageId === image.id ? 0 : 1 }}
                        onClick={(e) => handleCardClick(e, image)}
                    >
```

- [ ] **Step 6: 验证 build（先把 ImageViews/App 透传 selectedIds，否则 type error）— 暂不 build，进入下个任务**

---

### Task 18: 在 ImageViews 透传 selectedIds / onSelectionChange

**Files:**
- Modify: `src/renderer/components/gallery/ImageViews.tsx`

- [ ] **Step 1: 更新 props 接口**

```tsx
interface ImageViewsProps {
  images: Image[];
  loading: boolean;
  onImageSelect?: (image: Image) => void;
  columnCount?: number;
  previewingImageId?: number | null;
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
}
```

- [ ] **Step 2: 更新组件签名**

```tsx
export const ImageViews: React.FC<ImageViewsProps> = ({
  images,
  loading,
  onImageSelect,
  columnCount,
  previewingImageId,
  selectedIds,
  onSelectionChange,
}) => {
```

- [ ] **Step 3: 把新 props 透传给 PinterestGrid**

```tsx
          <PinterestGrid
            images={images}
            onImageSelect={onImageSelect}
            columnCount={columnCount}
            previewingImageId={previewingImageId}
            selectedIds={selectedIds}
            onSelectionChange={onSelectionChange}
          />
```

- [ ] **Step 4: 暂不 build，下个任务把 App.tsx 接上**

---

### Task 19: 在 App.tsx 把 selectedIds Redux 接到 ImageViews

**Files:**
- Modify: `src/renderer/App.tsx:7,38,267-276`

- [ ] **Step 1: 在 imageSlice import（line 7）追加 setSelectedIds**

```tsx
import { setImages, setLoading, setCurrentMonth, setSortField, setSortOrder, setSelectedIds } from './store/slices/imageSlice';
```

- [ ] **Step 2: 在 useSelector（line 38）追加 selectedIds 解构**

```tsx
  const { images, loading, sortField, sortOrder, currentMonth, selectedIds } = useSelector((state: RootState) => state.images);
```

- [ ] **Step 3: 把 selectedIds / onSelectionChange 传给 ImageViews**

```tsx
            <ImageViews
              images={filteredImages}
              loading={loading}
              onImageSelect={(image) => {
                setPreviewingImage(image);
                setPreviewVisible(true);
              }}
              columnCount={columnCount}
              previewingImageId={previewingImage?.id ?? null}
              selectedIds={selectedIds}
              onSelectionChange={(ids) => dispatch(setSelectedIds(ids))}
            />
```

- [ ] **Step 4: 验证 build**

Run: `npm run build:react`
Expected: Compiled successfully

- [ ] **Step 5: 合并 Task 17/18/19 提交**

```bash
git add src/renderer/components/gallery/PinterestGrid.tsx src/renderer/components/gallery/ImageViews.tsx src/renderer/App.tsx
git commit -m "feat(grid): wire selection state with Ctrl/Shift/normal click routing"
```

---

### Task 20: 在 PinterestGrid 添加复选框角标（始终可见）

**Files:**
- Modify: `src/renderer/components/gallery/PinterestGrid.tsx` (卡片内部插入)

- [ ] **Step 1: 在 motion.img 之后、download button 之前插入复选框 div**

```tsx
                        <motion.img
                            layoutId={`img-${image.id}`}
                            src={getImageUrl(image)}
                            alt=""
                            className="block h-auto w-full object-cover"
                            loading="lazy"
                            style={{ borderRadius: '8px' }}
                        />
                        <div
                            className={`absolute top-2 left-2 z-20 flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                                selectedIds.includes(image.id)
                                    ? 'border-blue-500 bg-blue-500'
                                    : 'border-gray-300 bg-white/40'
                            }`}
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleId(image.id);
                                lastSelectedIdRef.current = image.id;
                            }}
                        >
                            {selectedIds.includes(image.id) && (
                                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </div>
```

- [ ] **Step 2: 验证 build + 视觉检查**

Run: `npm run build:react` → Compiled successfully

Run: `npm run dev`，观察缩略图左上角是否每张都有半透明灰色空圆框（未选）；点角标 → 变蓝勾；再点 → 取消。

- [ ] **Step 3: 提交**

```bash
git add src/renderer/components/gallery/PinterestGrid.tsx
git commit -m "feat(grid): add always-visible checkbox corner overlay"
```

---

### Task 21: 在 PinterestGrid 添加橡皮筋框选

**Files:**
- Modify: `src/renderer/components/gallery/PinterestGrid.tsx`

- [ ] **Step 1: 在 lastSelectedIdRef 之后追加状态**

```tsx
    const [rubberBand, setRubberBand] = useState<{
        startX: number;
        startY: number;
        endX: number;
        endY: number;
    } | null>(null);
    const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
```

- [ ] **Step 2: 在 handleCardClick 之后添加橡皮筋 handler**

```tsx
    const handleContainerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.button !== 0) return; // 仅左键
        const target = e.target as HTMLElement;
        // 仅在网格空白起手；命中 motion.img / 复选框 / button 时跳过（由卡片 onClick 处理）
        if (target.closest('img,button,[data-checkbox]')) return;

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
            // 追加（保留已选），按 Shift 时同样追加；不区分以简化模型
            const merged = new Set([...selectedIds, ...hitIds]);
            onSelectionChange(Array.from(merged));
        }
        setRubberBand(null);
    };
```

- [ ] **Step 3: 在 container div 上挂载事件 + 渲染矩形**

替换原 container div：

```tsx
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
```

- [ ] **Step 4: 在卡片 div 上注册 ref**

```tsx
                    <div
                        key={image.id}
                        ref={(el) => {
                            if (el) itemRefs.current.set(image.id, el);
                            else itemRefs.current.delete(image.id);
                        }}
                        className="group relative mb-4 break-inside-avoid cursor-pointer overflow-hidden rounded-lg bg-white transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
                        style={{ opacity: previewingImageId === image.id ? 0 : 1 }}
                        onClick={(e) => handleCardClick(e, image)}
                    >
```

并在复选框 div 上加 `data-checkbox` 标记，避免 mousedown 在角标上触发橡皮筋：

```tsx
                        <div
                            data-checkbox
                            className={`absolute top-2 left-2 z-20 ...`}
```

- [ ] **Step 5: 验证 build + 手动测试**

Run: `npm run build:react` → Compiled successfully

Run: `npm run dev`：
- 在网格空白处按住左键拖拽 → 蓝色半透明矩形出现 → 松开 → 与矩形相交的图都被选中（角标变蓝勾）
- 在缩略图上按住拖拽 → 不应启动矩形（仍触发卡片 onClick）

- [ ] **Step 6: 提交**

```bash
git add src/renderer/components/gallery/PinterestGrid.tsx
git commit -m "feat(grid): add rubber-band rectangle selection"
```

---

## Phase 4 — SelectionBar + 批量删除入口

### Task 22: 创建 SelectionBar 组件

**Files:**
- Create: `src/renderer/components/gallery/SelectionBar.tsx`

- [ ] **Step 1: 创建文件**

```tsx
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
```

- [ ] **Step 2: 验证编译**

Run: `npm run build:react`
Expected: 文件本身编译通过；尚未在任何地方使用，无功能验证

- [ ] **Step 3: 提交**

```bash
git add src/renderer/components/gallery/SelectionBar.tsx
git commit -m "feat(selection): add floating SelectionBar component"
```

---

### Task 23: 在 ImageViews 挂载 SelectionBar

**Files:**
- Modify: `src/renderer/components/gallery/ImageViews.tsx`

- [ ] **Step 1: import SelectionBar**

```tsx
import { SelectionBar } from './SelectionBar';
```

- [ ] **Step 2: props 接口加 onDeleteSelected**

```tsx
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
```

- [ ] **Step 3: 组件签名加 onDeleteSelected**

```tsx
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
```

- [ ] **Step 4: 在 JSX 末尾（return 的最外层 div 内）追加 SelectionBar**

把 return 的最外层结构改为：

```tsx
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
```

- [ ] **Step 5: 暂不 build——下个任务在 App.tsx 接上 onDeleteSelected**

---

### Task 24: 在 App.tsx 添加 handleDeleteSelected

**Files:**
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: import Modal 与 removeImages action**

修改 line 2 与 line 7：

```tsx
import { Layout, Button, ConfigProvider, App as AntdApp, Modal } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { setImages, setLoading, setCurrentMonth, setSortField, setSortOrder, setSelectedIds, removeImages } from './store/slices/imageSlice';
```

- [ ] **Step 2: 在 useImageAPI 解构里加 deleteImages**

```tsx
  const { scanImages, getMonths, getImages, deleteImages: deleteImagesApi, deleteMonthImages } = useImageAPI();
```

- [ ] **Step 3: 在 handleReset 之前添加 handleDeleteSelected**

```tsx
  const handleDeleteSelected = () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: `将永久删除已选的 ${ids.length} 张图片，此操作不可撤销。`,
      okText: `删除 ${ids.length} 张`,
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          // If a previewing image is being deleted, close preview first.
          if (previewingImage && ids.includes(previewingImage.id)) {
            setPreviewVisible(false);
          }
          const result = await deleteImagesApi(ids);
          if (result?.success) {
            dispatch(removeImages(ids));
            messageApi.success(`已删除 ${result.deleted} 张图片`);
            // Refresh months count
            await loadMonths();
          } else {
            messageApi.error(`删除失败：成功 ${result?.deleted ?? 0} / 失败 ${result?.failed ?? ids.length}`);
          }
        } catch (err) {
          console.error('Delete failed:', err);
          messageApi.error('删除失败');
        }
      },
    });
  };
```

- [ ] **Step 4: 把 onDeleteSelected 传给 ImageViews**

在 ImageViews 元素上追加：

```tsx
              onDeleteSelected={handleDeleteSelected}
```

- [ ] **Step 5: 验证 build + 手测**

Run: `npm run build:react` → Compiled successfully

Run: `npm run dev`：
- 选中几张 → SelectionBar 浮现
- 点全选 → 全部选中
- 点 ✕ → 选择清空，bar 消失
- 点删除 → Modal 确认 → 确认 → 文件物理删除 + DB 行消失 + 网格刷新
- 选中正被预览的图后删除 → 预览先关再删

- [ ] **Step 6: 提交**

```bash
git add src/renderer/App.tsx src/renderer/components/gallery/ImageViews.tsx
git commit -m "feat(delete): wire batch delete with Modal.confirm and preview-aware close"
```

---

## Phase 5 — 月份删除

### Task 25: 在 TopFilterBar 月份 tag 上添加 hover × 按钮

**Files:**
- Modify: `src/renderer/components/filters/TopFilterBar.tsx`

- [ ] **Step 1: 更新 props 接口（line 23-33）**

```tsx
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
```

- [ ] **Step 2: 组件签名加 onDeleteMonth**

```tsx
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
```

- [ ] **Step 3: 引入 CloseCircleFilled 图标（line 3-11）**

```tsx
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
```

- [ ] **Step 4: 替换月份 tag 渲染（line 107-121）**

```tsx
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
```

- [ ] **Step 5: 暂不 build——下个任务把 onDeleteMonth 在 App.tsx 接上**

---

### Task 26: 在 App.tsx 添加 handleDeleteMonth

**Files:**
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: 在 handleDeleteSelected 之后添加 handleDeleteMonth**

```tsx
  const handleDeleteMonth = (yearMonth: string) => {
    const target = months.find((m) => m.yearMonth === yearMonth);
    const count = target?.count ?? 0;
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: `将永久删除 ${yearMonth} 的全部 ${count} 张图片文件，此操作不可撤销。`,
      okText: `删除 ${count} 张`,
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          // If currently previewing an image from this month, close preview.
          if (previewingImage && previewingImage.fileTime?.startsWith(yearMonth)) {
            setPreviewVisible(false);
          }
          const result = await deleteMonthImages(yearMonth);
          if (result?.success) {
            messageApi.success(`已删除 ${result.deleted} 张图片`);
            // Reload months and current view
            await loadMonths();
            if (currentMonth === yearMonth) {
              dispatch(setCurrentMonth(null));
              const allImages = await getImages({ yearMonth: '', offset: 0, limit: -1 });
              dispatch(setImages(allImages || []));
            } else {
              // Just remove the deleted ids from current store
              const currentImageIds = images.filter((img) => img.fileTime?.startsWith(yearMonth)).map((img) => img.id);
              if (currentImageIds.length > 0) dispatch(removeImages(currentImageIds));
            }
          } else {
            messageApi.error(`删除失败：成功 ${result?.deleted ?? 0} / 失败 ${result?.failed ?? 0}`);
          }
        } catch (err) {
          console.error('Delete month failed:', err);
          messageApi.error('删除失败');
        }
      },
    });
  };
```

- [ ] **Step 2: 把 onDeleteMonth 传给 TopFilterBar（line 241-251）**

```tsx
      <TopFilterBar
        months={months}
        currentMonth={currentMonth}
        onMonthSelect={handleMonthClick}
        onDeleteMonth={handleDeleteMonth}
        columnCount={columnCount}
        onColumnCountChange={setColumnCount}
        scanning={scanning}
        scanProgress={progress}
        onScan={handleScan}
        onOpenSettings={() => setSettingsVisible(true)}
      />
```

- [ ] **Step 3: 验证 build + 手测**

Run: `npm run build:react` → Compiled successfully

Run: `npm run dev`：
- hover 月份 tag → 红色 × 按钮 fade-in
- 点 × → Modal 确认 → 确认 → 文件物理删除 + 月份消失 + 当前视图刷新
- 删除当前正在浏览的月份 → 自动切到"全部"

- [ ] **Step 4: 提交**

```bash
git add src/renderer/components/filters/TopFilterBar.tsx src/renderer/App.tsx
git commit -m "feat(delete): hover-X month delete with Modal.confirm and view recovery"
```

---

## Phase 6 — ESC 优先级 + 集成测试

### Task 27: 更新 ESC 键 handler 优先级

**Files:**
- Modify: `src/renderer/App.tsx:84-92` (escape shortcut handler)

- [ ] **Step 1: 替换 escape handler**

```tsx
    {
      key: 'escape',
      description: 'Close modals or clear selection',
      handler: () => {
        if (previewVisible) {
          setPreviewVisible(false);
          return;
        }
        if (settingsVisible) {
          setSettingsVisible(false);
          return;
        }
        if (selectedIds.length > 0) {
          dispatch(setSelectedIds([]));
        }
      },
    },
```

- [ ] **Step 2: 验证 build + 手测**

Run: `npm run build:react` → Compiled successfully

Run: `npm run dev`：
- 预览打开 + 已有选中 → ESC 关预览（保留 selectedIds）→ 再 ESC 清空 selectedIds
- 设置打开 + 已有选中 → ESC 关设置（保留 selectedIds）→ 再 ESC 清空 selectedIds
- 仅选中无预览/设置 → ESC 直接清空选择

- [ ] **Step 3: 提交**

```bash
git add src/renderer/App.tsx
git commit -m "feat(shortcuts): ESC priority preview > settings > selection"
```

---

### Task 28: 全量测试矩阵走查

**Files:** 不修改代码，仅验证

- [ ] **Step 1: 运行所有自动化检查**

Run: `npm run lint`
Expected: 0 错误

Run: `npm run test:unit`
Expected: 所有 db-service 与 file-service 测试通过

Run: `npm run build`
Expected: dist/main 与 dist/renderer 全部产出，无错误

- [ ] **Step 2: 手测矩阵 — 单功能**

启动 `npm run dev`，逐项核对（参考 spec 的"测试矩阵"章节）：

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

- [ ] **Step 3: 手测矩阵 — 新交叉场景**

- [ ] 多选模式下单击图片 → 切换选中，**不**触发预览动画
- [ ] 多选模式下按 ESC → 清空 selectedIds（**不**关闭预览，因为预览未开）
- [ ] 预览打开 + 多选已激活 → ESC 关预览（保留 selectedIds）→ 再 ESC 清空 selectedIds
- [ ] 在缩略图上 mousedown 拖拽 → 不应启动橡皮筋
- [ ] 多选模式下 Ctrl+click 一张未选 → 加入选中
- [ ] 删除已选中包含正被预览的那张 → 先关预览，再执行删除
- [ ] 复选框角标在 layoutId 动画过程中：随缩略图卡片整体 opacity:0
- [ ] 删除月份后预览中的图片若属于该月 → 关预览
- [ ] selectedIds 中包含已被"删除月份"操作清掉的 id → removeImages 后 selectedIds 自动同步过滤
- [ ] Shift+click 在 lastSelectedId 为 null 时 → 退化为单选

- [ ] **Step 4: 若全部通过，最终提交（仅当前述任何修复需要时）**

```bash
git status
# 若仍有未提交改动，commit；否则跳过
```

---

## 自检清单（计划级，给执行者参考）

执行完所有任务后核对：

1. **Spec 全覆盖：**
   - Apple Photos 共享元素（Task 13-16）✓
   - 复制 fix（Task 16 内的 blobToPng）✓
   - 删除月份（Task 25-26）✓
   - 框选（Task 21）✓
   - Ctrl/Shift+click（Task 17）✓
   - 复选框始终可见（Task 20）✓
   - SelectionBar（Task 22-24）✓
   - ESC 优先级（Task 27）✓
   - IPC 删除链路（Task 5-12）✓
   - 状态命名重构（Task 4）✓
   - 类型 DeleteResult（Task 2）✓

2. **没有遗留：**
   - lint 0 错误
   - 单测全过
   - build 产物完整

3. **README 等文档无需更新**（spec 隐含此为内部实现，无对外 API 变化）。
