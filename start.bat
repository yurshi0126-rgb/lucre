@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js 18+ is needed. Install it from https://nodejs.org & pause & exit /b 1)
node bot.js
pause
