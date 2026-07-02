@echo off
cd /d "%~dp0"
echo This will update hotel coordinates in Supabase.
echo A backup will be written to coordinate-backups before changes are applied.
echo.
set /p CONFIRM=Type APPLY and press Enter to continue: 
if /I not "%CONFIRM%"=="APPLY" (
  echo Cancelled.
  pause
  exit /b 1
)
echo.
npm run coordinates:fix
echo.
pause
