@echo off
rem Ready Poster Printer - start the local app (Windows). Double-click or run: start.bat [--port 5180]
cd /d "%~dp0"
if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" server\serve.py %*
  goto :eof
)
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 server\serve.py %*
  goto :eof
)
where python >nul 2>nul
if %errorlevel%==0 (
  python server\serve.py %*
  goto :eof
)
echo Python 3.9+ is required: https://www.python.org/downloads/  (tick "Add python.exe to PATH")
pause
