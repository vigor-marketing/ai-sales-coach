@echo off
cd /d C:\ai-sales-coach
echo [1/4] 停止服务...
pm2 stop ai-sales-coach >nul 2>&1
echo [2/4] 强制同步最新代码...
git fetch gitee master
git reset --hard gitee/master
echo [3/4] 重建前端...
cd apps\web
call npx vite build
echo [4/4] 启动服务...
cd ..\..
pm2 start apps\server\dist\index.js --name "ai-sales-coach"
pm2 save
echo.
echo ===== 部署完成! =====
echo 访问 http://localhost:3000
pause