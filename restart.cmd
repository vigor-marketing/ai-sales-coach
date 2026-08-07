@echo off
chcp 65001 >nul
echo [%date% %time%] 正在启动AI销售陪练系统...

:: Kill any existing processes on our ports (避免端口冲突)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173 " ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5174 " ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
timeout /t 2 /nobreak >nul

:: First build frontend to ensure latest
cd /d "C:\Users\Monk Chen\WorkBuddy\2026-07-03-15-41-15\apps\web"
"C:\Users\Monk Chen\.workbuddy\binaries\node\versions\22.22.2\node.exe" ./node_modules/vite/bin/vite.js build >nul 2>&1

:: 启动后端
@start "" "C:\Users\Monk Chen\.workbuddy\binaries\node\versions\22.22.2\node.exe" "C:\Users\Monk Chen\WorkBuddy\2026-07-03-15-41-15\apps\server\dist\index.js"
timeout /t 2 /nobreak >nul

:: 启动前端 5173（Vite 开发模式，带热更新）
@start "" "C:\Users\Monk Chen\.workbuddy\binaries\node\versions\22.22.2\node.exe" "C:\Users\Monk Chen\WorkBuddy\2026-07-03-15-41-15\apps\web\node_modules\vite\bin\vite.js" --host
timeout /t 2 /nobreak >nul

:: 启动前端 5174（生产静态模式，兼容手机/微信浏览器）
@start "" "C:\Users\Monk Chen\.workbuddy\binaries\node\versions\22.22.2\node.exe" "C:\Users\Monk Chen\WorkBuddy\2026-07-03-15-41-15\serve-static-5174.js"

echo.
echo ✅ 后端 (3000) + 前端 (5173) + 前端 (5174) 已启动
echo.
echo 访问地址: http://localhost:5173 或 http://localhost:5174
echo 关闭此窗口不影响服务运行。
timeout /t 5 /nobreak >nul
