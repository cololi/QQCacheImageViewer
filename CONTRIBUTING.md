# 贡献指南

感谢你对本项目的关注！以下是参与贡献的流程和规范。

## 开发环境

1. Fork 本仓库并克隆到本地
2. 安装 Node.js 20（版本见 `.node-version`）
3. 安装依赖：`npm install`
4. 启动开发模式：`npm run dev`

### 环境要求

- Node.js 20
- Windows 系统（应用依赖 Windows 文件路径）

## 开发流程

1. 从 `main` 分支创建功能分支：`git checkout -b feat/your-feature`
2. 开发并确保通过 lint 检查：`npm run lint`
3. 如有涉及，编写或更新测试
4. 提交代码（遵守下方提交规范）
5. 推送并创建 Pull Request

## 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/) 格式：

```
<类型>(<范围>): <描述>

[可选正文]

[可选脚注]
```

### 类型

| 类型       | 说明                   |
| ---------- | ---------------------- |
| `feat`     | 新功能                 |
| `fix`      | 修复 Bug               |
| `docs`     | 文档变更               |
| `style`    | 代码格式（不影响逻辑） |
| `refactor` | 重构                   |
| `perf`     | 性能优化               |
| `test`     | 测试                   |
| `chore`    | 构建/工具变更          |

### 示例

```
feat(scanner): 支持自定义扫描路径
fix(preview): 修复大图预览时内存溢出
docs: 更新安装说明
```

## Pull Request 规范

- PR 标题遵循提交规范格式
- 描述中说明改动内容和原因
- 关联相关 Issue（如有）
- 确保 CI 通过

## 项目架构

```
src/main/        → Electron 主进程（Node.js 环境）
src/renderer/    → React 渲染进程（浏览器环境）
src/shared/      → 共享类型定义
```

主进程与渲染进程通过 IPC 通信，preload 脚本暴露安全的 API 桥接。

## 报告问题

请使用 [Issue 模板](https://github.com/Cololi/QQCacheImageViewer/issues/new/choose) 提交 Bug 报告或功能请求。
