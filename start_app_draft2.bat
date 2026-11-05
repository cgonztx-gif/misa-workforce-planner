@echo off
rem Double-click to start the draft 2 Workforce Planner, the fallback if draft 3 (start_app.bat) has a problem. It opens in the browser once the three scenarios are ready.
setlocal
cd /d "%~dp0"
set "PORT=8501"
set "URL=http://localhost:%PORT%/"

where python >nul 2>nul
if errorlevel 1 (
  echo Python isn't on PATH. Install Python 3.13, then run: python -m pip install -r requirements.txt
  pause
  exit /b 1
)

set "BUSY_PID="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do set "BUSY_PID=%%P"
if defined BUSY_PID (
  set "BUSY_NAME=another program"
  for /f "tokens=1" %%N in ('tasklist /FI "PID eq %BUSY_PID%" /NH 2^>nul ^| findstr /V /C:"INFO:"') do set "BUSY_NAME=%%N"
  call :busy
  pause
  exit /b 1
)

echo Starting the Workforce Planner (draft 2 fallback) on %URL%
echo The browser opens by itself in about 15 seconds. Keep this window open while you use it, and close it to stop.
rem Wait in the background until /api/health reports ready (or a startup error to show), then open the browser.
start "" /b powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference = 'SilentlyContinue'; for ($i = 0; $i -lt 240; $i++) { try { $h = Invoke-RestMethod -Uri 'http://127.0.0.1:%PORT%/api/health' -TimeoutSec 2; if ($h.ready -or $h.error) { Start-Process '%URL%'; break } } catch {}; Start-Sleep -Milliseconds 500 }"
python -m server --port %PORT% --no-browser --draft2
if errorlevel 1 pause
exit /b

:busy
echo.
echo Port %PORT% is already in use by %BUSY_NAME% (process %BUSY_PID%).
echo It's probably an earlier Workforce Planner window or the Streamlit app. Close that window,
echo or press Ctrl+C in it, then run start_app.bat again. If you can't find it, end process %BUSY_PID%
echo in Task Manager (Details tab).
exit /b
