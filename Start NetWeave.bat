@echo off
title NetWeave
cd /d "%~dp0"
echo ============================================
echo   Starting NetWeave - Network Lab
echo ============================================
echo.
echo The app will open in your browser shortly.
echo Keep this window open while using NetWeave.
echo Close this window (or press Ctrl+C) to stop.
echo.
call npm run dev -- --open
echo.
echo NetWeave stopped. Press any key to close.
pause >nul
