@echo off
REM 雙擊此檔案啟動 portfolio-tracker dev server（http://localhost:3000）
REM 終端機視窗會留著，關掉就停止。

cd /d "%~dp0"
set NEXT_TELEMETRY_DISABLED=1
echo Starting portfolio-tracker dev server...
echo Open http://localhost:3000 in your browser.
echo Close this window to stop.
echo.
call npm run dev
pause
