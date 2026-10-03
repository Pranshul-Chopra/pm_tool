@echo off
:: PM Tool — Release Build Script
:: Run this from the repository root (where main.py lives).
:: Requires: Python 3.11/3.13 venv, Node.js, npm

setlocal enabledelayedexpansion

echo.
echo ========================================
echo  PM Tool Build
echo ========================================
echo.

:: ── Step 1: Activate Python venv ─────────────────────────────────────────────
echo [1/4] Checking Python environment...
if exist "venv311\Scripts\activate.bat" (
    call venv311\Scripts\activate.bat
) else if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
) else if exist ".venv\Scripts\activate.bat" (
    call .venv\Scripts\activate.bat
) else (
    echo Note: No local virtual environment found, using system Python...
)

:: ── Step 2: Build Flask executable with PyInstaller ───────────────────────────
echo [2/4] Building Flask backend with PyInstaller...
if exist flask-dist rmdir /s /q flask-dist
if exist dist\flask rmdir /s /q dist\flask
pyinstaller flask.spec --noconfirm
if errorlevel 1 (
    echo ERROR: PyInstaller build failed.
    pause & exit /b 1
)
echo Flask backend built -> dist\flask\

:: ── Step 3: Install Electron dependencies ────────────────────────────────────
echo [3/4] Installing Electron dependencies...
cd electron
call npm install
if errorlevel 1 (
    echo ERROR: npm install failed.
    cd ..
    pause & exit /b 1
)

:: ── Step 4: Package with electron-builder ─────────────────────────────────────
echo [4/4] Packaging desktop application with electron-builder...
call npm run build
if errorlevel 1 (
    echo ERROR: electron-builder failed.
    cd ..
    pause & exit /b 1
)
cd ..

echo.
echo ========================================
echo  Build complete!
echo  Output: release\
echo ========================================
echo.
pause
