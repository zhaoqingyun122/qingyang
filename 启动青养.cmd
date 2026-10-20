@echo off
chcp 65001 >nul
title 青养 · 食疗健康生活
cd /d "%~dp0"

set "NODE_EXE="
where node >nul 2>nul && set "NODE_EXE=node"
if not defined NODE_EXE if exist "%~dp0runtime\node.exe" set "NODE_EXE=%~dp0runtime\node.exe"

if not defined NODE_EXE (
  echo.
  echo   [未找到 Node.js] 无法启动本地服务。
  echo   请安装 Node.js 后重试，或直接双击 index.html 使用离线模式。
  echo.
  pause
  exit /b 1
)

echo.
echo   正在启动青养 · 食疗健康生活 ...
"%NODE_EXE%" "scripts\server.mjs" %*
echo.
pause
