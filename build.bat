@echo off
setlocal
rem Run from this file's directory, including paths containing spaces.
pushd "%~dp0"
if errorlevel 1 exit /b 1

if not "%~1"=="" if /i not "%~1"=="--build-only" goto usage

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or is not on PATH.
    goto failure
)
where npm.cmd >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm is not installed or is not on PATH.
    goto failure
)

if not exist "node_modules\" (
    echo [1/3] Installing dependencies...
    if exist "package-lock.json" (
        call npm.cmd ci
    ) else (
        call npm.cmd install
    )
    if errorlevel 1 goto failure
) else (
    echo [1/3] Using installed dependencies.
)

echo [2/3] Checking types and building application...
call npm.cmd run check:release
if errorlevel 1 goto failure
call npm.cmd run build
if errorlevel 1 goto failure
if /i "%~1"=="--build-only" goto built

echo [3/3] Creating Windows installer...
rem Never publish to GitHub from this local build script.
call npm.cmd exec -- electron-builder --win --publish never
if errorlevel 1 goto failure
echo.
echo [OK] Installer output: "%CD%\release"
goto success

:built
echo.
echo [OK] Application output: "%CD%\dist"

:success
popd
echo.
pause
exit /b 0

:usage
echo Usage: build.bat [--build-only]
echo Default: build the application and Windows installer.
echo --build-only: build the application without packaging.
popd
exit /b 2

:failure
echo.
echo [ERROR] Build failed. See the error messages above.
popd
pause
exit /b 1
