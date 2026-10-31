@echo off
title PawTrack - Dual System Launcher (Owner + Admin)
cd /d "%~dp0"

echo =======================================================
echo   PawTrack Dual Server Startup (Owner + Admin)
echo =======================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo [*] Starting PawTrack Owner Server (Port 3000)...
start "PawTrack Owner Server (3000)" cmd /k "cd /d e:\Codes\PawTrack && node server.js"

echo [*] Starting PawTrack Admin Server (Port 8080)...
if exist "e:\Codes\PawTrack (Admin)\server.js" (
    start "PawTrack Admin Server (8080)" cmd /k "cd /d e:\Codes\PawTrack (Admin) && node server.js"
) else (
    echo [NOTICE] Admin server file not found at e:\Codes\PawTrack (Admin)\server.js
)

timeout /t 2 >nul

echo [*] Opening Pet Owner Portal in default browser (http://localhost:3000)...
start "" http://localhost:3000

echo [*] Opening Shelter Admin Portal in default browser (http://localhost:8080)...
start "" http://localhost:8080

echo.
echo =======================================================
echo   Both systems are starting up and synchronized!
echo   Database: Supabase (cloud)
echo =======================================================
echo.
pause
