@echo off
cd /d "%~dp0"
echo Starting moderator app from:
echo %CD%
echo.
npm run moderator
pause
