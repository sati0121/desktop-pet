@echo off
chcp 65001 >nul
setlocal

set "EXE=D:\Desktop\diary\diary-app\node_modules\electron\dist\electron.exe"

if not exist "%EXE%" (
    echo Electron binary not found:
    echo %EXE%
    echo.
    echo Please check the path, or reinstall electron and update this file.
    pause
    exit /b 1
)

rem strip trailing backslash from %~dp0 to avoid \" escaping in start
set "APP=%~dp0"
set "APP=%APP:~0,-1%"

start "" "%EXE%" "%APP%"
endlocal
exit /b 0
