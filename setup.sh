#!/bin/bash

# QQ 缓存图片查看器 - 快速启动脚本
# 该脚本自动处理 fnm 版本管理和项目初始化

echo "================================"
echo "QQ 缓存图片查看器 - 项目初始化"
echo "================================"
echo ""

# 1. 检查 fnm 是否安装
if ! command -v fnm &> /dev/null; then
    echo "❌ 未找到 fnm (Fast Node Manager)"
    echo ""
    echo "请安装 fnm:"
    echo "  Windows: scoop install fnm"
    echo "  macOS:   brew install fnm"
    echo "  Linux:   curl -fsSL https://fnm.io/install | bash"
    echo ""
    exit 1
fi

echo "✅ fnm 已安装"
echo ""

# 2. 读取 .node-version 文件
if [ -f ".node-version" ]; then
    TARGET_VERSION=$(cat .node-version)
    echo "📝 目标 Node.js 版本: $TARGET_VERSION"
else
    echo "❌ 未找到 .node-version 文件"
    exit 1
fi

# 3. 使用 fnm 安装目标版本（如需要）
echo ""
echo "🔍 检查 Node.js 版本..."
CURRENT_VERSION=$(node --version 2>/dev/null | cut -d'v' -f2)

if [ -z "$CURRENT_VERSION" ]; then
    echo "⬇️  安装 Node.js $TARGET_VERSION..."
    fnm install $TARGET_VERSION
else
    MAJOR_VERSION=$(echo $CURRENT_VERSION | cut -d'.' -f1)
    TARGET_MAJOR=$(echo $TARGET_VERSION | cut -d'.' -f1)

    if [ "$MAJOR_VERSION" != "$TARGET_MAJOR" ]; then
        echo "⬇️  安装 Node.js $TARGET_VERSION..."
        fnm install $TARGET_VERSION
    else
        echo "✅ Node.js 版本 $CURRENT_VERSION 已匹配"
    fi
fi

# 4. 切换到目标版本
echo ""
echo "🔄 切换到 Node.js $TARGET_VERSION..."
fnm use $TARGET_VERSION

# 5. 验证版本
echo ""
echo "验证版本:"
echo "  Node.js: $(node --version)"
echo "  npm: $(npm --version)"
echo ""

# 6. 安装依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装项目依赖..."
    npm install
    echo ""
fi

# 7. 显示可用命令
echo "================================"
echo "✅ 项目初始化完成！"
echo "================================"
echo ""
echo "可用命令:"
echo "  npm run dev     - 启动开发模式"
echo "  npm run build   - 构建项目"
echo "  npm run pack    - 打包应用"
echo "  npm run dist    - 构建发行版"
echo "  npm test        - 运行测试"
echo ""
echo "开始开发: npm run dev"
echo ""
