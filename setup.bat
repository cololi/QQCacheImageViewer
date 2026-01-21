@echo off
REM QQ 缓存图片查看器 - 快速启动脚本 (Windows)
REM 该脚本自动处理 fnm 版本管理和项目初始化

cls
echo ================================
echo QQ 缓存图片查看器 - 项目初始化
echo ================================
echo.

REM 1. 检查 fnm 是否安装
where fnm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 未找到 fnm (Fast Node Manager)
    echo.
    echo 请安装 fnm:
    echo   - Windows (Scoop): scoop install fnm
    echo   - Windows (Choco): choco install fnm
    echo   - 官方安装器: https://github.com/Schniz/fnm/releases
    echo.
    pause
    exit /b 1
)

echo ✅ fnm 已安装
echo.

REM 2. 读取 .node-version 文件
if not exist ".node-version" (
    echo ❌ 未找到 .node-version 文件
    pause
    exit /b 1
)

for /f "delims=" %%i in (.node-version) do set TARGET_VERSION=%%i
echo 📝 目标 Node.js 版本: %TARGET_VERSION%
echo.

REM 3. 检查当前 Node.js 版本
echo 🔍 检查 Node.js 版本...
node --version >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ⬇️  安装 Node.js %TARGET_VERSION%...
    call fnm install %TARGET_VERSION%
) else (
    for /f "delims=" %%i in ('node --version') do set CURRENT_VERSION=%%i
    echo ✅ 当前版本: %CURRENT_VERSION%
)

REM 4. 切换到目标版本
echo.
echo 🔄 切换到 Node.js %TARGET_VERSION%...
call fnm use %TARGET_VERSION%

REM 5. 验证版本
echo.
echo 验证版本:
echo   Node.js:
node --version
echo   npm:
npm --version
echo.

REM 6. 安装依赖
if not exist "node_modules" (
    echo 📦 安装项目依赖...
    call npm install
    echo.
)

REM 7. 显示可用命令
echo ================================
echo ✅ 项目初始化完成！
echo ================================
echo.
echo 可用命令:
echo   npm run dev     - 启动开发模式
echo   npm run build   - 构建项目
echo   npm run pack    - 打包应用
echo   npm run dist    - 构建发行版
echo   npm test        - 运行测试
echo.
echo 开始开发: npm run dev
echo.
pause
