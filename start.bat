@echo off
SET PATH=%PATH%;C:\Program Files\nodejs
cd /d D:\council

echo Releasing port 3001...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
timeout /t 2 /nobreak >nul

echo Starting Council dev server on http://localhost:3001...
start http://localhost:3001
npx next dev -p 3001
pause
