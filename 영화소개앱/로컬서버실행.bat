@echo off
rem REELVAULT local server launcher
rem YouTube blocks embeds opened via file:// (error 153), so serve over http://localhost:8000
cd /d "%~dp0"
echo Starting REELVAULT at http://localhost:8000 ...
echo (Keep this window open. Press Ctrl+C to stop.)
start "" "http://localhost:8000"

rem Node server first: it injects the TMDB key from .env (python http.server cannot)
where node >nul 2>nul
if %errorlevel%==0 (
  node local-server.js
  goto :eof
)

echo.
echo [ERROR] Node.js is required to run the local server (.env key injection).
echo Install Node.js from https://nodejs.org and run this file again.
pause
