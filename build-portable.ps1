# 解决 electron-builder 符号链接权限问题
# 通过设置环境变量跳过签名验证

Write-Host "=== Electron Builder 打包脚本 ===" -ForegroundColor Cyan
Write-Host ""

# 设置环境变量跳过代码签名
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"

Write-Host "✓ 已禁用代码签名" -ForegroundColor Green
Write-Host ""
Write-Host "开始打包..." -ForegroundColor Yellow
Write-Host ""

# 执行打包
npm run dist

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "=== 打包成功 ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "查看输出文件:" -ForegroundColor Cyan
    Get-ChildItem release/*.exe | Select-Object Name, @{Name = "Size(MB)"; Expression = { [math]::Round($_.Length / 1MB, 2) } }
}
else {
    Write-Host ""
    Write-Host "=== 打包失败 ===" -ForegroundColor Red
    Write-Host "错误代码: $LASTEXITCODE" -ForegroundColor Red
}
