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

echo [*] Starting PawTrack server (Owner portal at / and Admin console at /admin/)...
echo [*] If port 3000 is taken, the next free port is used automatically.
echo [*] The server opens both pages in your browser at the port it actually binds.

REM One server serves both apps. It opens each path itself, at whichever port it ends up on.
set PAWTRACK_OPEN=/,/admin/
node server.js

echo.
echo =======================================================
echo   Server stopped.
echo =======================================================
echo.
pause
