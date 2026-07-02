@echo off
cd /d "%~dp0"
echo Running coordinate repair preview from:
echo %CD%
echo.
npm run coordinates:dry-run -- --limit 10
echo.
pause
