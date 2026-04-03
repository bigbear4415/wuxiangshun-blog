@echo off
cd /d "%~dp0"
for /f "tokens=5" %%i in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do taskkill /PID %%i /F >nul 2>nul
start "Blog Server" cmd /k "npm start"
timeout /t 3 /nobreak >nul
start "" http://localhost:3000
start "" http://localhost:3000/admin.html
