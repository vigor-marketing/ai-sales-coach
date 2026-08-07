@echo off
chcp 65001 >nul
title AI销售陪练 - 数据库备份
echo ========================================
echo   AI销售陪练系统 - 数据库备份
echo ========================================
echo.

set DB_PATH=C:\Users\Monk Chen\WorkBuddy\2026-07-03-15-41-15\apps\server\prisma\dev.db
set BACKUP_DIR=C:\Users\Monk Chen\WorkBuddy\2026-07-03-15-41-15\backups

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

set TIMESTAMP=%DATE:~0,4%%DATE:~5,2%%DATE:~8,2%_%TIME:~0,2%%TIME:~3,2%%TIME:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%
set BACKUP_FILE=%BACKUP_DIR%\dev_%TIMESTAMP%.db

copy "%DB_PATH%" "%BACKUP_FILE%" >nul

echo   ✅ 备份成功!
echo   文件: %BACKUP_FILE%
echo.
for %%f in ("%BACKUP_DIR%\*.db") do (
    echo   %%~nf (%%~zf bytes)
)
echo.
echo ========================================
echo   共 %BACKUP_DIR% 中的备份文件:
dir /b "%BACKUP_DIR%\*.db" 2>nul | find /c /v "" 
echo ========================================
echo.
pause
