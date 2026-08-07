param($silent)
$logPath = "C:\auto-deploy.log"
cd C:\ai-sales-coach

# 拉取最新代码
git fetch gitee master 2>$null
$local = git rev-parse HEAD
$remote = git rev-parse FETCH_HEAD 2>$null

if ($local -ne $remote -and $remote) {
    Add-Content $logPath "[$(Get-Date)] 发现更新"
    if (-not $silent) { Write-Host "发现更新，正在部署..." -ForegroundColor Yellow }
    
    # 拉取最新代码并重启
    # ⚠️ 始终使用 ecosystem.config.cjs 启动，确保 JWT_SECRET 等环境变量正确注入
    #    `pm2 start dist/index.js --name "ai-sales-coach"` 会丢失 env 块配置
    git pull gitee master --ff-only 2>$null
    if ($LASTEXITCODE -eq 0) {
        pm2 restart ai-sales-coach --update-env 2>$null
        if ($LASTEXITCODE -ne 0) {
            # 首次部署：进程不存在，用 ecosystem 创建
            pm2 start C:\ai-sales-coach\ecosystem.config.cjs 2>$null
        }
        pm2 save 2>$null
        Add-Content $logPath "[$(Get-Date)] 部署完成"
        if (-not $silent) { Write-Host "部署完成！" -ForegroundColor Green }
    } else {
        Add-Content $logPath "[$(Get-Date)] 拉取失败"
        if (-not $silent) { Write-Host "拉取失败" -ForegroundColor Red }
    }
} else {
    if (-not $silent) { Write-Host "已是最新" -ForegroundColor Cyan }
}
