@echo off
rem Runs the table on this PC (from GeezSheets' serve.cmd). The page cannot be opened by double-clicking index.html.
setlocal
cd /d "%~dp0"

set "PORT=%~1"
if not defined PORT set "PORT=8000"

python --version >nul 2>nul
if not errorlevel 1 (
    set "PYTHON=python"
) else (
    py -3 --version >nul 2>nul
    if errorlevel 1 (
        echo Python 3 is required to serve these pages.
        exit /b 1
    )
    set "PYTHON=py -3"
)

echo GM:      http://127.0.0.1:%PORT%/gm.html
echo Players: http://127.0.0.1:%PORT%/index.html
echo Press Ctrl+C to stop.
start "" http://127.0.0.1:%PORT%/gm.html
%PYTHON% -m http.server %PORT% --bind 127.0.0.1
