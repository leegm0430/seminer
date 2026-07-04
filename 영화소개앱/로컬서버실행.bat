@echo off
rem REELVAULT local server launcher
rem YouTube blocks embeds opened via file:// (error 153), so serve over http://localhost:8000
cd /d "%~dp0"
echo Starting REELVAULT at http://localhost:8000 ...
echo (Keep this window open. Press Ctrl+C to stop.)
start "" "http://localhost:8000"

where python >nul 2>nul
if %errorlevel%==0 (
  python -m http.server 8000
  goto :eof
)

where node >nul 2>nul
if %errorlevel%==0 (
  node local-server.js
  goto :eof
)

echo.
echo [ERROR] Python or Node.js is required to run the local server.
echo Install one of them and run this file again.
pause
