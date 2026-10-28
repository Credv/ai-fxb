@echo off
cd /d "%~dp0"
title AI ChuangKou Site (resume + console)

set "NODE_DIR=D:\tools\node20"
set "NODE_EXE=%NODE_DIR%\node.exe"
set "NPM_CLI=%NODE_DIR%\node_modules\npm\bin\npm-cli.js"
set "PORT=5178"

if not exist "%NODE_EXE%" (
  echo [ERROR] Node 20 not found: %NODE_EXE%
  echo         Vite needs Node 20+. Install it, or edit NODE_DIR in this script.
  echo.
  pause
  exit /b 1
)

if not exist "%~dp0package.json" (
  echo [ERROR] package.json not found next to this script.
  echo         Put this script in the project root: D:\ai-fxb
  echo.
  pause
  exit /b 1
)

if not exist "%~dp0node_modules\vite\bin\vite.js" (
  echo [SETUP] First run: installing dependencies, about 1-3 minutes...
  "%NODE_EXE%" "%NPM_CLI%" install --registry=https://registry.npmmirror.com
  if errorlevel 1 (
    echo.
    echo [ERROR] npm install failed. See the npm output above.
    pause
    exit /b 1
  )
)

echo [BUILD] Building resume ^(+ root^), console ^(+ /ai-fxb^)...
"%NODE_EXE%" "%NPM_CLI%" run build
if errorlevel 1 (
  echo.
  echo [ERROR] Build failed. See the compiler output above.
  pause
  exit /b 1
)

echo.
echo [RUN] http://127.0.0.1:%PORT%/            resume
echo       http://127.0.0.1:%PORT%/ai-fxb/     AI console
echo Close this window to stop the server.
echo.

start "" /min cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:%PORT%/"

"%NODE_EXE%" scripts\preview.mjs

echo.
echo Server stopped. See any error message above.
pause
