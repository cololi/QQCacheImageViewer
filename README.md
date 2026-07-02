# QQ 缓存图片查看器

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0-green.svg)](package.json)

基于 Electron + React 的桌面工具，用于浏览和管理 Windows 本地 QQ 缓存图片。

## 功能

- **自动路径识别** — 扫描 Windows 文档目录，自动发现所有 QQ 帐号的缓存路径
- **瀑布流浏览** — Pinterest 风格图片网格，支持 4–10 列自由调节
- **多维度过滤** — 按月份、文件大小、图片方向（横/竖/方）、修改时间筛选
- **全屏预览** — 支持缩放、旋转、复制到剪贴板、另存为
- **批量导出** — 一键打包为 ZIP 或保存到指定目录
- **键盘快捷键** — 全键盘导航与操作

## 系统要求

- Windows 10 / 11
- Node.js 20（开发或从源码构建时需要，版本见 `.node-version`）

## 安装

### 下载预构建版本

前往 [Releases](https://github.com/Cololi/QQCacheImageViewer/releases) 页面下载最新版本，无需额外依赖。

### 从源码构建

请先安装 Node.js 20，然后在项目根目录执行：

```bash
git clone https://github.com/Cololi/QQCacheImageViewer.git
cd QQCacheImageViewer
npm ci
npm run dist           # 打包为安装程序（NSIS）
npm run dist:portable  # 打包为便携版
```

打包产物输出到 `release/` 目录。

## 开发

```bash
npm install          # 安装或更新开发依赖
npm run dev          # 启动开发模式（热重载）
npm test             # 运行测试
npm run lint         # 代码检查
npm run lint:fix     # 自动修复
```

## 快捷键

| 快捷键   | 功能     |
| -------- | -------- |
| `Ctrl+F` | 搜索     |
| `Ctrl+A` | 全选     |
| `Delete` | 删除选中 |
| `Ctrl+C` | 复制     |
| `Space`  | 全屏预览 |

## 技术栈

| 类别     | 技术                    |
| -------- | ----------------------- |
| 框架     | Electron 28 + React 18  |
| 语言     | TypeScript 5            |
| UI 库    | Ant Design 5            |
| 状态管理 | Redux Toolkit           |
| 数据库   | SQLite (better-sqlite3) |
| 图片处理 | Sharp                   |
| 样式     | Tailwind CSS            |

## 项目结构

```
src/
├── main/              # Electron 主进程
│   ├── index.ts       # 应用入口、IPC 处理
│   ├── preload.ts     # 预加载脚本
│   └── services/      # 业务逻辑（数据库、文件、扫描、缩略图）
├── renderer/          # React 渲染进程
│   ├── components/    # UI 组件（过滤器、画廊、设置）
│   ├── hooks/         # 自定义 Hooks
│   ├── store/         # Redux Store & Slices
│   └── styles/        # 全局样式
└── shared/            # 主/渲染进程共享类型
```

## 贡献

欢迎提交 Issue 和 Pull Request。请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 了解开发流程和提交规范。

## 许可证

[MIT](LICENSE)

## 免责声明

本工具仅用于浏览本地已有的 QQ 缓存图片，请遵守相关法律法规使用。
