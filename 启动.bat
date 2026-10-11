@echo off
cd /d "%~dp0"
title AI FengXiangBiao Server

set "NODE_EXE=D:\nodeJs\node.exe"

if not exist "%NODE_EXE%" (
  echo [ERROR] Node.js not found: %NODE_EXE%
  echo         Check the Node install path, or edit NODE_EXE in this script.
  echo.
  pause
  exit /b 1
)

if not exist "%~dp0server.mjs" (
  echo [ERROR] server.mjs not found.
  echo         Put this script in the project root: D:\ai-fxb
  echo.
  pause
  exit /b 1
)

echo Starting AI FengXiangBiao  ->  http://127.0.0.1:5178
echo Close this window to stop the server.
echo.

start "" /min cmd /c "timeout /t 2 /nobreak >/dev/null & start http://127.0.0.1:5178"

"%NODE_EXE%" server.mjs

echo.
echo Server stopped. See any error message above.
pause
