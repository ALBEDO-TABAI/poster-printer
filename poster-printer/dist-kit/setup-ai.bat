@echo off
rem Optional: install the AI background-removal extras (rembg + onnxruntime) into .venv (~300 MB incl. model).
rem Stops at a pause with the reason on any failure, and says "installed" only once rembg really imports.
rem Saved as UTF-8 (no BOM); make-dist.sh converts it to CRLF.
setlocal
chcp 65001 >nul
pushd "%~dp0"
title Ready Poster Printer - AI cut-out setup
set "PYTHONUTF8=1"
if not exist "server\requirements.txt" goto :notextracted

rem Reuse a working .venv; rebuild one left by a failed run or by a Python that has since been removed.
set "PY="
if exist ".venv\Scripts\python.exe" call :try ".venv\Scripts\python.exe"
if defined PY goto :install
if exist ".venv" rmdir /s /q ".venv"
rem Same search as start.bat: the Microsoft Store alias for "python" is skipped because it does not run.
call :try py -3
if not defined PY call :try python
if not defined PY call :try python3
if not defined PY goto :nopython
echo Creating .venv ...
%PY% -m venv .venv
if not "%errorlevel%"=="0" goto :failed

:install
".venv\Scripts\python.exe" -m pip install --upgrade pip
".venv\Scripts\python.exe" -m pip install -r server\requirements.txt
if not "%errorlevel%"=="0" goto :failed
".venv\Scripts\python.exe" -c "import rembg, onnxruntime, PIL"
if not "%errorlevel%"=="0" goto :failed
echo.
echo   AI 抠图已安装。之后照常双击 start.bat 启动，第一次抠图时会下载模型（约 170 MB）。
echo   AI cut-out installed. Start with start.bat; the model (~170 MB) downloads on first use.
goto :hold

:try
%* -c "import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)" <nul >nul 2>nul
if "%errorlevel%"=="0" set "PY=%*"
goto :eof

:failed
echo.
echo   安装没有完成，原因在上面几行。网络断了的话再双击一次 setup-ai.bat 即可。
echo   提示「DLL load failed」时，先安装微软运行库 https://aka.ms/vs/17/release/vc_redist.x64.exe 再试。
echo   不装 AI 抠图也能正常使用，双击 start.bat 即可。
echo.
echo   Setup did not finish; the lines above say why. On a network error, run setup-ai.bat again.
echo   On "DLL load failed", install https://aka.ms/vs/17/release/vc_redist.x64.exe and retry.
echo   The app works without the AI cut-out: double-click start.bat.
goto :hold

:notextracted
echo.
echo   这里缺少程序文件。请先把下载的 zip 整个解压（右键 zip，选「全部解压缩」），再双击解压出来的 setup-ai.bat。
echo   Program files are missing. Extract the whole zip first (right-click it, Extract All), then run setup-ai.bat there.
goto :hold

:nopython
echo.
echo   没有找到 Python 3.9 或更新版本，正在打开 python.org 下载页。
echo   下载安装，安装第一页勾选「Add python.exe to PATH」，装好后再双击 setup-ai.bat。
echo.
echo   Python 3.9 or newer was not found. Install it from https://www.python.org/downloads/
echo   (tick "Add python.exe to PATH" on the first screen), then run setup-ai.bat again.
start "" "https://www.python.org/downloads/"
goto :hold

:hold
echo.
pause
popd
endlocal
