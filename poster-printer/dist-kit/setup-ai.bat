@echo off
rem Optional: install the AI background-removal extras (rembg + onnxruntime) into .venv (~300 MB incl. model).
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 ( py -3 -m venv .venv ) else ( python -m venv .venv )
".venv\Scripts\python.exe" -m pip install --upgrade pip
".venv\Scripts\python.exe" -m pip install -r server\requirements.txt
echo AI cut-out installed. Start with start.bat - the model (~170 MB) downloads on first use.
pause
