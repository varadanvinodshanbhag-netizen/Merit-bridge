@echo off
echo ========================================================
echo   Building MeritBridge Fully Offline Desktop App & Setup
echo ========================================================

cd /d "%~dp0meritbridge"
echo [1/4] Compiling fully offline release with embedded UI assets...
call npx tauri build --no-bundle
if %errorlevel% neq 0 (
    echo Error during Tauri offline build!
    pause
    exit /b %errorlevel%
)

cd /d "%~dp0"
echo [2/4] Collecting binaries and companion DLLs...
if not exist "MeritBridge-App" mkdir "MeritBridge-App"
copy /y "meritbridge\src-tauri\target\release\meritbridge.exe" ".\MeritBridgeApp.exe"
copy /y "meritbridge\src-tauri\target\release\WebView2Loader.dll" ".\WebView2Loader.dll"

copy /y ".\MeritBridgeApp.exe" "MeritBridge-App\MeritBridgeApp.exe"
copy /y ".\MeritBridgeApp.exe" "MeritBridge-App\MeritBridge.exe"
copy /y ".\WebView2Loader.dll" "MeritBridge-App\WebView2Loader.dll"
copy /y ".\libunwind.dll" "MeritBridge-App\libunwind.dll"

set CSC=C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe

echo [3/4] Generating single standalone portable MeritBridge.exe...
"%CSC%" /nologo /target:winexe /platform:x64 "/win32icon:meritbridge\src-tauri\icons\icon.ico" "/out:MeritBridge.exe" "/resource:MeritBridge-App\MeritBridgeApp.exe,MeritBridgeApp.exe" "/resource:MeritBridge-App\WebView2Loader.dll,WebView2Loader.dll" "/resource:MeritBridge-App\libunwind.dll,libunwind.dll" "/reference:System.Windows.Forms.dll,System.Drawing.dll,Microsoft.CSharp.dll,System.Core.dll" "installer-builder\Launcher.cs"

echo [4/4] Generating single standalone MeritBridge-Setup.exe installer...
"%CSC%" /nologo /target:winexe /platform:x64 "/win32icon:meritbridge\src-tauri\icons\icon.ico" "/out:MeritBridge-Setup.exe" "/resource:MeritBridge-App\MeritBridge.exe,MeritBridge.exe" "/resource:MeritBridge-App\WebView2Loader.dll,WebView2Loader.dll" "/resource:MeritBridge-App\libunwind.dll,libunwind.dll" "/reference:System.Windows.Forms.dll,System.Drawing.dll,Microsoft.CSharp.dll,System.Core.dll" "installer-builder\Installer.cs"

echo ========================================================
echo   Build Successful!
echo   -> MeritBridge.exe       (Single 1-click Portable EXE, run anywhere)
echo   -> MeritBridge-Setup.exe (Standalone 1-click Setup for ANY Windows PC)
echo ========================================================
