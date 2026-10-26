@echo off
echo ========================================================
echo   Building MeritBridge Fully Offline Desktop Executable
echo ========================================================

cd /d "%~dp0meritbridge"
echo [1/2] Compiling fully offline release with embedded UI assets...
call npx tauri build --no-bundle
if %errorlevel% neq 0 (
    echo Error during Tauri offline build!
    pause
    exit /b %errorlevel%
)

echo [2/2] Copying MeritBridge.exe and WebView2Loader.dll to root...
copy /y "src-tauri\target\release\meritbridge.exe" "..\MeritBridge.exe"
copy /y "src-tauri\target\release\meritbridge.exe" ".\MeritBridge.exe"
copy /y "src-tauri\target\release\WebView2Loader.dll" "..\"
copy /y "src-tauri\target\release\WebView2Loader.dll" ".\"

echo ========================================================
echo   Build Successful! 100%% Offline Executable Ready:
echo   MeritBridge.exe (Double-click to run without any server)
echo ========================================================
pause
