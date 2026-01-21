# QQ 缓存图片查看器 (QQ Cache Image Viewer)

![Build Status](https://github.com/yourusername/QQCacheImageViewer/actions/workflows/ci.yml/badge.svg)

一个基于 Electron + React 开发的强大桌面工具，专为 QQ 缓存图片的 **自动化检索、智能管理与便捷浏览** 而设计。它能够穿透复杂的文件夹结构，将凌乱的缓存数据转化为井然有序的高清图库。

## ✨ 主要功能

- 🚀 **全自动路径识别** - 智能搜索 Windows 文档目录，自动识别并聚合所有 QQ 帐号下的缓存路径。
- 🖼️ **多维度视角切换** - 提供灵动的瀑布流 (Pinterest Style)、经典的网格视图及详细的列表模式。
- 🔍 **极致过滤与搜索** - 支持按文件大小、图片尺寸（宽高比）、修改时间以及文件名进行实时检索。
- 📊 **智能分类索引** - 自动按月份颗粒度归档，支持按文件属性进行动态排序与聚合展示。
- 📥 **批量导出与管理** - 支持一键将选中的素材打包为 `.zip` 压缩包，或进行本地化磁盘管理。
- 🌙 **现代感交互设计** - 内建完善的深色/浅色主题适配，支持流畅的键盘快捷键导航与全屏预览。
- 🌐 **国际化支持** - 深度适配中英文双语界面。

## 📦 安装

### 前置要求
- **Node.js** 18+（使用 fnm 管理）
- **fnm** (Fast Node Manager) - [安装指南](https://github.com/Schniz/fnm)

### 快速初始化（推荐）

使用自动化脚本进行初始化，无需手动操作：

**Windows:**
```bash
git clone https://github.com/yourusername/QQCacheImageViewer.git
cd QQCacheImageViewer
setup.bat
```

**macOS/Linux:**
```bash
git clone https://github.com/yourusername/QQCacheImageViewer.git
cd QQCacheImageViewer
chmod +x setup.sh
./setup.sh
```

## 🚀 开发

### 启动开发服务器
```bash
npm run dev
```

### 构建
```bash
npm run build
```

### 打包应用 (便携版)
如果你在打包安装程序时遇到权限问题，可以使用以下命令生成便携版：
```bash
# 生成便携版文件夹
npm run dist:portable

# 生成便携版压缩包 (推荐用于分发)
npm run archive:portable

# 一键生成压缩包
npm run build:release
```

便携版将生成在 `release-portable/` 目录下。

### 打包应用 (安装程序)
```bash
npm run dist
```

## 📋 项目文档

开发前请先阅读这些文档（按优先级）：

1. **⭐ [项目概览 (PRD)](./.agent/docs/prd/overview.md)** - **新！** 详细的项目背景、核心能力与技术定义
2. **⭐ [DETAILED_ANALYSIS.md](./DETAILED_ANALYSIS.md)** - **必读！** 基于真实 QQ 缓存结构的深度分析和优化方案
3. **[GETTING_STARTED.md](./GETTING_STARTED.md)** - 快速开始指南和项目初始化
4. **[TODO.md](./TODO.md)** - 功能规划和开发阶段
5. **[REQUIREMENTS.md](./REQUIREMENTS.md)** - 详细需求和技术设计
6. **[CLAUDE.md](./CLAUDE.md)** - 开发指南和编码规范

## 🛠️ 技术栈

- **框架**: Electron + React 18
- **语言**: TypeScript
- **UI 库**: Ant Design
- **状态管理**: Redux Toolkit
- **数据库**: SQLite
- **图片处理**: Sharp

## 📖 使用说明

### 首次运行
1. 打开应用
2. 在设置中配置 QQ 缓存路径（默认自动检测）
3. 点击"扫描"按钮开始扫描图片

### 快捷键
| 快捷键 | 功能 |
|--------|------|
| `Ctrl+F` | 搜索 |
| `Ctrl+A` | 全选 |
| `Delete` | 删除选中 |
| `Ctrl+C` | 复制 |
| `Space` | 全屏预览 |

## 📄 许可

MIT License

## ⚠️ 免责声明

- 本应用仅用于浏览已有的缓存图片
- 使用此应用时请遵守相关法律法规

---

**开始使用**: 详见 [GETTING_STARTED.md](./GETTING_STARTED.md)
