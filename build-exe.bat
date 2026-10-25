@echo off
echo ========================================================
echo   Building MeritBridge Desktop Executable (.exe)
echo ========================================================

cd /d "%~dp0meritbridge"
echo [1/3] Building frontend assets...
call npm run build
if %errorlevel% neq 0 (
    echo Error during frontend build!
    pause
    exit /b %errorlevel%
)

echo [2/3] Compiling release executable...
cargo build --release --manifest-path src-tauri\Cargo.toml
if %errorlevel% neq 0 (
    echo Error during cargo compilation!
    pause
    exit /b %errorlevel%
)

echo [3/3] Copying MeritBridge.exe and WebView2Loader.dll to project root...
copy /y "src-tauri\target\release\meritbridge.exe" "..\MeritBridge.exe"
copy /y "src-tauri\target\release\meritbridge.exe" ".\MeritBridge.exe"
copy /y "src-tauri\target\release\WebView2Loader.dll" "..\"
copy /y "src-tauri\target\release\WebView2Loader.dll" ".\"

echo ========================================================
echo   Build Successful! Executable: MeritBridge.exe
echo ========================================================
pause
