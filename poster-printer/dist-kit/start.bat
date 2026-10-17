@echo off
rem Ready Poster Printer - start the local app (Windows). Double-click, or run: start.bat [--port 5180] [--no-open]
rem Every failure ends at a pause with the reason, so the window never just flashes shut.
rem Saved as UTF-8 (no BOM); make-dist.sh converts it to CRLF.
setlocal
chcp 65001 >nul
pushd "%~dp0"
title Ready Poster Printer
set "PYTHONUTF8=1"

rem A .bat double-clicked inside the zip runs from a temp folder without the files next to it.
if not exist "server\serve.py" goto :notextracted
if not exist "app\index.html" goto :notextracted

rem The first Python that really runs and is 3.9+. "where python" is not enough: on Windows 10/11 it finds the
rem Microsoft Store alias (WindowsApps\python.exe), which only prints "Python was not found" and exits.
set "PY="
if exist ".venv\Scripts\python.exe" call :try ".venv\Scripts\python.exe"
if not defined PY call :try py -3
if not defined PY call :try python
if not defined PY call :try python3
if not defined PY goto :nopython

%PY% server\serve.py %*
set "RC=%errorlevel%"
rem 0: stopped normally; -1073741510: stopped with Ctrl+C
if "%RC%"=="0" goto :end
if "%RC%"=="-1073741510" goto :end
echo.
echo   程序出错停止了（错误代码 %RC%），原因在上面几行。截图发给作者就能帮你看。
echo   Ready Poster Printer stopped with an error (code %RC%); the lines above say why.
goto :hold

:try
%* -c "import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)" <nul >nul 2>nul
if "%errorlevel%"=="0" set "PY=%*"
goto :eof

:notextracted
echo.
echo   这里缺少程序文件（server\serve.py、app\index.html）。
echo   请先把下载的 zip 整个解压：右键 zip，选「全部解压缩」，再打开解压出来的文件夹，双击里面的 start.bat。
echo   不要在压缩包里直接双击。
echo.
echo   Program files are missing. Extract the whole zip first (right-click it, Extract All),
echo   then double-click start.bat in the extracted folder, not inside the zip.
goto :hold

:nopython
echo.
echo   没有找到 Python 3.9 或更新版本，正在打开 python.org 下载页。
echo   下载安装，安装第一页勾选「Add python.exe to PATH」，装好后再双击 start.bat。
echo.
echo   Python 3.9 or newer was not found. Install it from https://www.python.org/downloads/
echo   (tick "Add python.exe to PATH" on the first screen), then double-click start.bat again.
start "" "https://www.python.org/downloads/"
goto :hold

:hold
echo.
pause
:end
popd
endlocal
