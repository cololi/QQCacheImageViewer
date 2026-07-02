# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (starts all three processes concurrently)
npm run dev

# Build
npm run build

# Package
npm run dist          # NSIS installer
npm run dist:portable # Portable EXE

# Testing
npm test              # React scripts test runner (renderer tests)
npm run test:unit     # Jest unit tests (main process services)
npm run test:coverage # Coverage report (30% threshold enforced)

# Lint
npm run lint
npm run lint:fix
```

Run a single test file:

```bash
npx jest src/main/services/__tests__/db-service.test.ts
```

## Architecture

This is an **Electron 28 + React 18** desktop app. The process boundary is strict:

**Main process** (`src/main/`) — Node.js, compiled via `tsc -p src/main/tsconfig.json` → `dist/main/`:

- `index.ts` — App entry, registers all IPC handlers, registers `local-resource://` protocol for serving local image files to the renderer
- `services/image-scanner.ts` — Detects QQ cache paths under Windows `Documents` and scans directories, extracting image metadata
- `services/db-service.ts` — SQLite via `better-sqlite3`; stores image records (hash, path, dimensions, month, size)
- `services/thumbnail-cache.ts` — `sharp`-based thumbnail generation with disk cache
- `services/file-service.ts` — Copy, delete (recycle bin), ZIP export, OS dialogs
- `services/settings-service.ts` — `electron-store` persistence for user preferences

**Renderer process** (`src/renderer/`) — React, compiled via `react-scripts` → `dist/renderer/`:

- `App.tsx` — Root; wires Redux store, i18n, Ant Design config, and top-level layout
- `components/gallery/` — `PinterestGrid.tsx` (masonry layout), `ImageViews.tsx`, `ImagePreview.tsx` (fullscreen modal)
- `components/filters/` — `FilterPanel.tsx`, `TopFilterBar.tsx`
- `store/slices/` — `imageSlice.ts`, `filterSlice.ts`, `settingsSlice.ts` (Redux Toolkit)
- `hooks/useImageAPI.ts` — All IPC calls to main process go through this hook

**IPC contract** — `src/shared/types.ts` and `src/shared/settings-types.ts` define the types shared across both processes. `preload.ts` exposes `window.electron.ipcRenderer.{invoke, on, off}` — the only bridge.

**Path aliases**: `@main/*`, `@renderer/*`, `@shared/*` configured in both `tsconfig.json` and `jest.config.js`.

**Build output**: React build goes to `build/`, main TS goes to `dist/main/`, then `scripts/move-build.js` relocates everything to `dist/` for `electron-builder`. Packaged output lands in `release/`.

## Key Constraints

- Windows-only app (QQ cache paths are Windows-specific `%USERPROFILE%\Documents\Tencent Files\`)
- `better-sqlite3` and `sharp` are native modules — must use `electron-rebuild` after changing Electron version
- The `local-resource://` custom protocol is required because `file://` is blocked by Electron's security model for renderer-loaded pages served from `localhost:3001` in dev
