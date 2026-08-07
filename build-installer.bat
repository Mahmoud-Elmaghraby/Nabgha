@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo   نبغة - Build Installer Script
echo ========================================
echo.

REM ===== التأكد من صلاحيات Administrator =====
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [خطأ] لازم تشغل الملف ده كـ Administrator
    echo افتح cmd كـ Administrator وشغله تاني
    pause
    exit /b 1
)

set ROOT=M:\Projects\Nabgha
set MAKENSIS="C:\Program Files (x86)\NSIS\makensis.exe"

REM ===== 1. إيقاف أي نسخة شغالة من التطبيق =====
echo [1/6] جاري إيقاف أي نسخة شغالة من نبغة...
taskkill /f /im "نبغة.exe" /t >nul 2>&1
taskkill /f /im "node.exe" /t >nul 2>&1
timeout /t 2 /nobreak >nul
echo       تم.
echo.

REM ===== 2. بناء الـ API (NestJS) =====
echo [2/6] جاري بناء API...
cd /d "%ROOT%\apps\api"
call npx nest build
if %errorLevel% neq 0 (
    echo [خطأ] فشل بناء API
    pause
    exit /b 1
)
echo       تم بناء API بنجاح.
echo.

REM ===== 3. بناء الـ Web (React) =====
echo [3/6] جاري بناء الواجهة...
cd /d "%ROOT%"
call pnpm --filter web build
if %errorLevel% neq 0 (
    echo [خطأ] فشل بناء الواجهة
    pause
    exit /b 1
)
echo       تم بناء الواجهة بنجاح.
echo.

REM ===== 4. بناء الـ Desktop (TypeScript) =====
echo [4/6] جاري بناء Electron...
cd /d "%ROOT%\apps\desktop"
call npx tsc
if %errorLevel% neq 0 (
    echo [خطأ] فشل بناء Electron
    pause
    exit /b 1
)
echo       تم بناء Electron بنجاح.
echo.

REM ===== 5. تشغيل electron-builder =====
echo [5/6] جاري تجميع التطبيق (electron-builder)...
call npx electron-builder --win
if %errorLevel% neq 0 (
    echo [خطأ] فشل electron-builder
    pause
    exit /b 1
)
echo       تم تجميع التطبيق بنجاح.
echo.

REM ===== 6. بناء الـ Installer (NSIS) =====
echo [6/6] جاري بناء الـ Installer...
cd /d "%ROOT%"
%MAKENSIS% nabgha-installer.nsi
if %errorLevel% neq 0 (
    echo [خطأ] فشل بناء الـ Installer
    pause
    exit /b 1
)
echo       تم بناء الـ Installer بنجاح.
echo.

echo ========================================
echo   تم بناء كل شيء بنجاح!
echo   الملف: %ROOT%\nabgha-setup.exe
echo ========================================
echo.
pause