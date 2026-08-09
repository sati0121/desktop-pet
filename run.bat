@echo off
setlocal

rem Prefer the project-local Electron (installed via `npm install`)
set "LOCAL_ELECTRON=%~dp0node_modules\electron\dist\electron.exe"
rem Fallback: author's local copy
set "FALLBACK_EXE=D:\Desktop\diary\diary-app\node_modules\electron\dist\electron.exe"

if exist "%LOCAL_ELECTRON%" (
    set "EXE=%LOCAL_ELECTRON%"
) else if exist "%FALLBACK_EXE%" (
    set "EXE=%FALLBACK_EXE%"
) else (
    echo Electron not found.
    echo Install it with:  npm install
    echo Or set EXE in this script to your electron.exe path.
    pause
    exit /b 1
)

rem strip trailing backslash from %~dp0 to avoid \" escaping in start
set "APP=%~dp0"
set "APP=%APP:~0,-1%"

start "" "%EXE%" "%APP%"
endlocal
exit /b 0
